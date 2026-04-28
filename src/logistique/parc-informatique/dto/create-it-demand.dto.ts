import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItDemandDto {
  @ApiPropertyOptional({ description: 'ID de la catégorie souhaitée' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: "Type d'équipement désiré", example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  desiredType!: string;

  @ApiProperty({ description: 'Quantité demandée', example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Justification de la demande' })
  @IsString()
  @IsNotEmpty()
  justification!: string;
}
