import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmMissionDto {
  @ApiProperty({ example: 75000, description: 'Montant du per diem en Ariary' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  perDiemAmount: number;

  @ApiPropertyOptional({ example: "Contacter le chef de projet à l'arrivée." })
  @IsOptional()
  @IsString()
  additionalInstructions?: string;
}
