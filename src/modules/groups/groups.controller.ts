import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Pet Groups & Families')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva familia o grupo de mascotas' })
  @ApiResponse({ status: 201, description: 'Familia creada exitosamente con código de invitación único' })
  create(
    @Body() createGroupDto: CreateGroupDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.create(createGroupDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las familias y grupos a los que pertenece el usuario' })
  findAll(@CurrentUser() currentUser: User) {
    return this.groupsService.findAllForUser(currentUser);
  }

  @Post('join')
  @ApiOperation({ summary: 'Unirse a una familia mediante código de invitación' })
  @ApiResponse({ status: 200, description: 'Unido a la familia exitosamente' })
  @ApiResponse({ status: 404, description: 'Código de invitación no válido' })
  join(
    @Body() joinGroupDto: JoinGroupDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.join(joinGroupDto, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de la familia, miembros y mascotas asociadas' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.findOne(id, currentUser);
  }

  @Patch(':id/pets/:petId')
  @ApiOperation({ summary: 'Asignar una mascota a la familia' })
  assignPet(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.assignPet(id, petId, currentUser);
  }

  @Delete(':id/pets/:petId')
  @ApiOperation({ summary: 'Desvincular una mascota de la familia' })
  unassignPet(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.unassignPet(id, petId, currentUser);
  }

  @Get(':id/feed')
  @ApiOperation({ summary: 'Obtener el muro / feed unificado de recuerdos de todas las mascotas de la familia' })
  getGroupFeed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.getGroupFeed(id, currentUser);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Salir de la familia o expulsar a un miembro (Solo creador)' })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.removeMember(id, userId, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una familia (Solo creador)' })
  deleteGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.groupsService.deleteGroup(id, currentUser);
  }
}
