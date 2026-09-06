import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { Pet } from '../../pets/entities/pet.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 120 })
  email: string;

  // Marked select: false to prevent accidental password exposure in SELECT queries
  @Column({ select: false })
  password: string;

  @Column({ length: 100 })
  fullName: string;

  @Column({ nullable: true, length: 50 })
  phone?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: Role.PET_OWNER,
  })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: '2026-v1.0', length: 30 })
  acceptedPrivacyVersion: string;

  @Column({ type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  privacyAcceptedAt?: Date;

  // Stored with secure hash for refresh token rotation
  @Column({ nullable: true, select: false })
  refreshTokenHash?: string;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets: Pet[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
