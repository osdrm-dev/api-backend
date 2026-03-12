import { IsArray, IsString } from 'class-validator';

export class SelectSupplierItemsDto {
  @IsArray()
  @IsString({ each: true })
  itemIds: string[];
}
