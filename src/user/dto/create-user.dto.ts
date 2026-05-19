import { IsEmail, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'jean.dupont@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Responsable Achats' })
  @IsString()
  @IsNotEmpty()
  fonction: string;

  @ApiProperty({ enum: Role, example: Role.DEMANDEUR })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
