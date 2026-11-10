import { Test, TestingModule } from '@nestjs/testing';
import {
  LgMissionStatus,
  LgSettlementValidationStatus,
  LgSettlementValidatorRole,
} from '@prisma/client';
import { SettlementValidationService } from './settlement-validation.service';
import { PrismaService } from 'prisma/prisma.service';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { SettlementValidationRepository } from 'src/repository/mission/settlement-validation.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

/**
 * Test d'intégration "cycle complet" du circuit de validation de settlement.
 *
 * Note : l'infrastructure e2e du projet (test/jest-e2e.json) démarre AppModule
 * complet (PostgreSQL + Redis + queues), indisponible hors environnement de CI
 * provisionné. Ce test couvre donc le scénario e2e métier de bout en bout (T6.2)
 * via un état en mémoire partagé entre le repository et la transaction Prisma,
 * sous le runner unitaire (qui résout les alias de modules `src/` et `prisma/`).
 *
 * Scénario : soumission -> validation OM -> validation DEMANDEUR -> rejet CFO
 *   -> SETTLEMENT_REJECTED -> resoumission (reset complet) -> 3 validations
 *   -> SETTLEMENT_APPROVED + notification de validation complète.
 */
describe('Settlement validation - cycle complet (intégration)', () => {
  let service: SettlementValidationService;

  const state = {
    missionStatus: LgMissionStatus.SETTLED as LgMissionStatus,
    validations: [] as {
      id: string;
      role: LgSettlementValidatorRole;
      status: LgSettlementValidationStatus;
      validatorId: number | null;
      comment: string | null;
    }[],
  };

  const seedValidations = () => {
    state.validations = [
      LgSettlementValidatorRole.DEMANDEUR,
      LgSettlementValidatorRole.OM,
      LgSettlementValidatorRole.CFO,
    ].map((role) => ({
      id: `v-${role}`,
      role,
      status: LgSettlementValidationStatus.PENDING,
      validatorId: null,
      comment: null,
    }));
  };

  const missionRepository = {
    findById: jest.fn(async () => ({
      id: 'dep-1',
      reference: 'TRJ-2026-0001',
      status: state.missionStatus,
      requestorId: 10,
      requestor: { email: 'demandeur@test.com' },
      settlement: { id: 'liq-1' },
    })),
  };

  const validationRepository = {
    findValidationsBySettlementId: jest.fn(async () => state.validations),
    findValidationsForUpdate: jest.fn(async () =>
      state.validations.map((v) => ({
        id: v.id,
        role: v.role,
        status: v.status,
      })),
    ),
    updateValidationDecision: jest.fn(
      async (
        _tx: unknown,
        id: string,
        data: {
          status: LgSettlementValidationStatus;
          validatorId: number;
          comment?: string | null;
        },
      ) => {
        const row = state.validations.find((v) => v.id === id);
        if (row) {
          row.status = data.status;
          row.validatorId = data.validatorId;
          row.comment = data.comment ?? null;
        }
      },
    ),
    resetValidations: jest.fn(async () => seedValidations()),
  };

  const prisma = {
    $transaction: jest.fn(async (cb) =>
      cb({
        lgMission: {
          update: jest.fn(async ({ data }) => {
            state.missionStatus = data.status;
          }),
        },
      }),
    ),
    user: { findMany: jest.fn(async () => []) },
  };

  const notification = { createNotification: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    state.missionStatus = LgMissionStatus.SETTLED;
    seedValidations();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementValidationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MissionRepository, useValue: missionRepository },
        {
          provide: SettlementValidationRepository,
          useValue: validationRepository,
        },
        { provide: NotificationService, useValue: notification },
      ],
    }).compile();

    service = moduleRef.get(SettlementValidationService);
  });

  it('runs the full submit -> reject -> resubmit -> full validation cycle', async () => {
    // OM valide
    await service.decide(
      'dep-1',
      LgSettlementValidatorRole.OM,
      LgSettlementValidationStatus.APPROVED,
      undefined,
      { id: 2, role: 'OM' },
    );
    expect(state.missionStatus).toBe(LgMissionStatus.SETTLED);

    // DEMANDEUR (requestor) valide
    await service.decide(
      'dep-1',
      LgSettlementValidatorRole.DEMANDEUR,
      LgSettlementValidationStatus.APPROVED,
      undefined,
      { id: 10, role: 'DEMANDEUR' },
    );
    expect(state.missionStatus).toBe(LgMissionStatus.SETTLED);

    // CFO rejette -> SETTLEMENT_REJECTED
    await service.decide(
      'dep-1',
      LgSettlementValidatorRole.CFO,
      LgSettlementValidationStatus.REJECTED,
      'Justificatifs manquants',
      { id: 3, role: 'CFO' },
    );
    expect(state.missionStatus).toBe(LgMissionStatus.SETTLEMENT_REJECTED);

    // Resoumission : reset complet
    await validationRepository.resetValidations(null, 'liq-1');
    state.missionStatus = LgMissionStatus.SETTLED;
    expect(
      state.validations.every(
        (v) => v.status === LgSettlementValidationStatus.PENDING,
      ),
    ).toBe(true);

    // Les 3 valident -> SETTLEMENT_APPROVED au dernier
    await service.decide(
      'dep-1',
      LgSettlementValidatorRole.DEMANDEUR,
      LgSettlementValidationStatus.APPROVED,
      undefined,
      { id: 10, role: 'DEMANDEUR' },
    );
    await service.decide(
      'dep-1',
      LgSettlementValidatorRole.OM,
      LgSettlementValidationStatus.APPROVED,
      undefined,
      { id: 2, role: 'OM' },
    );
    const final = await service.decide(
      'dep-1',
      LgSettlementValidatorRole.CFO,
      LgSettlementValidationStatus.APPROVED,
      undefined,
      { id: 3, role: 'CFO' },
    );

    expect(state.missionStatus).toBe(LgMissionStatus.SETTLEMENT_APPROVED);
    expect(final.missionStatus).toBe(LgMissionStatus.SETTLEMENT_APPROVED);
    expect(notification.createNotification).toHaveBeenCalledWith(
      expect.stringContaining('SETTLEMENT_APPROVED'),
      expect.any(Array),
      'dep-1',
      expect.any(Object),
      false,
    );
  });
});
