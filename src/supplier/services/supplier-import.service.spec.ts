import { BadRequestException } from '@nestjs/common';
import { SupplierActiveStatus } from '@prisma/client';
import { SupplierImportService } from './supplier-import.service';

const csv = [
  "CATEGORIE;FOURNISSEUR;N° CARTE D'IDENTITE NATIONALE",
  'Divers;ABC;NIF 111',
  'Divers;Nouveau SARL;NIF 222',
  'Divers;  airtel ;',
  'Divers;Autre;NIF 333',
].join('\n');

const file = (content = csv, mimetype = 'text/csv') =>
  ({ buffer: Buffer.from(content), size: content.length, mimetype }) as any;

describe('SupplierImportService', () => {
  const repository = {
    findAllIdentities: jest.fn(),
    createMany: jest.fn(),
  };
  const service = new SupplierImportService(repository as any);

  beforeEach(() => {
    jest.clearAllMocks();
    // ABC existe par son nom, AIRTEL par son nom (casse/espaces), 333 par son NIF.
    repository.findAllIdentities.mockResolvedValue([
      { name: 'ABC', nif: null },
      { name: 'AIRTEL', nif: '999' },
      { name: 'Ancien nom', nif: '333' },
    ]);
    repository.createMany.mockResolvedValue({ count: 1 });
  });

  it('creates only suppliers that do not exist yet (by NIF or name)', async () => {
    const report = await service.importCsv(file(), {
      potential: false,
      dryRun: false,
    });

    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Nouveau SARL',
        nif: '222',
        activeStatus: SupplierActiveStatus.ACTIVE,
      }),
    ]);
    expect(report.created).toBe(1);
    expect(report.skipped.map((s) => [s.line, s.reason])).toEqual([
      [2, 'Existe déjà'],
      [4, 'Existe déjà'],
      [5, 'Existe déjà'],
    ]);
  });

  it('marks imported suppliers as POTENTIAL', async () => {
    await service.importCsv(file(), { potential: true, dryRun: false });
    expect(repository.createMany.mock.calls[0][0][0].activeStatus).toBe(
      SupplierActiveStatus.POTENTIAL,
    );
  });

  it('dry run reports what would be created without writing', async () => {
    const report = await service.importCsv(file(), {
      potential: false,
      dryRun: true,
    });
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(report.created).toBe(1);
    expect(report.toCreate.map((r) => r.name)).toEqual(['Nouveau SARL']);
  });

  it('rejects a non CSV file (e.g. the .xlsx itself)', async () => {
    await expect(
      service.importCsv(
        file(
          'x',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
        { potential: false, dryRun: true },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
