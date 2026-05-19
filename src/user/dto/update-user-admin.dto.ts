import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserAdminDto {
  @ApiProperty({ example: 'Jean Dupont', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 'jean.dupont@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Responsable Achats', required: false })
  @IsOptional()
  @IsString()
  fonction?: string;

  @ApiProperty({ enum: Role, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
