import { Prisma } from '@prisma/client';
import { ParcAutoRepository } from './parc-auto.repository';

describe('ParcAutoRepository.createAssignmentClosingPrevious', () => {
  it('runs in a Serializable transaction so concurrent assignments cannot both stay ACTIVE', async () => {
    const prisma = { $transaction: jest.fn().mockResolvedValue({}) };
    const repo = new ParcAutoRepository(prisma as any);
    await repo.createAssignmentClosingPrevious({
      vehicleId: 'veh-1',
      driverId: 7,
      fileId: 99,
      startDate: new Date('2026-10-01'),
      createdById: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
