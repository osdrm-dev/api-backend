import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';

export class CreatePVSupplierItemDto {
  @IsOptional()
  @IsString()
  purchaseItemId?: string;

  @IsString()
  designation: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  disponibilite?: string;
}

export class CreatePVSupplierDto {
  @IsString()
  supplierId: string;

  @IsInt()
  @Min(1)
  @Max(3)
  order: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  rang?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePVSupplierItemDto)
  items?: CreatePVSupplierItemDto[];
}

export class CreatePVDto {
  @IsOptional()
  @IsString()
  evaluateur?: string;

  @IsOptional()
  @IsDateString()
  dateEvaluation?: string;

  @IsOptional()
  @IsString()
  natureObjet?: string;

  @IsOptional()
  @IsString()
  decisionFinale?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePVSupplierDto)
  suppliers: CreatePVSupplierDto[];
}
