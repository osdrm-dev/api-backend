import { Test } from '@nestjs/testing';
import { PVEvaluationService } from './pv-evaluation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PV_CRITERIA_KEYS } from '../utils/pv-criteria';

const full = (id: string) => ({
  [id]: Object.fromEntries(PV_CRITERIA_KEYS.map((k) => [k, 'Oui'])),
});
const FULL = { ...full('s1'), ...full('s2') };

const user = (id: number, name: string, role = 'OM') => ({ id, name, role });

describe('PVEvaluationService', () => {
  let service: PVEvaluationService;
  let purchase: any;
  let evals: any[];
  const notification = { createNotification: jest.fn() };

  const prisma = {
    purchase: {
      findUnique: jest.fn(async () => ({
        ...purchase,
        pv: { ...purchase.pv, evaluations: evals },
      })),
    },
    pVEvaluation: {
      findMany: jest.fn(async (args: any) =>
        evals.filter((e) => e.status !== args.where.status.not),
      ),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const found = evals.find((e) => e.userId === where.pvId_userId.userId);
        if (found) return Object.assign(found, update);
        const row = { id: `e${create.userId}`, ...create };
        evals.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          evals.find(
            (e) => e.id === where.id || e.userId === where.pvId_userId?.userId,
          ),
          data,
        ),
      ),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    evals = [];
    purchase = {
      id: 'p1',
      reference: 'DA-1',
      status: 'PUBLISHED',
      acheteurId: 9,
      acheteur: { ...user(9, 'Buyer', 'ACHETEUR'), email: 'buyer@x.com' },
      validationWorkflows: [
        {
          validators: [
            { userId: 1, user: user(1, 'One') },
            { userId: 2, user: user(2, 'Two') },
          ],
        },
      ],
      pv: {
        id: 'pv',
        daEvaluationsRequired: true,
        suppliers: [{ supplierId: 's1' }, { supplierId: 's2' }],
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        PVEvaluationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notification },
      ],
    }).compile();
    service = module.get(PVEvaluationService);
  });

  const code = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e) => e.getResponse?.().code ?? e.code ?? e.message,
    );

  it('saveMine by non evaluator -> NOT_EVALUATOR', async () => {
    expect(await code(service.saveMine('p1', 3, {}))).toBe(
      'PURCHASE_PV_NOT_EVALUATOR',
    );
  });

  it('saveMine with unknown supplier -> INVALID', async () => {
    expect(
      await code(
        service.saveMine('p1', 1, { answers: { sX: { sav: 'Oui' } } }),
      ),
    ).toBe('PURCHASE_PV_EVALUATION_INVALID');
  });

  it('saveMine on SUBMITTED grid -> SUBMITTED', async () => {
    evals.push({ id: 'e1', userId: 1, status: 'SUBMITTED', answers: FULL });
    expect(await code(service.saveMine('p1', 1, { answers: {} }))).toBe(
      'PURCHASE_PV_EVALUATION_SUBMITTED',
    );
  });

  it('saveMine when DA not PUBLISHED -> LOCKED', async () => {
    purchase.status = 'PENDING_APPROVAL';
    expect(await code(service.saveMine('p1', 1, {}))).toBe(
      'PURCHASE_PV_LOCKED',
    );
  });

  it('submitMine with partial grid -> INCOMPLETE', async () => {
    evals.push({
      id: 'e1',
      userId: 1,
      status: 'DRAFT',
      answers: { s1: { sav: 'Oui' } },
    });
    expect(await code(service.submitMine('p1', 1))).toBe(
      'PURCHASE_PV_EVALUATION_INCOMPLETE',
    );
  });

  it('submitMine by the last evaluator notifies the buyer once', async () => {
    evals.push(
      { id: 'e1', userId: 1, status: 'SUBMITTED', answers: FULL },
      { id: 'e2', userId: 2, status: 'DRAFT', answers: FULL },
    );
    await service.submitMine('p1', 2);
    expect(notification.createNotification).toHaveBeenCalledTimes(1);
    expect(notification.createNotification).toHaveBeenCalledWith(
      'PV_EVALUATIONS_COMPLETE',
      ['buyer@x.com'],
      'p1',
      expect.anything(),
    );
  });

  it('submitMine does not notify while others are pending', async () => {
    evals.push({ id: 'e1', userId: 1, status: 'DRAFT', answers: FULL });
    await service.submitMine('p1', 1);
    expect(notification.createNotification).not.toHaveBeenCalled();
  });

  it('getStatus never exposes answers', async () => {
    evals.push({ id: 'e1', userId: 1, status: 'DRAFT', answers: FULL });
    const result = await service.getStatus('p1', { id: 1, role: 'OM' as any });
    expect(JSON.stringify(result)).not.toContain('answers');
    expect(result).toMatchObject({ expected: 2, done: 0 });
  });

  it('listAll: evaluator forbidden, buyer sees grids', async () => {
    evals.push(
      { id: 'e1', userId: 1, status: 'SUBMITTED', answers: FULL },
      { id: 'e2', userId: 2, status: 'SUBMITTED', answers: FULL },
    );
    expect(
      await code(service.listAll('p1', { id: 1, role: 'OM' as any })),
    ).toBe('PURCHASE_PV_NOT_EVALUATOR');
    const res = await service.listAll('p1', { id: 9, role: 'ACHETEUR' as any });
    expect(res.evaluations).toHaveLength(2);
    expect(res.evaluations[0].answers).toBeDefined();
  });

  it('waive: non admin forbidden; admin waives and assertAllDone passes', async () => {
    evals.push({ id: 'e1', userId: 1, status: 'SUBMITTED', answers: FULL });
    expect(
      await code(
        service.waive('p1', { id: 5, role: 'OM' as any }, 2, { reason: 'x' }),
      ),
    ).toBe('PURCHASE_PV_NOT_EVALUATOR');
    const res: any = await service.waive(
      'p1',
      { id: 5, role: 'ADMIN' as any },
      2,
      { reason: 'absent' },
    );
    expect(res.status).toBe('WAIVED');
    await expect(service.assertAllDone('p1')).resolves.toBeUndefined();
  });

  it('waive when DA not PUBLISHED -> LOCKED', async () => {
    purchase.status = 'PENDING_APPROVAL';
    expect(
      await code(
        service.waive('p1', { id: 5, role: 'ADMIN' as any }, 2, {
          reason: 'x',
        }),
      ),
    ).toBe('PURCHASE_PV_LOCKED');
  });

  it('assertAllDone with 1 of 2 submitted -> EVALUATIONS_INCOMPLETE', async () => {
    evals.push({ id: 'e1', userId: 1, status: 'SUBMITTED', answers: FULL });
    expect(await code(service.assertAllDone('p1'))).toBe(
      'PURCHASE_PV_EVALUATIONS_INCOMPLETE',
    );
  });

  it('resetAfterSupplierChange drops removed suppliers, keeps WAIVED', async () => {
    evals.push(
      {
        id: 'e1',
        userId: 1,
        status: 'SUBMITTED',
        answers: FULL,
        submittedAt: 1,
      },
      { id: 'e2', userId: 2, status: 'WAIVED', answers: null },
    );
    await service.resetAfterSupplierChange('pv', ['s1']);
    expect(Object.keys(evals[0].answers)).toEqual(['s1']);
    expect(evals[0].status).toBe('DRAFT');
    expect(evals[0].submittedAt).toBeNull();
    expect(evals[1].status).toBe('WAIVED');
  });
});
