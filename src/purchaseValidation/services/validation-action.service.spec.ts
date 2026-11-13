import { ValidationActionService } from './validation-action.service';

describe('ValidationActionService.requestChanges', () => {
  const build = (currentStep: string) => {
    const prisma = { pVEvaluation: { updateMany: jest.fn() } };
    const purchaseRepo = {
      findById: jest.fn(async () => ({
        id: 'p1',
        status: 'PENDING_APPROVAL',
        currentStep,
        validationWorkflows: [{ step: currentStep, validators: [] }],
      })),
      update: jest.fn(async () => ({ id: 'p1' })),
    };
    const workflowService = {
      canUserValidate: jest.fn(async () => ({
        canValidate: true,
        validator: { id: 'v1' },
      })),
      updateValidator: jest.fn(),
    };
    const auditLogRepo = { createValidationLog: jest.fn() };
    const service = new ValidationActionService(
      purchaseRepo as any,
      auditLogRepo as any,
      workflowService as any,
      {} as any,
      prisma as any,
    );
    return { service, prisma };
  };
  const ctx = {
    purchaseId: 'p1',
    userId: 1,
    userRole: 'CFO' as any,
    reason: 'r',
  };

  it('at PV step resets SUBMITTED grids to DRAFT', async () => {
    const { service, prisma } = build('PV');
    await service.requestChanges(ctx);
    expect(prisma.pVEvaluation.updateMany).toHaveBeenCalledWith({
      where: { pv: { purchaseId: 'p1' }, status: 'SUBMITTED' },
      data: { status: 'DRAFT', submittedAt: null },
    });
  });

  it('at another step leaves grids untouched', async () => {
    const { service, prisma } = build('DA');
    await service.requestChanges(ctx);
    expect(prisma.pVEvaluation.updateMany).not.toHaveBeenCalled();
  });
});
