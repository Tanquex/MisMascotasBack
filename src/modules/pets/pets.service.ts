import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Pet } from './entities/pet.entity';
import { PetMoment } from './entities/pet-moment.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { CreateMomentDto } from './dto/create-moment.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(PetMoment)
    private readonly momentRepository: Repository<PetMoment>,
    private readonly storageService: SupabaseStorageService,
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

  // ==========================================
  // MOMENTOS / RECUERDOS (Supabase Storage)
  // ==========================================

  async addMoment(
    petId: string,
    createMomentDto: CreateMomentDto,
    file: Express.Multer.File,
    currentUser: User,
  ): Promise<PetMoment> {
    const pet = await this.findOne(petId, currentUser);

    // Permisos: Solo el dueño o un ADMIN pueden agregar momentos a la mascota
    if (currentUser.role !== Role.ADMIN && pet.ownerId !== currentUser.id) {
      throw new ForbiddenException('No tienes permiso para agregar recuerdos a esta mascota');
    }

    if (!file || !file.buffer) {
      throw new BadRequestException('Se requiere una fotografía para inmortalizar el recuerdo');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagen no válido. Formatos soportados: JPG, PNG, WEBP, GIF',
      );
    }

    // Tamaño máximo: 10 MB
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('La imagen no puede exceder los 10 MB de tamaño');
    }

    // Generar ruta única en Supabase Storage: pets/{petId}/{timestamp}-{uuid}.ext
    const ext = file.originalname?.split('.').pop() || 'jpg';
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `pets/${petId}/${uniqueName}`;

    // Subida a Supabase
    const { publicUrl } = await this.storageService.uploadFile(
      'pet-photos',
      storagePath,
      file.buffer,
      file.mimetype,
    );

    // Persistencia en base de datos
    const moment = this.momentRepository.create({
      petId,
      title: createMomentDto.title,
      description: createMomentDto.description,
      photoUrl: publicUrl,
      storagePath,
      momentDate: createMomentDto.momentDate ? new Date(createMomentDto.momentDate) : new Date(),
    });

    return this.momentRepository.save(moment);
  }

  async getMoments(petId: string, currentUser: User): Promise<PetMoment[]> {
    // Validar acceso a la mascota
    await this.findOne(petId, currentUser);

    return this.momentRepository.find({
      where: { petId },
      order: {
        momentDate: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async deleteMoment(momentId: string, currentUser: User): Promise<{ message: string }> {
    const moment = await this.momentRepository.findOne({
      where: { id: momentId },
      relations: { pet: true },
    });

    if (!moment) {
      throw new NotFoundException('Recuerdo no encontrado');
    }

    // Permisos: Solo el dueño de la mascota o un ADMIN pueden borrarlo
    if (currentUser.role !== Role.ADMIN && moment.pet.ownerId !== currentUser.id) {
      throw new ForbiddenException('No tienes permiso para eliminar este recuerdo');
    }

    // Borrar de Supabase Storage si existe storagePath
    if (moment.storagePath) {
      await this.storageService.deleteFile('pet-photos', moment.storagePath);
    }

    await this.momentRepository.remove(moment);
    return { message: 'Recuerdo eliminado correctamente' };
  }
}
