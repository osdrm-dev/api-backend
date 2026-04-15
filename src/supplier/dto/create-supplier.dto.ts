import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { SupplierActiveStatus } from '@prisma/client';

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsString()
  status: string;

  @IsString()
  nif: string;

  @IsString()
  stat: string;

  @IsString()
  rcs: string;

  @IsString()
  region: string;

  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
