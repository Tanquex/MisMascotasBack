import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Pets')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva mascota' })
  @ApiResponse({ status: 201, description: 'Mascota registrada exitosamente' })
  create(
    @Body() createPetDto: CreatePetDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.create(createPetDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mascotas (Filtradas según rol y permisos)' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por nombre o microchip' })
  @ApiQuery({ name: 'species', required: false, description: 'Filtrar por especie (Perro, Gato, etc.)' })
  findAll(
    @CurrentUser() currentUser: User,
    @Query('search') search?: string,
    @Query('species') species?: string,
  ) {
    return this.petsService.findAll(currentUser, search, species);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle completo de una mascota' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de una mascota' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePetDto: UpdatePetDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.update(id, updatePetDto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar registro de una mascota' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.remove(id, currentUser);
  }
}
