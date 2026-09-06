import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';

// Common Providers
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Feature Modules
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PetsModule } from './modules/pets/pets.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';

// Entities
import { User } from './modules/users/entities/user.entity';
import { Pet } from './modules/pets/entities/pet.entity';
import { MedicalRecord } from './modules/medical-records/entities/medical-record.entity';
import { AuditLog } from './modules/audit-log/entities/audit-log.entity';

@Module({
  imports: [
    // Centralized environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate Limiting (DDoS & Brute Force Protection)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttl', 60) * 1000,
          limit: config.get<number>('throttler.limit', 100),
        },
      ],
    }),

    // Relational Database with TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbConfig = config.get('database');
        const isSsl =
          dbConfig.ssl ||
          process.env.DB_SSL === 'true' ||
          (dbConfig.url && dbConfig.url.includes('supabase'));
        const sslOptions = isSsl ? { rejectUnauthorized: false } : false;

        const baseOptions = {
          type: 'postgres' as const,
          entities: [User, Pet, MedicalRecord, AuditLog],
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          ssl: sslOptions,
          extra: isSsl ? { ssl: sslOptions } : undefined,
        };

        if (dbConfig.url) {
          return {
            ...baseOptions,
            url: dbConfig.url,
          };
        }

        return {
          ...baseOptions,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
        };
      },
    }),

    // Application Modules
    AuditLogModule,
    UsersModule,
    AuthModule,
    PetsModule,
    MedicalRecordsModule,
  ],
  providers: [
    // Global Exception Filter to prevent internal server error leakage
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global Throttler Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT Authentication Guard (Routes are protected by default, marked with @Public() to exempt)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Response Transformer
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    // Global Logging Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
