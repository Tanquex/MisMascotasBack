import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from './pet.entity';

@Entity('pet_moments')
export class PetMoment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  petId: string;

  @ManyToOne(() => Pet, (pet) => pet.moments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 600 })
  photoUrl: string;

  @Column({ length: 300, nullable: true })
  storagePath?: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  momentDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
