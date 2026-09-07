import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { PetGroup } from './entities/pet-group.entity';
import { GroupMember, GroupRole } from './entities/group-member.entity';
import { Pet } from '../pets/entities/pet.entity';
import { PetMoment } from '../pets/entities/pet-moment.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(PetGroup)
    private readonly groupRepository: Repository<PetGroup>,
    @InjectRepository(GroupMember)
    private readonly memberRepository: Repository<GroupMember>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(PetMoment)
    private readonly momentRepository: Repository<PetMoment>,
  ) {}

  /**
   * Genera un código de invitación único tipo FAM-XXXX
   */
  private async generateUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const code = `FAM-${randomNum}`;
      const exists = await this.groupRepository.findOne({ where: { inviteCode: code } });
      if (!exists) return code;
    }
    return `FAM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Crea una nueva familia/grupo y añade al creador como OWNER
   */
  async create(createGroupDto: CreateGroupDto, currentUser: User): Promise<PetGroup> {
    const inviteCode = await this.generateUniqueInviteCode();

    const group = this.groupRepository.create({
      name: createGroupDto.name.trim(),
      description: createGroupDto.description?.trim(),
      inviteCode,
      ownerId: currentUser.id,
    });

    const savedGroup = await this.groupRepository.save(group);

    // Añadir al creador como miembro OWNER
    const member = this.memberRepository.create({
      groupId: savedGroup.id,
      userId: currentUser.id,
      role: GroupRole.OWNER,
    });
    await this.memberRepository.save(member);

    return this.findOne(savedGroup.id, currentUser);
  }

  /**
   * Obtiene todos los grupos a los que pertenece el usuario actual
   */
  async findAllForUser(currentUser: User): Promise<any[]> {
    const memberships = await this.memberRepository.find({
      where: { userId: currentUser.id },
      relations: {
        group: {
          owner: true,
          pets: true,
          members: {
            user: true,
          },
        },
      },
      order: { joinedAt: 'DESC' },
    });

    return memberships.map((m) => {
      const g = m.group;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        inviteCode: g.inviteCode,
        ownerId: g.ownerId,
        ownerName: g.owner?.fullName,
        myRole: m.role,
        membersCount: g.members?.length || 0,
        petsCount: g.pets?.length || 0,
        pets: g.pets || [],
        members: (g.members || []).map((mb: any) => ({
          userId: mb.userId,
          fullName: mb.user?.fullName,
          email: mb.user?.email,
          role: mb.role,
          joinedAt: mb.joinedAt,
        })),
        createdAt: g.createdAt,
      };
    });
  }

  /**
   * Obtiene el detalle de un grupo
   */
  async findOne(id: string, currentUser: User): Promise<any> {
    const group = await this.groupRepository.findOne({
      where: { id },
      relations: {
        owner: true,
        pets: true,
        members: {
          user: true,
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Familia o grupo no encontrado');
    }

    const isMember = group.members?.some((m) => m.userId === currentUser.id);
    if (!isMember && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes acceso a este grupo o familia');
    }

    const myMembership = group.members?.find((m) => m.userId === currentUser.id);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
      ownerName: group.owner?.fullName,
      myRole: myMembership?.role || GroupRole.MEMBER,
      pets: group.pets || [],
      members: (group.members || []).map((mb: any) => ({
        userId: mb.userId,
        fullName: mb.user?.fullName,
        email: mb.user?.email,
        role: mb.role,
        joinedAt: mb.joinedAt,
      })),
      createdAt: group.createdAt,
    };
  }

  /**
   * Unirse a una familia mediante código de invitación
   */
  async join(joinGroupDto: JoinGroupDto, currentUser: User): Promise<any> {
    const code = joinGroupDto.inviteCode.trim().toUpperCase();

    const group = await this.groupRepository.findOne({
      where: { inviteCode: code },
      relations: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Código de invitación no válido o la familia no existe');
    }

    const alreadyMember = group.members?.some((m) => m.userId === currentUser.id);
    if (alreadyMember) {
      throw new ConflictException('Ya formas parte de esta familia');
    }

    const newMember = this.memberRepository.create({
      groupId: group.id,
      userId: currentUser.id,
      role: GroupRole.MEMBER,
    });
    await this.memberRepository.save(newMember);

    return this.findOne(group.id, currentUser);
  }

  /**
   * Asocia una mascota a una familia
   */
  async assignPet(groupId: string, petId: string, currentUser: User): Promise<{ message: string }> {
    const group = await this.findOne(groupId, currentUser);
    const pet = await this.petRepository.findOne({ where: { id: petId } });

    if (!pet) {
      throw new NotFoundException('Mascota no encontrada');
    }

    // Solo el dueño de la mascota o un ADMIN pueden asignarla a una familia
    if (pet.ownerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo el dueño registrado de la mascota puede asignarla a una familia');
    }

    pet.groupId = groupId;
    await this.petRepository.save(pet);

    return { message: `Mascota "${pet.name}" asignada a la familia "${group.name}" correctamente` };
  }

  /**
   * Desvincula una mascota de la familia
   */
  async unassignPet(groupId: string, petId: string, currentUser: User): Promise<{ message: string }> {
    await this.findOne(groupId, currentUser);
    const pet = await this.petRepository.findOne({ where: { id: petId } });

    if (!pet) {
      throw new NotFoundException('Mascota no encontrada');
    }

    if (pet.ownerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permiso para desvincular esta mascota');
    }

    pet.groupId = null as any;
    await this.petRepository.save(pet);

    return { message: 'Mascota desvinculada de la familia correctamente' };
  }

  /**
   * Elimina a un miembro o permite salir de la familia
   */
  async removeMember(groupId: string, targetUserId: string, currentUser: User): Promise<{ message: string }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Familia no encontrada');
    }

    const isSelf = currentUser.id === targetUserId;
    const isOwner = group.ownerId === currentUser.id;

    if (!isSelf && !isOwner && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permisos para expulsar miembros de esta familia');
    }

    if (isOwner && isSelf && group.members.length > 1) {
      throw new BadRequestException('Como creador de la familia, debes transferir la propiedad o eliminar la familia completa');
    }

    await this.memberRepository.delete({ groupId, userId: targetUserId });

    // Si no quedan miembros, eliminar el grupo
    const remaining = await this.memberRepository.count({ where: { groupId } });
    if (remaining === 0) {
      await this.deleteGroup(groupId, currentUser);
    }

    return { message: isSelf ? 'Has salido de la familia' : 'Miembro retirado de la familia' };
  }

  /**
   * Elimina la familia (las mascotas vuelven a ser privadas individuales)
   */
  async deleteGroup(groupId: string, currentUser: User): Promise<{ message: string }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Familia no encontrada');
    }

    if (group.ownerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo el creador de la familia puede eliminarla');
    }

    // Desvincular mascotas del grupo (pasan a groupId: null)
    await this.petRepository.update({ groupId }, { groupId: null as any });

    await this.groupRepository.remove(group);
    return { message: 'Familia eliminada correctamente' };
  }

  /**
   * Obtiene el feed unificado de fotos/momentos de todas las mascotas de la familia
   */
  async getGroupFeed(groupId: string, currentUser: User): Promise<any[]> {
    await this.findOne(groupId, currentUser);

    // Obtener las mascotas de este grupo
    const pets = await this.petRepository.find({ where: { groupId } });
    if (pets.length === 0) {
      return [];
    }

    const petIds = pets.map((p) => p.id);

    const moments = await this.momentRepository.find({
      where: { petId: In(petIds) },
      relations: { pet: true },
      order: { momentDate: 'DESC', createdAt: 'DESC' },
    });

    return moments.map((m) => ({
      id: m.id,
      petId: m.petId,
      petName: m.pet?.name,
      petSpecies: m.pet?.species,
      petPhotoUrl: m.pet?.photoUrl,
      title: m.title,
      description: m.description,
      photoUrl: m.photoUrl,
      momentDate: m.momentDate,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Obtiene los IDs de grupos a los que pertenece el usuario (helper para PetsService)
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const members = await this.memberRepository.find({
      where: { userId },
      select: { groupId: true },
    });
    return members.map((m) => m.groupId);
  }
}
