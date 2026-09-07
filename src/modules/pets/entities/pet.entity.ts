import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';

export enum PetGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60 })
  name: string;

  @Index()
  @Column({ length: 40 })
  species: string; // e.g., Perro, Gato, Ave, etc.

  @Column({ length: 60, nullable: true })
  breed?: string; // Raza

  @Column({ type: 'date', nullable: true })
  birthDate?: Date;

  @Column({
    type: 'varchar',
    length: 10,
    default: PetGender.MALE,
  })
  gender: PetGender;

  @Column({ length: 40, nullable: true })
  color?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg?: number;

  @Index({ unique: true, sparse: true })
  @Column({ unique: true, nullable: true, length: 50 })
  microchipNumber?: string;

  @Column({ nullable: true, length: 500 })
  photoUrl?: string;

  @Column({ default: false })
  isSterilized: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => User, (user) => user.pets, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Index()
  @Column()
  ownerId: string;

  @OneToMany(() => MedicalRecord, (record) => record.pet)
  medicalRecords: MedicalRecord[];

  @OneToMany('PetMoment', 'pet')
  moments: any[];

  @Index()
  @Column({ nullable: true })
  groupId?: string;

  @ManyToOne('PetGroup', 'pets', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
