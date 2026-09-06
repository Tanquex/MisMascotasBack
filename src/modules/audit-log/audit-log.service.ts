import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';

export interface RecordAuditParams {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any> | string;
}

export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  action?: string;
  search?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async logEvent(params: RecordAuditParams): Promise<void> {
    try {
      const detailsStr =
        typeof params.details === 'object'
          ? JSON.stringify(params.details)
          : params.details;

      const log = this.auditRepository.create({
        ...params,
        details: detailsStr,
      });

      await this.auditRepository.save(log);
    } catch (err) {
      // Audit logging should never break core user flows, but must report to error output
      this.logger.error('Error recording audit log event', err);
    }
  }

  async findAll(options: AuditLogQueryOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepository.createQueryBuilder('log');

    if (options.action && options.action.trim() !== '') {
      qb.andWhere('log.action = :action', { action: options.action.trim() });
    }

    if (options.search && options.search.trim() !== '') {
      const search = `%${options.search.trim()}%`;
      qb.andWhere(
        '(LOWER(log.details) LIKE LOWER(:search) OR LOWER(log.ipAddress) LIKE LOWER(:search) OR LOWER(log.action) LIKE LOWER(:search) OR LOWER(log.resource) LIKE LOWER(:search))',
        { search },
      );
    }

    qb.orderBy('log.timestamp', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSystemStats() {
    const userRepo = this.dataSource.getRepository(User);
    const petRepo = this.dataSource.getRepository(Pet);

    // 1. User metrics
    const [totalUsers, activeUsers, usersByRoleRaw] = await Promise.all([
      userRepo.count(),
      userRepo.count({ where: { isActive: true } }),
      userRepo
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(u.id)', 'count')
        .groupBy('u.role')
        .getRawMany(),
    ]);

    const usersByRole = {
      admin: 0,
      veterinarian: 0,
      petOwner: 0,
    };
    usersByRoleRaw.forEach((item) => {
      if (item.role === 'ADMIN') usersByRole.admin = parseInt(item.count, 10);
      if (item.role === 'VETERINARIAN') usersByRole.veterinarian = parseInt(item.count, 10);
      if (item.role === 'PET_OWNER') usersByRole.petOwner = parseInt(item.count, 10);
    });

    // 2. Pet metrics
    const [totalPets, petsBySpeciesRaw] = await Promise.all([
      petRepo.count(),
      petRepo
        .createQueryBuilder('p')
        .select('p.species', 'species')
        .addSelect('COUNT(p.id)', 'count')
        .groupBy('p.species')
        .getRawMany(),
    ]);

    const petsBySpecies = petsBySpeciesRaw.map((p) => ({
      species: p.species,
      count: parseInt(p.count, 10),
    }));

    // 3. Security & Activity metrics
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalLogs,
      loginsSuccessToday,
      loginsFailedToday,
      totalSecurityAlerts,
      recentLogs,
    ] = await Promise.all([
      this.auditRepository.count(),
      this.auditRepository
        .createQueryBuilder('a')
        .where("a.action = 'LOGIN_SUCCESS' AND a.timestamp >= :today", {
          today: startOfToday,
        })
        .getCount(),
      this.auditRepository
        .createQueryBuilder('a')
        .where("a.action = 'LOGIN_FAILED' AND a.timestamp >= :today", {
          today: startOfToday,
        })
        .getCount(),
      this.auditRepository
        .createQueryBuilder('a')
        .where(
          "a.action IN ('LOGIN_FAILED', 'LOGIN_BLOCKED', 'SYSTEM_ERROR', 'SECURITY_ALERT', 'THROTTLE_BLOCKED')",
        )
        .getCount(),
      this.auditRepository.find({
        order: { timestamp: 'DESC' },
        take: 10,
      }),
    ]);

    // 4. System Health & Performance
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    const mem = process.memoryUsage();
    const heapUsedMB = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotalMB = Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100;
    const rssMB = Math.round((mem.rss / 1024 / 1024) * 100) / 100;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: totalUsers - activeUsers,
        byRole: usersByRole,
      },
      pets: {
        total: totalPets,
        bySpecies: petsBySpecies,
      },
      security: {
        totalLogs,
        loginsSuccessToday,
        loginsFailedToday,
        totalSecurityAlerts,
        recentLogs,
      },
      system: {
        status: 'OPERATIONAL',
        database: 'CONNECTED (PostgreSQL)',
        uptime: uptimeFormatted,
        uptimeSeconds: uptimeSec,
        memory: {
          heapUsedMB,
          heapTotalMB,
          rssMB,
        },
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development',
      },
    };
  }
}
