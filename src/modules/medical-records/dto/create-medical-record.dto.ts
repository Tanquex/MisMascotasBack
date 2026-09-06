import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicalRecordDto {
  @ApiProperty({ description: 'ID de la mascota' })
  @IsUUID()
  @IsNotEmpty({ message: 'El ID de la mascota es obligatorio' })
  petId: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString({}, { message: 'Fecha de visita inválida (AAAA-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha de visita es requerida' })
  visitDate: string;

  @ApiProperty({ example: 'Vacunación anual y chequeo general' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de consulta es requerido' })
  @MaxLength(150)
  reason: string;

  @ApiProperty({ example: 'Paciente sano, sin anomalías' })
  @IsString()
  @IsNotEmpty({ message: 'El diagnóstico es requerido' })
  diagnosis: string;

  @ApiProperty({ example: 'Aplicación de vacuna séxtuple y desparasitación' })
  @IsString()
  @IsNotEmpty({ message: 'El tratamiento aplicado es requerido' })
  treatment: string;

  @ApiPropertyOptional({ example: 'Nexgard Spectra 1 tableta masticable mensual' })
  @IsOptional()
  @IsString()
  prescriptions?: string;

  @ApiPropertyOptional({ example: '2027-03-01' })
  @IsOptional()
  @IsDateString()
  nextAppointmentDate?: string;
}
