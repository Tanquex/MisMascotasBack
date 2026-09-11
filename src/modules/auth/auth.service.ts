import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.create({
      ...registerDto,
      role: Role.PET_OWNER, // Public registration is always PET_OWNER
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'USER_REGISTERED',
      resource: 'Auth',
      ipAddress,
      userAgent,
      details: `Nueva cuenta creada. Correo: ${user.email}, Nombre: ${user.fullName}.`,
    });

    return {
      user,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    this.logger.log(`🔑 [LOGIN] Iniciando autenticación para: ${loginDto.email}`);

    try {
      this.logger.log(`🔍 [LOGIN] Paso 1: Consultando usuario en base de datos...`);
      const user = await this.usersService.findByEmail(loginDto.email, true);
      this.logger.log(`👤 [LOGIN] Paso 2: Usuario encontrado: ${user ? 'SI' : 'NO'}`);

      if (!user) {
        this.logger.warn(`⚠️ [LOGIN] Usuario no existe: ${loginDto.email}. Simulando hash.`);
        await bcrypt.compare(loginDto.password, '$2a$12$e8eYQvJ4YhZ19bI9X1/xNuZzP4sD8Q.YQvJ4YhZ19bI9X1/xNuZzP');
        this.auditLogService.logEvent({
          action: 'LOGIN_FAILED',
          resource: 'Auth',
          ipAddress,
          userAgent,
          details: `Intento de acceso fallido: El usuario '${loginDto.email}' no existe.`,
        }).catch(err => this.logger.error('Error logging audit event', err));
        throw new UnauthorizedException('Credenciales inválidas');
      }

      if (!user.isActive) {
        this.logger.warn(`🚫 [LOGIN] Cuenta suspendida: ${user.email}`);
        this.auditLogService.logEvent({
          userId: user.id,
          action: 'LOGIN_BLOCKED',
          resource: 'Auth',
          ipAddress,
          userAgent,
          details: `Intento de acceso rechazado: Cuenta suspendida para '${user.email}'.`,
        }).catch(err => this.logger.error('Error logging audit event', err));
        throw new UnauthorizedException('Tu cuenta ha sido suspendida. Contacta soporte.');
      }

      this.logger.log(`🔐 [LOGIN] Paso 3: Verificando contraseña con bcrypt...`);
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      this.logger.log(`🔐 [LOGIN] Paso 4: Contraseña válida: ${isPasswordValid ? 'SI' : 'NO'}`);

      if (!isPasswordValid) {
        this.auditLogService.logEvent({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'Auth',
          ipAddress,
          userAgent,
          details: `Intento de acceso fallido: Contraseña incorrecta para '${user.email}'.`,
        }).catch(err => this.logger.error('Error logging audit event', err));
        throw new UnauthorizedException('Credenciales inválidas');
      }

      this.logger.log(`🎟️ [LOGIN] Paso 5: Generando tokens JWT...`);
      const tokens = await this.generateTokens(user.id, user.email, user.role);

      this.logger.log(`💾 [LOGIN] Paso 6: Actualizando refresh token...`);
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`📝 [LOGIN] Paso 7: Registrando auditoría de éxito...`);
      this.auditLogService.logEvent({
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        resource: 'Auth',
        ipAddress,
        userAgent,
        details: `Inicio de sesión exitoso. Rol: ${user.role}. Usuario: ${user.fullName}.`,
      }).catch(err => this.logger.error('Error logging audit event', err));

      // Remove password before returning
      delete (user as any).password;
      delete (user as any).refreshTokenHash;

      this.logger.log(`✅ [LOGIN] Autenticación completada con éxito para: ${user.email}`);

      return {
        user,
        ...tokens,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`💥 [LOGIN_CRASH] Error inesperado en login: ${err.message}`, err.stack);
      throw err;
    }
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret')!;
      const payload = this.jwtService.verify<JwtPayload>(refreshTokenDto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.usersService.findByEmail(payload.email, true);
      if (!user || !user.refreshTokenHash || !user.isActive) {
        throw new UnauthorizedException('Acceso denegado o sesión revocada');
      }

      const refreshTokenMatches = await bcrypt.compare(
        refreshTokenDto.refreshToken,
        user.refreshTokenHash,
      );

      if (!refreshTokenMatches) {
        throw new UnauthorizedException('Token de refresco inválido o reutilizado');
      }

      // Token rotation
      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Sesión expirada o token inválido');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    await this.auditLogService.logEvent({
      userId,
      action: 'LOGOUT',
      resource: 'Auth',
      details: 'Sesión cerrada por el usuario.',
    });
    return { message: 'Sesión cerrada exitosamente' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: (this.configService.get<string>('jwt.expiresIn') || '1h') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') || '7d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
