import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Audit & Monitoring')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Consultar bitácora de auditoría y logs del sistema (Solo administradores)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs de auditoría' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogService.findAll({ page, limit, action, search });
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Obtener métricas del sistema, estadísticas de salud y monitoreo (Solo administradores)' })
  @ApiResponse({ status: 200, description: 'Estadísticas globales de usuarios, mascotas, seguridad y servidor' })
  getStats() {
    return this.auditLogService.getSystemStats();
  }
}
