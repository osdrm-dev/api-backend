import { IsOptional, IsString } from 'class-validator';

export class ValidatePurchaseDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
