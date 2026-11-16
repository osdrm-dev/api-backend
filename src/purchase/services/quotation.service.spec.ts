import { PurchaseStatus, PurchaseStep } from '@prisma/client';
import { QuotationService } from './quotation.service';
import { ErrorCode } from 'src/common/errors';

const BUYER = 7;

const makePurchase = (quotes: number) => ({
  id: 'p-1',
  reference: 'DA-1',
  acheteurId: BUYER,
  currentStep: PurchaseStep.QR,
  status: PurchaseStatus.AWAITING_DOCUMENTS,
  operationType: 'OPERATION',
  items: [{ amount: 100 }],
  attachments: Array.from({ length: quotes }, (_, i) => ({ id: `q${i}` })),
  derogation: null,
});

describe('QuotationService.submitQuotesForValidation', () => {
  let prisma: any;
  let service: QuotationService;

  const setup = (quotes: number) => {
    prisma = {
      purchase: {
        findUnique: jest.fn().mockResolvedValue(makePurchase(quotes)),
        update: jest.fn().mockResolvedValue({}),
      },
      derogation: { create: jest.fn().mockResolvedValue({}) },
      validationWorkflow: {
        create: jest.fn().mockResolvedValue({ validators: [] }),
      },
    };
    const workflowService: any = {
      getQuoteLevel: jest.fn().mockReturnValue(2),
      getRequiredQuotesCount: jest.fn().mockReturnValue(3),
    };
    const workflowConfig: any = {
      getRequireValidators: jest.fn().mockReturnValue(['OM', 'CFO']),
    };
    service = new QuotationService(prisma, workflowService, workflowConfig);
  };

  it('moves straight to PV without validators when quotes are complete', async () => {
    setup(3);

    const res = await service.submitQuotesForValidation('p-1', BUYER);

    expect(prisma.validationWorkflow.create).not.toHaveBeenCalled();
    expect(prisma.purchase.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { currentStep: PurchaseStep.PV, status: PurchaseStatus.PUBLISHED },
    });
    expect(res.currentStep).toBe(PurchaseStep.PV);
  });

  it('also skips validators when a derogation is ticked but quotes are complete', async () => {
    setup(3);

    await service.submitQuotesForValidation('p-1', BUYER, true, 'raison');

    expect(prisma.validationWorkflow.create).not.toHaveBeenCalled();
    expect(prisma.derogation.create).not.toHaveBeenCalled();
  });

  it('rejects insufficient quotes without derogation', async () => {
    setup(2);

    await expect(
      service.submitQuotesForValidation('p-1', BUYER),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: ErrorCode.PURCHASE_QUOTES_INSUFFICIENT,
      }),
    });
    expect(prisma.purchase.update).not.toHaveBeenCalled();
    expect(prisma.validationWorkflow.create).not.toHaveBeenCalled();
  });

  it('keeps the QR validator chain for a derogation', async () => {
    setup(2);

    const res = await service.submitQuotesForValidation(
      'p-1',
      BUYER,
      true,
      'Fournisseurs limités',
    );

    expect(prisma.derogation.create).toHaveBeenCalled();
    expect(prisma.validationWorkflow.create).toHaveBeenCalled();
    expect(prisma.purchase.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { status: PurchaseStatus.IN_DEROGATION },
    });
    expect(res.currentStep).toBe(PurchaseStep.QR);
  });
});
