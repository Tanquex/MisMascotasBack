import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { PetGroup } from './pet-group.entity';
import { User } from '../../users/entities/user.entity';

export enum GroupRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

@Entity('group_members')
@Unique(['groupId', 'userId'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  groupId: string;

  @ManyToOne(() => PetGroup, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: PetGroup;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'varchar',
    length: 20,
    default: GroupRole.MEMBER,
  })
  role: GroupRole;

  @CreateDateColumn()
  joinedAt: Date;
}
