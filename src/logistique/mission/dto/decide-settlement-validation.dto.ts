import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LgSettlementValidationStatus } from '@prisma/client';

/**
 * Décision d'un valideur sur une ligne de validation de settlement.
 * Seules les valeurs APPROVED et REJECTED sont acceptées (pas de retour à PENDING
 * via cet endpoint).
 * Le comment est OPTIONNEL dans tous les cas (décision actée n°4).
 */
export class DecideSettlementValidationDto {
  @ApiProperty({
    enum: [
      LgSettlementValidationStatus.APPROVED,
      LgSettlementValidationStatus.REJECTED,
    ],
    example: LgSettlementValidationStatus.APPROVED,
    description: 'Décision du valideur : APPROVED ou REJECTED',
  })
  @IsEnum(LgSettlementValidationStatus, {
    message: 'La décision doit être APPROVED ou REJECTED.',
  })
  decision: LgSettlementValidationStatus;

  @ApiPropertyOptional({
    example: 'Montant du transport à justifier.',
    description: 'Commentaire optionnel (motif de rejet ou note de validation)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
