import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Familia Ramírez', description: 'Nombre de la familia u hogar' })
  @IsNotEmpty({ message: 'El nombre de la familia o grupo es obligatorio' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(80, { message: 'El nombre no puede superar los 80 caracteres' })
  name: string;

  @ApiPropertyOptional({
    example: 'Hogar de nuestras mascotas consentidas en CDMX',
    description: 'Descripción opcional de la familia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar los 255 caracteres' })
  description?: string;
}
