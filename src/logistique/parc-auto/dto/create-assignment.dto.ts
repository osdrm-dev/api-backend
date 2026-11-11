import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Identifiant du chauffeur (rôle DRIVER)' })
  @Type(() => Number)
  @IsInt()
  driverId: number;

  @ApiPropertyOptional({
    description:
      "Date de début de l'affectation (ISO 8601), défaut : maintenant",
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
