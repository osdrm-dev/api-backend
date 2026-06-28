import { VehicleDocument, VehicleDocumentType } from '@prisma/client';

/**
 * Statut de rappel surfacé côté API mobile / cron.
 * Ordre de gravité (du pire au meilleur) : EXPIRE > BIENTOT > INCONNU > OK.
 */
export type ReminderStatus = 'OK' | 'BIENTOT' | 'EXPIRE' | 'INCONNU';

/**
 * Seuil "BIENTOT" pour l'API "Mes véhicules" (préavis conducteur).
 * Distinct des seuils du cron ADMIN (ALERT_THRESHOLDS = [30, 15, 7, 0]).
 * Voir FR-11 / FR-14.
 */
export const REMINDER_THRESHOLD_DAYS = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Entrée de rappel calculée pour un type de document donné.
 */
export interface DocumentReminder {
  documentType: VehicleDocumentType;
  reference: string | null;
  dateExpiration: Date | null;
  daysUntilExpiration: number | null;
  reminderStatus: ReminderStatus;
}

/**
 * Ramène une date au début de journée (minuit, fuseau serveur) afin que le
 * calcul du nombre de jours restants soit cohérent et déterministe
 * (même troncature partout). Mutualisé entre l'API mobile et le cron (FR-14).
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Différence en jours (tronquée) entre la date d'expiration et aujourd'hui.
 * Négatif si le document est déjà expiré. `null` si aucune date d'expiration.
 *
 * @param dateExpiration date d'expiration du document, ou null
 * @param now date de référence (par défaut : maintenant). Injectable pour les tests.
 */
export function computeDaysUntilExpiration(
  dateExpiration: Date | null,
  now: Date = new Date(),
): number | null {
  if (!dateExpiration) {
    return null;
  }

  const expirationDay = startOfDay(dateExpiration).getTime();
  const today = startOfDay(now).getTime();

  return Math.round((expirationDay - today) / MS_PER_DAY);
}

/**
 * Mappe un nombre de jours restants en statut de rappel.
 * Le seuil "BIENTOT" est passé en paramètre afin que l'API mobile utilise 20
 * tandis que le cron conserve ses propres seuils (FR-14).
 *
 * @param daysUntilExpiration jours restants (null => INCONNU)
 * @param thresholdDays seuil à partir duquel le statut bascule en BIENTOT
 */
export function computeReminderStatus(
  daysUntilExpiration: number | null,
  thresholdDays: number,
): ReminderStatus {
  if (daysUntilExpiration === null) {
    return 'INCONNU';
  }
  if (daysUntilExpiration < 0) {
    return 'EXPIRE';
  }
  if (daysUntilExpiration <= thresholdDays) {
    return 'BIENTOT';
  }
  return 'OK';
}

/**
 * Construit une entrée de rappel pour un type de document.
 * Si aucun document actif n'existe pour ce type, retourne une entrée INCONNU
 * (dateExpiration / daysUntilExpiration null) afin que les 3 types soient
 * toujours présents dans la réponse (FR-12).
 *
 * @param document document actif (ou null si absent)
 * @param type type de document attendu
 * @param thresholdDays seuil BIENTOT
 * @param now date de référence (injectable pour les tests)
 */
export function buildDocumentReminder(
  document: VehicleDocument | null,
  type: VehicleDocumentType,
  thresholdDays: number,
  now: Date = new Date(),
): DocumentReminder {
  if (!document) {
    return {
      documentType: type,
      reference: null,
      dateExpiration: null,
      daysUntilExpiration: null,
      reminderStatus: 'INCONNU',
    };
  }

  const daysUntilExpiration = computeDaysUntilExpiration(
    document.dateExpiration,
    now,
  );

  return {
    documentType: type,
    reference: document.reference ?? null,
    dateExpiration: document.dateExpiration ?? null,
    daysUntilExpiration,
    reminderStatus: computeReminderStatus(daysUntilExpiration, thresholdDays),
  };
}

/**
 * Sévérité utilisée pour déterminer le pire statut global d'un véhicule.
 * Plus la valeur est élevée, plus le statut est grave (FR-13).
 */
const STATUS_SEVERITY: Record<ReminderStatus, number> = {
  OK: 0,
  INCONNU: 1,
  BIENTOT: 2,
  EXPIRE: 3,
};

/**
 * Résume une liste de rappels en un statut global = le pire des statuts
 * (EXPIRE > BIENTOT > INCONNU > OK). Liste vide => OK (FR-13).
 */
export function computeGlobalReminderStatus(
  reminders: DocumentReminder[],
): ReminderStatus {
  return reminders.reduce<ReminderStatus>((worst, current) => {
    return STATUS_SEVERITY[current.reminderStatus] > STATUS_SEVERITY[worst]
      ? current.reminderStatus
      : worst;
  }, 'OK');
}
