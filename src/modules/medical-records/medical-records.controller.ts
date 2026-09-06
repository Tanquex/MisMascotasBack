import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Medical Records')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly recordsService: MedicalRecordsService) {}

  @Post()
  @Roles(Role.VETERINARIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Registrar nueva consulta o vacuna (Solo Veterinarios o Admin)' })
  @ApiResponse({ status: 201, description: 'Expediente registrado exitosamente' })
  create(
    @Body() createDto: CreateMedicalRecordDto,
    @CurrentUser() user: User,
  ) {
    return this.recordsService.create(createDto, user);
  }

  @Get('pet/:petId')
  @ApiOperation({ summary: 'Obtener historial médico de una mascota' })
  findByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: User,
  ) {
    return this.recordsService.findByPetId(petId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un expediente específico' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.recordsService.findOne(id, user);
  }
}
