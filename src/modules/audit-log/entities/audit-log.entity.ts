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

  @Column({ length: 255 })
  resource: string; // e.g. Auth, Pets, Users, or endpoint route

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ length: 255, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @CreateDateColumn()
  timestamp: Date;
}
