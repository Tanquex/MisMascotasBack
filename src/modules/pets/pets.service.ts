import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  async create(createPetDto: CreatePetDto, currentUser: User): Promise<Pet> {
    let targetOwnerId = currentUser.id;

    // Only ADMIN or VETERINARIAN can register pets for other users
    if (createPetDto.ownerId) {
      if (
        currentUser.role !== Role.ADMIN &&
        currentUser.role !== Role.VETERINARIAN
      ) {
        throw new ForbiddenException(
          'No tienes permisos para registrar mascotas a nombre de otro usuario',
        );
      }
      targetOwnerId = createPetDto.ownerId;
    }

    // Check unique microchip
    if (createPetDto.microchipNumber) {
      const existing = await this.petRepository.findOne({
        where: { microchipNumber: createPetDto.microchipNumber.trim() },
      });
      if (existing) {
        throw new ConflictException(
          'Ya existe una mascota registrada con este número de microchip',
        );
      }
    }

    const pet = this.petRepository.create({
      ...createPetDto,
      birthDate: createPetDto.birthDate ? new Date(createPetDto.birthDate) : undefined,
      ownerId: targetOwnerId,
    });

    return this.petRepository.save(pet);
  }

  async findAll(
    currentUser: User,
    search?: string,
    species?: string,
  ): Promise<Pet[]> {
    const qb = this.petRepository
      .createQueryBuilder('pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .orderBy('pet.createdAt', 'DESC');

    // Data isolation: Pet owners only see their own pets
    if (currentUser.role === Role.PET_OWNER) {
      qb.where('pet.ownerId = :ownerId', { ownerId: currentUser.id });
    }

    if (species) {
      qb.andWhere('LOWER(pet.species) = LOWER(:species)', { species });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(pet.name) LIKE LOWER(:search) OR LOWER(pet.microchipNumber) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: string, currentUser: User): Promise<Pet> {
    const pet = await this.petRepository.findOne({
      where: { id },
      relations: { owner: true, medicalRecords: true },
    });

    if (!pet) {
      throw new NotFoundException(`Mascota con ID ${id} no encontrada`);
    }

    // Authorization check
    if (
      currentUser.role === Role.PET_OWNER &&
      pet.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('No tienes acceso a esta mascota');
    }

    return pet;
  }

  async update(
    id: string,
    updatePetDto: UpdatePetDto,
    currentUser: User,
  ): Promise<Pet> {
    const pet = await this.findOne(id, currentUser);

    // Validate microchip uniqueness if changing
    if (
      updatePetDto.microchipNumber &&
      updatePetDto.microchipNumber !== pet.microchipNumber
    ) {
      const existing = await this.petRepository.findOne({
        where: { microchipNumber: updatePetDto.microchipNumber.trim() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Ya existe una mascota con ese número de microchip',
        );
      }
    }

    Object.assign(pet, {
      ...updatePetDto,
      birthDate: updatePetDto.birthDate
        ? new Date(updatePetDto.birthDate)
        : pet.birthDate,
    });

    return this.petRepository.save(pet);
  }

  async remove(id: string, currentUser: User): Promise<{ message: string }> {
    const pet = await this.findOne(id, currentUser);

    // Only ADMIN or the verified OWNER can delete
    if (
      currentUser.role !== Role.ADMIN &&
      pet.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('No tienes permiso para eliminar esta mascota');
    }

    await this.petRepository.remove(pet);
    return { message: 'Mascota eliminada correctamente' };
  }
}
