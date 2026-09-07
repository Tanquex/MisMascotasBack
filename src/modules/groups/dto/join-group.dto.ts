import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class JoinGroupDto {
  @ApiProperty({ example: 'FAM-7492', description: 'Código único de invitación a la familia' })
  @IsNotEmpty({ message: 'El código de invitación es obligatorio' })
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @Length(4, 12, { message: 'El código debe tener entre 4 y 12 caracteres' })
  inviteCode: string;
}
