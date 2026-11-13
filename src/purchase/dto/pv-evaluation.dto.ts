import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

// Content is validated in PVEvaluationService (needs the PV supplier ids).
export class SavePVEvaluationDto {
  @ApiPropertyOptional({ description: '{ supplierId: { critere: reponse } }' })
  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;

  @ApiPropertyOptional({ description: '{ critere: commentaire }' })
  @IsOptional()
  @IsObject()
  criteriaComments?: Record<string, any>;
}

export class WaivePVEvaluationDto {
  @ApiProperty({ description: 'Motif de la dispense' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
