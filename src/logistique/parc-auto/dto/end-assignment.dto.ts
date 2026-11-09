import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class EndAssignmentDto {
  @ApiPropertyOptional({
    description: "Date de fin de l'affectation (ISO 8601), défaut : maintenant",
    example: '2026-10-15',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
