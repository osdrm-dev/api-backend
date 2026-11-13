import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PVService } from './pv.service';
import { PVEvaluationService } from './pv-evaluation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PVRepository } from '../../repository/purchase/pv.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CreatePVSupplierDto } from '../dto/create-pv.dto';

describe('PVService', () => {
  let service: PVService;
  let purchase: any;

  const prisma = {
    purchase: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    supplier: { findUnique: jest.fn() },
    validationWorkflow: { findFirst: jest.fn() },
  };
  const pvRepository = {
    update: jest.fn(async () => ({ id: 'pv1' })),
    deleteSuppliersById: jest.fn(),
  };
  const evaluations = {
    assertAllDone: jest.fn(),
    resetAfterSupplierChange: jest.fn(),
    freezeEvaluators: jest.fn(),
    getExpectedEvaluatorUsers: jest.fn(async () => ({
      reference: 'DA-1',
      users: [
        { id: 1, email: 'a@x.com' },
        { id: 2, email: 'b@x.com' },
      ],
    })),
  };
  const notification = {
    createNotification: jest.fn(),
    stopActiveReminders: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    purchase = {
      id: 'p1',
      reference: 'DA-1',
      status: 'PUBLISHED',
      acheteurId: 9,
      items: [],
      acheteur: { id: 9, email: 'buyer@x.com' },
      validationWorkflows: [
        {
          validators: [
            { userId: 1, user: { id: 1, email: 'a@x.com' } },
            { userId: 2, user: { id: 2, email: 'b@x.com' } },
          ],
        },
      ],
      pv: {
        id: 'pv1',
        daEvaluationsRequired: true,
        suppliers: [
          { supplierId: 's1', items: [] },
          { supplierId: 's2', items: [] },
        ],
      },
    };
    prisma.purchase.findUnique.mockResolvedValue(purchase);
    prisma.user.findUnique.mockResolvedValue({ id: 9, role: 'ACHETEUR' });
    prisma.supplier.findUnique.mockResolvedValue({
      id: 's1',
      activeStatus: 'ACTIVE',
    });
    const module = await Test.createTestingModule({
      providers: [
        PVService,
        { provide: PrismaService, useValue: prisma },
        { provide: PVRepository, useValue: pvRepository },
        { provide: PVEvaluationService, useValue: evaluations },
        { provide: NotificationService, useValue: notification },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(PVService);
  });

  it('submitPV propagates assertAllDone failure without updating the purchase', async () => {
    evaluations.assertAllDone.mockRejectedValue(new Error('INCOMPLETE'));
    await expect(service.submitPV('p1', 9)).rejects.toThrow('INCOMPLETE');
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });

  it('updatePV resets and notifies each evaluator when the supplier set changes', async () => {
    await service.updatePV('p1', 9, {
      suppliers: [{ supplierId: 's1', order: 1 }],
    } as any);
    expect(evaluations.resetAfterSupplierChange).toHaveBeenCalledWith('pv1', [
      's1',
    ]);
    expect(notification.createNotification).toHaveBeenCalledTimes(2);
    expect(notification.createNotification).toHaveBeenCalledWith(
      OSDRM_PROCESS_EVENT.PV_EVALUATION_REQUESTED,
      ['a@x.com'],
      'p1',
      { reference: 'DA-1' },
      true,
    );
  });

  it('updatePV with the same suppliers (rank change) neither resets nor notifies', async () => {
    await service.updatePV('p1', 9, {
      suppliers: [
        { supplierId: 's1', order: 1, rang: 2 },
        { supplierId: 's2', order: 2, rang: 1 },
      ],
    } as any);
    expect(evaluations.resetAfterSupplierChange).not.toHaveBeenCalled();
    expect(notification.createNotification).not.toHaveBeenCalled();
  });

  it('CreatePVSupplierDto requires supplierId', async () => {
    const errors = await validate(
      plainToInstance(CreatePVSupplierDto, { order: 1 }),
    );
    expect(errors.map((e) => e.property)).toContain('supplierId');
  });

  it('CreatePVSupplierDto accepts offreFinanciere', async () => {
    const errors = await validate(
      plainToInstance(CreatePVSupplierDto, {
        supplierId: 's1',
        order: 1,
        offreFinanciere: 5000,
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('updatePV still succeeds when a notification fails', async () => {
    notification.createNotification.mockRejectedValueOnce(new Error('mail'));
    await expect(
      service.updatePV('p1', 9, {
        suppliers: [{ supplierId: 's1', order: 1 }],
      } as any),
    ).resolves.toBeDefined();
  });

  it('updatePV with an empty suppliers array -> NO_SUPPLIER, nothing deleted', async () => {
    await expect(
      service.updatePV('p1', 9, { suppliers: [] } as any),
    ).rejects.toMatchObject({ code: 'PURCHASE_PV_NO_SUPPLIER' });
    expect(pvRepository.deleteSuppliersById).not.toHaveBeenCalled();
  });

  it('updatePV freezes evaluators and stops old reminders before notifying', async () => {
    await service.updatePV('p1', 9, {
      suppliers: [{ supplierId: 's1', order: 1 }],
    } as any);
    expect(evaluations.freezeEvaluators).toHaveBeenCalledWith('p1');
    expect(notification.stopActiveReminders).toHaveBeenCalledWith(
      'p1',
      'a@x.com',
    );
    expect(notification.stopActiveReminders).toHaveBeenCalledWith(
      'p1',
      'b@x.com',
    );
  });

  it('one failed notification does not skip the other evaluators', async () => {
    notification.createNotification.mockRejectedValueOnce(new Error('mail'));
    await service.updatePV('p1', 9, {
      suppliers: [{ supplierId: 's1', order: 1 }],
    } as any);
    expect(notification.createNotification).toHaveBeenCalledTimes(2);
  });
});
