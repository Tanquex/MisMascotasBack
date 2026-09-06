import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Token de refresco para generar un nuevo access token' })
  @IsString()
  @IsNotEmpty({ message: 'El refreshToken es obligatorio' })
  refreshToken: string;
}
