import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

export class CreateMomentDto {
  @ApiProperty({ example: 'Primer día en el parque', description: 'Título del momento especial' })
  @IsNotEmpty({ message: 'El título del momento es obligatorio' })
  @IsString({ message: 'El título debe ser un texto' })
  @MaxLength(100, { message: 'El título no puede superar los 100 caracteres' })
  title: string;

  @ApiPropertyOptional({
    example: 'Corrió por primera vez detrás de una pelota y no quería regresar.',
    description: 'Anécdota o descripción del momento',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '2026-09-06',
    description: 'Fecha en la que ocurrió el momento (formato YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha del momento debe ser una fecha válida (YYYY-MM-DD)' })
  momentDate?: string;
}
