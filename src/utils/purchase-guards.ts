import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';

/**
 * Vérifie que l'utilisateur connecté est bien l'acheteur responsable de la DA.
 * À appeler AVANT toute mutation liée à une étape acheteur (QR, PV, BC, BR, INVOICE, DAP, PROOF_OF_PAYMENT).
 */
export function assertIsOwningBuyer(
  purchase: { acheteurId?: number | null },
  userId: number,
): void {
  if (purchase.acheteurId !== userId) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.PURCHASE_NOT_OWNING_BUYER,
      'User is not the buyer responsible for this purchase',
    );
  }
}
