import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { SupplierActiveStatus } from '@prisma/client';

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() stat?: string;
  @IsOptional() @IsString() rcs?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPosition?: string;
  @IsOptional() @IsString() languages?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional()
  @IsEnum(SupplierActiveStatus)
  activeStatus?: SupplierActiveStatus;
}
