import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateDerogationDto {
  @ApiProperty({
    description: 'Raison de la derogation',
    example:
      'Devis insuffisants - Seulement 2 fournisseurs disponibles dans la region',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: 'Justification detaillee',
    example:
      "Marche tres specifique avec peu de fournisseurs qualifies. Les deux devis obtenus representent l'ensemble du marche disponible.",
  })
  @IsString()
  @IsNotEmpty()
  justification: string;
}

export class UpdateDerogationDto {
  @ApiPropertyOptional({
    description: 'Raison de la derogation',
    example: 'Devis insuffisants - Seulement 2 fournisseurs disponibles',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Justification detaillee',
    example: 'Mise a jour de la justification',
  })
  @IsString()
  @IsOptional()
  justification?: string;
}

export class ValidateDerogationDto {
  @ApiProperty({
    description: 'Decision de validation',
    example: true,
  })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({
    description: 'Commentaires du validateur',
    example: 'Derogation approuvee compte tenu des circonstances',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
