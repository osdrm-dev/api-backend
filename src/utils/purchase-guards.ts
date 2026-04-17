import { ForbiddenException } from '@nestjs/common';

/**
 * Vérifie que l'utilisateur connecté est bien l'acheteur responsable de la DA.
 * À appeler AVANT toute mutation liée à une étape acheteur (QR, PV, BC, BR, INVOICE, DAP, PROOF_OF_PAYMENT).
 */
export function assertIsOwningBuyer(
  purchase: { acheteurId?: number | null },
  userId: number,
): void {
  if (purchase.acheteurId !== userId) {
    throw new ForbiddenException(
      "Vous n'êtes pas l'acheteur responsable de cette demande.",
    );
  }
}
