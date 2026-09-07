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
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { CreateMomentDto } from './dto/create-moment.dto';
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

  // ==========================================
  // MOMENTOS / RECUERDOS (Supabase Storage)
  // ==========================================

  @Post(':petId/moments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Inmortalizar un nuevo recuerdo fotográfico de la mascota' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Fotografía del recuerdo (JPG/PNG/WEBP)' },
        title: { type: 'string', example: 'Primer día en casa' },
        description: { type: 'string', example: 'Exploró toda la sala y se durmió en su camita.' },
        momentDate: { type: 'string', format: 'date', example: '2026-09-06' },
      },
      required: ['file', 'title'],
    },
  })
  @ApiResponse({ status: 201, description: 'Recuerdo guardado exitosamente con URL de Supabase' })
  addMoment(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() createMomentDto: CreateMomentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.addMoment(petId, createMomentDto, file, currentUser);
  }

  @Get(':petId/moments')
  @ApiOperation({ summary: 'Obtener la galería cronológica de recuerdos de una mascota' })
  @ApiResponse({ status: 200, description: 'Listado de momentos ordenados del más reciente al más antiguo' })
  getMoments(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.getMoments(petId, currentUser);
  }

  @Delete('moments/:momentId')
  @ApiOperation({ summary: 'Eliminar un recuerdo fotográfico' })
  @ApiResponse({ status: 200, description: 'Recuerdo y fotografía eliminados' })
  deleteMoment(
    @Param('momentId', ParseUUIDPipe) momentId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.petsService.deleteMoment(momentId, currentUser);
  }
}
