import { KpiService } from './kpi.service';

describe('KpiService.getSupplierEvaluation', () => {
  it('averages compliance over submitted grids and counts the rating once per DA', async () => {
    const full = {
      regulariteFiscale: 'Oui',
      devisSpecifications: 'Oui',
      conformiteSpecs: 'Non',
    };
    const prisma: any = {
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          {
            satisfactionSurvey: {
              rating: 4,
              deliveryRating: null,
              qualityRating: null,
              serviceRating: null,
            },
            pv: {
              suppliers: [
                { supplierId: 's1', supplier: { id: 's1', name: 'S1' } },
              ],
              evaluations: [{ answers: { s1: full } }, { answers: { s1: {} } }],
            },
          },
        ]),
      },
    };
    const service = new KpiService(prisma);
    const res = await (service as any).getSupplierEvaluation({});
    expect(res.suppliers[0].complianceScore).toBe(50);
    expect(res.suppliers[0].evaluationCount).toBe(1);
  });
});
