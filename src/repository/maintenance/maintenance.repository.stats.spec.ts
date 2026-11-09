import { MaintenanceRepository } from './maintenance.repository';

describe('MaintenanceRepository.findStats', () => {
  it('excludes equipment repairs from every Entretien count', async () => {
    const calls: any[] = [];
    const record = (args: any) => {
      calls.push(args);
      return Promise.resolve(args?.by || args?.select ? [] : 0);
    };
    const prisma: any = {
      maintenanceRequest: {
        count: jest.fn(record),
        groupBy: jest.fn(record),
        findMany: jest.fn(record),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    const repo = new MaintenanceRepository(prisma);
    await repo.findStats();
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args.where).toMatchObject({ equipmentId: null });
    }
  });
});
