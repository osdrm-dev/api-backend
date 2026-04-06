import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UploadBudgetDto {
  @ApiProperty({
    description: 'Libelle du tableau budgetaire',
    example: 'Budget 2026 Q2',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;
}
