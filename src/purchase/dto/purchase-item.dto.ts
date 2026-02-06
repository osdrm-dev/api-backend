import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @ApiProperty({
    description: "Designation de l'article",
    example: 'Laptop Dell XPS 15',
  })
  @IsString()
  @IsNotEmpty()
  designation: string;

  @ApiProperty({
    description: 'Quantite',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Prix unitaire en MGA',
    example: 2000000,
    minimum: 0,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Unite de mesure',
    example: 'piece',
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Specifications techniques',
    example: 'Intel i7, 16GB RAM, 512GB SSD',
  })
  @IsString()
  @IsOptional()
  specifications?: string;
}

export class AddPurchaseItemsDto {
  @ApiProperty({
    description: 'Liste des articles',
    type: [PurchaseItemDto],
    example: [
      {
        designation: 'Laptop Dell XPS 15',
        quantity: 5,
        unitPrice: 2000000,
        unit: 'piece',
        specifications: 'Intel i7, 16GB RAM, 512GB SSD',
      },
    ],
  })
  @IsNotEmpty()
  items: PurchaseItemDto[];
}
