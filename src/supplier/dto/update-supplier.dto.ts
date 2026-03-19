import { IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() stat?: string;
  @IsOptional() @IsString() rcs?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
