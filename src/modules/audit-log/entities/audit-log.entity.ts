import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  userId?: string;

  @Index()
  @Column({ length: 60 })
  action: string; // e.g. LOGIN_SUCCESS, LOGIN_FAILED, PET_CREATED, USER_UPDATED

  @Column({ length: 60 })
  resource: string; // e.g. Auth, Pets, Users

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  @Column({ nullable: true, length: 255 })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @CreateDateColumn()
  timestamp: Date;
}
