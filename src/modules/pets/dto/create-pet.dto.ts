import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PetGender } from '../entities/pet.entity';

export class CreatePetDto {
  @ApiProperty({ example: 'Max' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la mascota es requerido' })
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 'Perro' })
  @IsString()
  @IsNotEmpty({ message: 'La especie es requerida' })
  @MaxLength(40)
  species: string;

  @ApiPropertyOptional({ example: 'Golden Retriever' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breed?: string;

  @ApiPropertyOptional({ example: '2022-04-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Formato de fecha inválido (AAAA-MM-DD)' })
  birthDate?: string;

  @ApiPropertyOptional({ enum: PetGender, default: PetGender.MALE })
  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @ApiPropertyOptional({ example: 'Dorado' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ example: 28.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: '985141001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  microchipNumber?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSterilized?: boolean;

  @ApiPropertyOptional({ example: 'Alergia al pollo' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID del dueño (Solo requerido si el creador es ADMIN o VET)' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
