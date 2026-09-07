import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PetGroup } from './entities/pet-group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Pet } from '../pets/entities/pet.entity';
import { PetMoment } from '../pets/entities/pet-moment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PetGroup, GroupMember, Pet, PetMoment])],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
