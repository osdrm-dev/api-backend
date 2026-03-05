import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class SupplierItemDto {
  @IsOptional()
  @IsString()
  purchaseItemId?: string;

  @IsString()
  designation: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsString()
  disponibilite?: string;
}

export class AddSupplierItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierItemDto)
  items: SupplierItemDto[];
}
