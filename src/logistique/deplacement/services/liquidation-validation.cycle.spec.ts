import { Test, TestingModule } from '@nestjs/testing';
import {
  LgDeplacementStatus,
  LgLiquidationValidationStatus,
  LgLiquidationValidatorRole,
} from '@prisma/client';
import { LiquidationValidationService } from './deplacement-liquidation-validation.service';
import { PrismaService } from 'prisma/prisma.service';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { LiquidationValidationRepository } from 'src/repository/deplacement/liquidation-validation.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';

/**
 * Test d'intégration "cycle complet" du circuit de validation de liquidation.
 *
 * Note : l'infrastructure e2e du projet (test/jest-e2e.json) démarre AppModule
 * complet (PostgreSQL + Redis + queues), indisponible hors environnement de CI
 * provisionné. Ce test couvre donc le scénario e2e métier de bout en bout (T6.2)
 * via un état en mémoire partagé entre le repository et la transaction Prisma,
 * sous le runner unitaire (qui résout les alias de modules `src/` et `prisma/`).
 *
 * Scénario : soumission -> validation OM -> validation DEMANDEUR -> rejet CFO
 *   -> LIQUIDATION_REJETEE -> resoumission (reset complet) -> 3 validations
 *   -> LIQUIDATION_VALIDEE + notification de validation complète.
 */
describe('Liquidation validation - cycle complet (intégration)', () => {
  let service: LiquidationValidationService;

  const state = {
    deplacementStatus: LgDeplacementStatus.LIQUIDEE as LgDeplacementStatus,
    validations: [] as {
      id: string;
      role: LgLiquidationValidatorRole;
      status: LgLiquidationValidationStatus;
      validatorId: number | null;
      commentaire: string | null;
    }[],
  };

  const seedValidations = () => {
    state.validations = [
      LgLiquidationValidatorRole.DEMANDEUR,
      LgLiquidationValidatorRole.OM,
      LgLiquidationValidatorRole.CFO,
    ].map((role) => ({
      id: `v-${role}`,
      role,
      status: LgLiquidationValidationStatus.EN_ATTENTE,
      validatorId: null,
      commentaire: null,
    }));
  };

  const deplacementRepository = {
    findById: jest.fn(async () => ({
      id: 'dep-1',
      reference: 'DEP-2026-0001',
      status: state.deplacementStatus,
      requestorId: 10,
      requestor: { email: 'demandeur@test.com' },
      liquidation: { id: 'liq-1' },
    })),
  };

  const validationRepository = {
    findValidationsByLiquidationId: jest.fn(async () => state.validations),
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
          status: LgLiquidationValidationStatus;
          validatorId: number;
          commentaire?: string | null;
        },
      ) => {
        const row = state.validations.find((v) => v.id === id);
        if (row) {
          row.status = data.status;
          row.validatorId = data.validatorId;
          row.commentaire = data.commentaire ?? null;
        }
      },
    ),
    resetValidations: jest.fn(async () => seedValidations()),
  };

  const prisma = {
    $transaction: jest.fn(async (cb) =>
      cb({
        lgDeplacement: {
          update: jest.fn(async ({ data }) => {
            state.deplacementStatus = data.status;
          }),
        },
      }),
    ),
    user: { findMany: jest.fn(async () => []) },
  };

  const notification = { createNotification: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    state.deplacementStatus = LgDeplacementStatus.LIQUIDEE;
    seedValidations();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidationValidationService,
        { provide: PrismaService, useValue: prisma },
        { provide: DeplacementRepository, useValue: deplacementRepository },
        {
          provide: LiquidationValidationRepository,
          useValue: validationRepository,
        },
        { provide: NotificationService, useValue: notification },
      ],
    }).compile();

    service = moduleRef.get(LiquidationValidationService);
  });

  it('runs the full submit -> reject -> resubmit -> full validation cycle', async () => {
    // OM valide
    await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.OM,
      LgLiquidationValidationStatus.VALIDEE,
      undefined,
      { id: 2, role: 'OM' },
    );
    expect(state.deplacementStatus).toBe(LgDeplacementStatus.LIQUIDEE);

    // DEMANDEUR (requestor) valide
    await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.DEMANDEUR,
      LgLiquidationValidationStatus.VALIDEE,
      undefined,
      { id: 10, role: 'DEMANDEUR' },
    );
    expect(state.deplacementStatus).toBe(LgDeplacementStatus.LIQUIDEE);

    // CFO rejette -> LIQUIDATION_REJETEE
    await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.CFO,
      LgLiquidationValidationStatus.REJETEE,
      'Justificatifs manquants',
      { id: 3, role: 'CFO' },
    );
    expect(state.deplacementStatus).toBe(
      LgDeplacementStatus.LIQUIDATION_REJETEE,
    );

    // Resoumission : reset complet
    await validationRepository.resetValidations(null, 'liq-1');
    state.deplacementStatus = LgDeplacementStatus.LIQUIDEE;
    expect(
      state.validations.every(
        (v) => v.status === LgLiquidationValidationStatus.EN_ATTENTE,
      ),
    ).toBe(true);

    // Les 3 valident -> LIQUIDATION_VALIDEE au dernier
    await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.DEMANDEUR,
      LgLiquidationValidationStatus.VALIDEE,
      undefined,
      { id: 10, role: 'DEMANDEUR' },
    );
    await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.OM,
      LgLiquidationValidationStatus.VALIDEE,
      undefined,
      { id: 2, role: 'OM' },
    );
    const final = await service.decide(
      'dep-1',
      LgLiquidationValidatorRole.CFO,
      LgLiquidationValidationStatus.VALIDEE,
      undefined,
      { id: 3, role: 'CFO' },
    );

    expect(state.deplacementStatus).toBe(
      LgDeplacementStatus.LIQUIDATION_VALIDEE,
    );
    expect(final.deplacementStatus).toBe(
      LgDeplacementStatus.LIQUIDATION_VALIDEE,
    );
    expect(notification.createNotification).toHaveBeenCalledWith(
      expect.stringContaining('LIQUIDATION_VALIDEE_COMPLETE'),
      expect.any(Array),
      'dep-1',
      expect.any(Object),
      false,
    );
  });
});
