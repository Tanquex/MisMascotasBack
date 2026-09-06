import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDefaultAdmin();
  }

  private async seedDefaultAdmin(): Promise<void> {
    const adminEmail = 'admin@vetregistro.com';
    const existingAdmin = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('AdminPassword123!', 12);
      const admin = this.userRepository.create({
        email: adminEmail,
        password: hashedPassword,
        fullName: 'Administrador General',
        phone: '5500000000',
        role: Role.ADMIN,
        isActive: true,
      });

      await this.userRepository.save(admin);
      this.logger.log('====================================================');
      this.logger.log('🛡️ [SEED] Administrador por defecto inicializado:');
      this.logger.log(`👉 Correo: ${adminEmail}`);
      this.logger.log('👉 Contraseña: AdminPassword123!');
      this.logger.log('====================================================');
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: createUserDto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado');
    }

    const saltRounds = 12; // Production standard cost factor
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = this.userRepository.create({
      ...createUserDto,
      email: createUserDto.email.toLowerCase().trim(),
      password: hashedPassword,
    });

    const saved = await this.userRepository.save(user);
    // Remove sensitive fields from returned instance
    delete (saved as any).password;
    delete (saved as any).refreshTokenHash;
    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        acceptedPrivacyVersion: true,
        privacyAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { pets: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async findByEmail(email: string, includePassword = false): Promise<User | null> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() });

    if (includePassword) {
      qb.addSelect('user.password').addSelect('user.refreshTokenHash');
    }

    return qb.getOne();
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    if (!refreshToken) {
      await this.userRepository.update(userId, { refreshTokenHash: null as any });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.userRepository.update(userId, { refreshTokenHash: hash });
  }

  async acceptPrivacyPolicy(userId: string, version = '2026-v1.0'): Promise<{ message: string; acceptedPrivacyVersion: string; privacyAcceptedAt: Date }> {
    const user = await this.findById(userId);
    user.acceptedPrivacyVersion = version;
    user.privacyAcceptedAt = new Date();
    await this.userRepository.save(user);
    return {
      message: 'Aviso de Privacidad y Términos aceptados exitosamente en la base de datos',
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      privacyAcceptedAt: user.privacyAcceptedAt,
    };
  }

  async invalidateAllPrivacyAcceptances(newVersion: string = '2026-v2.0'): Promise<{ message: string; updatedUsersCount: number }> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ acceptedPrivacyVersion: 'OUTDATED' })
      .execute();

    return {
      message: `Se ha invalidado la aprobación para todos los usuarios debido a la nueva versión (${newVersion}). Deberán aceptarla al ingresar.`,
      updatedUsersCount: result.affected || 0,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const emailExists = await this.userRepository.findOne({
        where: { email: updateUserDto.email.toLowerCase().trim() },
      });
      if (emailExists && emailExists.id !== id) {
        throw new ConflictException('El correo electrónico ya está en uso');
      }
      user.email = updateUserDto.email.toLowerCase().trim();
    }

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async remove(id: string, currentUserId: string): Promise<{ message: string }> {
    if (id === currentUserId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta de administrador');
    }

    const user = await this.findById(id);
    await this.userRepository.remove(user);
    return { message: 'Usuario eliminado exitosamente junto a sus registros asociados' };
  }
}
