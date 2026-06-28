import { VehicleDocument, VehicleDocumentType } from '@prisma/client';
import {
  buildDocumentReminder,
  computeDaysUntilExpiration,
  computeGlobalReminderStatus,
  computeReminderStatus,
  DocumentReminder,
  REMINDER_THRESHOLD_DAYS,
} from './document-reminder.util';

// Construites en heure locale pour que la troncature à minuit (heure serveur)
// soit déterministe quel que soit le fuseau de la CI.
const NOW = new Date(2026, 5, 8, 10, 0, 0);
const localDate = (y: number, m: number, d: number) => new Date(y, m - 1, d);

function makeDocument(
  overrides: Partial<VehicleDocument> = {},
): VehicleDocument {
  return {
    id: 'doc-1',
    vehicleId: 'veh-1',
    type: VehicleDocumentType.ASSURANCE,
    reference: 'POL-001',
    dateDebut: null,
    dateExpiration: localDate(2026, 7, 1),
    isActive: true,
    fileId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('document-reminder.util', () => {
  describe('REMINDER_THRESHOLD_DAYS', () => {
    it('vaut 20 jours (préavis conducteur mobile, FR-11)', () => {
      expect(REMINDER_THRESHOLD_DAYS).toBe(20);
    });
  });

  describe('computeDaysUntilExpiration', () => {
    it('retourne null quand la date est null', () => {
      expect(computeDaysUntilExpiration(null, NOW)).toBeNull();
    });

    it('retourne 0 le jour même (troncature à minuit)', () => {
      const expiration = new Date(2026, 5, 8, 23, 59, 0);
      expect(computeDaysUntilExpiration(expiration, NOW)).toBe(0);
    });

    it('retourne un nombre positif pour une date future', () => {
      const expiration = localDate(2026, 6, 20);
      expect(computeDaysUntilExpiration(expiration, NOW)).toBe(12);
    });

    it('retourne un nombre négatif pour une date passée', () => {
      const expiration = localDate(2026, 6, 1);
      expect(computeDaysUntilExpiration(expiration, NOW)).toBe(-7);
    });
  });

  describe('computeReminderStatus', () => {
    it('retourne INCONNU quand days est null', () => {
      expect(computeReminderStatus(null, REMINDER_THRESHOLD_DAYS)).toBe(
        'INCONNU',
      );
    });

    it('retourne EXPIRE quand days < 0', () => {
      expect(computeReminderStatus(-1, REMINDER_THRESHOLD_DAYS)).toBe('EXPIRE');
    });

    it('retourne BIENTOT quand 0 <= days <= seuil', () => {
      expect(computeReminderStatus(0, 20)).toBe('BIENTOT');
      expect(computeReminderStatus(20, 20)).toBe('BIENTOT');
    });

    it('retourne OK quand days > seuil', () => {
      expect(computeReminderStatus(21, 20)).toBe('OK');
    });

    it('respecte un seuil différent (cron à 30 jours)', () => {
      // À 25 jours : OK pour le mobile (seuil 20) mais BIENTOT pour le cron (seuil 30)
      expect(computeReminderStatus(25, 20)).toBe('OK');
      expect(computeReminderStatus(25, 30)).toBe('BIENTOT');
    });
  });

  describe('buildDocumentReminder', () => {
    it('retourne une entrée INCONNU quand aucun document (FR-12)', () => {
      const reminder = buildDocumentReminder(
        null,
        VehicleDocumentType.CARTE_GRISE,
        REMINDER_THRESHOLD_DAYS,
        NOW,
      );
      expect(reminder).toEqual<DocumentReminder>({
        documentType: VehicleDocumentType.CARTE_GRISE,
        reference: null,
        dateExpiration: null,
        daysUntilExpiration: null,
        reminderStatus: 'INCONNU',
      });
    });

    it('construit un rappel BIENTOT pour un document proche', () => {
      const doc = makeDocument({
        dateExpiration: localDate(2026, 6, 20),
        reference: 'POL-2026',
      });
      const reminder = buildDocumentReminder(
        doc,
        VehicleDocumentType.ASSURANCE,
        REMINDER_THRESHOLD_DAYS,
        NOW,
      );
      expect(reminder.daysUntilExpiration).toBe(12);
      expect(reminder.reminderStatus).toBe('BIENTOT');
      expect(reminder.reference).toBe('POL-2026');
    });

    it('construit un rappel EXPIRE pour un document expiré', () => {
      const doc = makeDocument({
        dateExpiration: localDate(2026, 6, 1),
      });
      const reminder = buildDocumentReminder(
        doc,
        VehicleDocumentType.ASSURANCE,
        REMINDER_THRESHOLD_DAYS,
        NOW,
      );
      expect(reminder.reminderStatus).toBe('EXPIRE');
    });

    it('mappe une référence absente sur null', () => {
      const doc = makeDocument({ reference: null });
      const reminder = buildDocumentReminder(
        doc,
        VehicleDocumentType.ASSURANCE,
        REMINDER_THRESHOLD_DAYS,
        NOW,
      );
      expect(reminder.reference).toBeNull();
    });
  });

  describe('computeGlobalReminderStatus', () => {
    const reminder = (status: DocumentReminder['reminderStatus']) =>
      ({
        documentType: VehicleDocumentType.ASSURANCE,
        reference: null,
        dateExpiration: null,
        daysUntilExpiration: null,
        reminderStatus: status,
      }) as DocumentReminder;

    it('retourne OK pour une liste vide', () => {
      expect(computeGlobalReminderStatus([])).toBe('OK');
    });

    it('retourne OK quand tous OK', () => {
      expect(
        computeGlobalReminderStatus([reminder('OK'), reminder('OK')]),
      ).toBe('OK');
    });

    it('EXPIRE l’emporte sur tout (FR-13)', () => {
      expect(
        computeGlobalReminderStatus([
          reminder('OK'),
          reminder('BIENTOT'),
          reminder('EXPIRE'),
          reminder('INCONNU'),
        ]),
      ).toBe('EXPIRE');
    });

    it('BIENTOT l’emporte sur INCONNU et OK', () => {
      expect(
        computeGlobalReminderStatus([
          reminder('OK'),
          reminder('INCONNU'),
          reminder('BIENTOT'),
        ]),
      ).toBe('BIENTOT');
    });

    it('INCONNU l’emporte sur OK', () => {
      expect(
        computeGlobalReminderStatus([reminder('OK'), reminder('INCONNU')]),
      ).toBe('INCONNU');
    });
  });
});
