import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { CreatePurchaseDto } from './create-purchase.dto';
import { AddPurchaseItemsDto } from './purchase-item.dto';

export class UpdateAndRepublishDto {
  @ApiProperty({
    description: 'Informations de la DA (imputation, titre, etc.)',
    type: CreatePurchaseDto,
  })
  @ValidateNested()
  @Type(() => CreatePurchaseDto)
  purchase: CreatePurchaseDto;

  @ApiPropertyOptional({
    description:
      'Articles de la DA (optionnel, si non fourni, les items existants sont conserves)',
    type: AddPurchaseItemsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddPurchaseItemsDto)
  items?: AddPurchaseItemsDto;
}
