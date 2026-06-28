import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LgLiquidationValidationStatus } from '@prisma/client';

/**
 * Décision d'un valideur sur une ligne de validation de liquidation.
 * Seules les valeurs VALIDEE et REJETEE sont acceptées (pas de retour à EN_ATTENTE
 * via cet endpoint).
 * Le commentaire est OPTIONNEL dans tous les cas (décision actée n°4).
 */
export class DecideLiquidationValidationDto {
  @ApiProperty({
    enum: [
      LgLiquidationValidationStatus.VALIDEE,
      LgLiquidationValidationStatus.REJETEE,
    ],
    example: LgLiquidationValidationStatus.VALIDEE,
    description: 'Décision du valideur : VALIDEE ou REJETEE',
  })
  @IsEnum(LgLiquidationValidationStatus, {
    message: 'La décision doit être VALIDEE ou REJETEE.',
  })
  decision: LgLiquidationValidationStatus;

  @ApiPropertyOptional({
    example: 'Montant du transport à justifier.',
    description: 'Commentaire optionnel (motif de rejet ou note de validation)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;
}
