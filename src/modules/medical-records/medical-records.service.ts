import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { PetsService } from '../pets/pets.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly recordRepository: Repository<MedicalRecord>,
    private readonly petsService: PetsService,
  ) {}

  async create(
    createDto: CreateMedicalRecordDto,
    veterinarian: User,
  ): Promise<MedicalRecord> {
    // Verify pet exists
    await this.petsService.findOne(createDto.petId, veterinarian);

    const record = this.recordRepository.create({
      ...createDto,
      visitDate: new Date(createDto.visitDate),
      nextAppointmentDate: createDto.nextAppointmentDate
        ? new Date(createDto.nextAppointmentDate)
        : undefined,
      veterinarianId: veterinarian.id,
    });

    return this.recordRepository.save(record);
  }

  async findByPetId(petId: string, currentUser: User): Promise<MedicalRecord[]> {
    // Verify user has access to pet
    await this.petsService.findOne(petId, currentUser);

    return this.recordRepository.find({
      where: { petId },
      order: { visitDate: 'DESC' },
    });
  }

  async findOne(id: string, currentUser: User): Promise<MedicalRecord> {
    const record = await this.recordRepository.findOne({
      where: { id },
      relations: { pet: true },
    });

    if (!record) {
      throw new NotFoundException(`Expediente médico con ID ${id} no encontrado`);
    }

    if (
      currentUser.role === Role.PET_OWNER &&
      record.pet.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('No tienes acceso a este expediente médico');
    }

    return record;
  }
}
