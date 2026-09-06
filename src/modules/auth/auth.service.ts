import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
    const user = await this.usersService.findByEmail(loginDto.email, true);

    if (!user) {
      // Constant-time mitigation against timing attacks: simulate hash comparison
      await bcrypt.compare(loginDto.password, '$2a$12$e8eYQvJ4YhZ19bI9X1/xNuZzP4sD8Q.YQvJ4YhZ19bI9X1/xNuZzP');
      await this.auditLogService.logEvent({
        action: 'LOGIN_FAILED',
        resource: 'Auth',
        ipAddress,
        userAgent,
        details: `Intento de acceso fallido: El usuario '${loginDto.email}' no existe.`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      await this.auditLogService.logEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        resource: 'Auth',
        ipAddress,
        userAgent,
        details: `Intento de acceso rechazado: Cuenta suspendida para '${user.email}'.`,
      });
      throw new UnauthorizedException('Tu cuenta ha sido suspendida. Contacta soporte.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      await this.auditLogService.logEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'Auth',
        ipAddress,
        userAgent,
        details: `Intento de acceso fallido: Contraseña incorrecta para '${user.email}'.`,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'Auth',
      ipAddress,
      userAgent,
      details: `Inicio de sesión exitoso. Rol: ${user.role}. Usuario: ${user.fullName}.`,
    });

    // Remove password before returning
    delete (user as any).password;
    delete (user as any).refreshTokenHash;

    return {
      user,
      ...tokens,
    };
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
