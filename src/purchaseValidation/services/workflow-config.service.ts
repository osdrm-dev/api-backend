import { Injectable } from '@nestjs/common';
import { OperationType, ValidatorRole, PurchaseStep } from '@prisma/client';

export interface WorkflowRule {
  roles: ValidatorRole[];
  minAmount?: number;
  maxAmount?: number;
}

export interface StepWorkflowConfig {
  step: PurchaseStep;
  rules: {
    [key in OperationType]: WorkflowRule[];
  };
}

@Injectable()
export class WorkflowConfigService {
  private readonly stepconfigs: StepWorkflowConfig[] = [
    {
      step: PurchaseStep.DA,
      rules: {
        [OperationType.OPERATION]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.DP,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
      },
    },

    // ─── QR ────────────────────────────────────────────────────────────────────
    {
      step: PurchaseStep.QR,
      rules: {
        [OperationType.OPERATION]: [
          {
            roles: [
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
              ValidatorRole.DEMANDEUR,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            roles: [
              ValidatorRole.OM,
              ValidatorRole.DP,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
              ValidatorRole.DEMANDEUR,
            ],
          },
        ],
      },
    },

    {
      step: PurchaseStep.PV,
      rules: {
        [OperationType.OPERATION]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.DP,
              ValidatorRole.CEO,
            ],
          },
        ],
      },
    },

    {
      step: PurchaseStep.BC,
      rules: {
        [OperationType.OPERATION]: [
          {
            roles: [ValidatorRole.OM, ValidatorRole.RFR, ValidatorRole.CPR],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            roles: [ValidatorRole.OM, ValidatorRole.RFR, ValidatorRole.CPR],
          },
        ],
      },
    },

    {
      step: PurchaseStep.INVOICE,
      rules: {
        [OperationType.OPERATION]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.DP,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
      },
    },

    {
      step: PurchaseStep.DAP,
      rules: {
        [OperationType.OPERATION]: [
          {
            roles: [
              ValidatorRole.ACHETEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            roles: [
              ValidatorRole.ACHETEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
            ],
          },
        ],
      },
    },

    {
      step: PurchaseStep.PROOF_OF_PAYMENT,
      rules: {
        [OperationType.OPERATION]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
        [OperationType.PROGRAMME]: [
          {
            maxAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.RFR,
              ValidatorRole.CPR,
            ],
          },
          {
            minAmount: 5_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.DP,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
      },
    },
  ];

  getRequireValidators(
    step: PurchaseStep,
    operationType: OperationType,
    amount: number,
  ): ValidatorRole[] {
    const stepConfig = this.stepconfigs.find((config) => config.step === step);

    if (!stepConfig) {
      throw new Error(`Aucune configuration trouvee pour l'etape ${step}`);
    }

    const rules = stepConfig.rules[operationType];

    for (const rule of rules) {
      if (this.isAmountInRange(amount, rule.minAmount, rule.maxAmount)) {
        return rule.roles;
      }
    }

    return rules[0].roles;
  }

  private isAmountInRange(
    amount: number,
    minAmount?: number,
    maxAmount?: number,
  ): boolean {
    const isAboveMin = minAmount === undefined || amount >= minAmount;
    const isBelowMax = maxAmount === undefined || amount < maxAmount;
    return isAboveMin && isBelowMax;
  }

  getNextValidator(
    validators: Array<{
      role: ValidatorRole;
      order: number;
      isValidated: boolean;
    }>,
  ): { role: ValidatorRole; order: number } | null {
    const unvalidated = validators
      .filter((v) => !v.isValidated)
      .sort((a, b) => a.order - b.order);

    return unvalidated.length > 0 ? unvalidated[0] : null;
  }

  isValidatorAuthorized(
    userRole: ValidatorRole,
    validators: Array<{
      role: ValidatorRole;
      order: number;
      isValidated: boolean;
    }>,
  ): boolean {
    const nextValidator = this.getNextValidator(validators);
    return nextValidator !== null && nextValidator.role === userRole;
  }

  isWorkflowComplete(validators: Array<{ isValidated: boolean }>): boolean {
    return validators.every((v) => v.isValidated);
  }

  roleToValidatorRole(role: string): ValidatorRole {
    const mapping: Record<string, ValidatorRole> = {
      DEMANDEUR: ValidatorRole.DEMANDEUR,
      OM: ValidatorRole.OM,
      CFO: ValidatorRole.CFO,
      CEO: ValidatorRole.CEO,
      DP: ValidatorRole.DP,
      RFR: ValidatorRole.RFR,
      CPR: ValidatorRole.CPR,
      ACHETEUR: ValidatorRole.ACHETEUR,
    };

    return mapping[role] || ValidatorRole.DEMANDEUR;
  }

  addStepConfig(config: StepWorkflowConfig): void {
    const existingIndex = this.stepconfigs.findIndex(
      (current) => current.step === config.step,
    );

    if (existingIndex >= 0) {
      this.stepconfigs[existingIndex] = config;
    } else {
      this.stepconfigs.push(config);
    }
  }

  getStatusMessage(status: string, currentStep: string): string {
    if (status === 'DRAFT') return 'Brouillon';
    if (status === 'REJECTED') return 'Rejetée';
    if (status === 'CHANGE_REQUESTED') return 'Modifications demandées';
    if (status === 'AWAITING_DOCUMENTS') {
      const stepMessages: Record<string, string> = {
        QR: 'En attente de devis',
        BC: 'En attente du bon de commande',
        BR: 'En attente du bon de réception',
        INVOICE: 'En attente de la facture',
        DAP: 'En attente de la DAP',
        PROOF_OF_PAYMENT: 'En attente de la preuve de paiement',
      };
      return (
        stepMessages[currentStep] ?? `En attente de document (${currentStep})`
      );
    }
    if (status === 'PENDING_APPROVAL') {
      const stepMessages: Record<string, string> = {
        DA: 'DA en cours de validation',
        QR: 'Devis en cours de validation',
        PV: 'PV en cours de validation',
        BC: 'BC en cours de validation',
        INVOICE: 'Facture en cours de validation',
        DAP: 'DAP en cours de validation',
        PROOF_OF_PAYMENT: 'Preuve de paiement en cours de validation',
      };
      return (
        stepMessages[currentStep] ?? `${currentStep} en cours de validation`
      );
    }
    if (status === 'PUBLISHED') {
      return `${currentStep} en cours de validation`;
    }
    if (status === 'VALIDATED') {
      const stepMessages: Record<string, string> = {
        QR: 'DA validée - En attente de devis',
        PV: 'Devis validés - En attente de PV',
        BC: 'PV validé - En attente de BC',
        BR: 'BC validé - En attente de livraison',
        INVOICE: 'BR validé - En attente de facture',
        DAP: 'Facture validée - En attente de DAP',
        PROOF_OF_PAYMENT: 'DAP validée - En attente de preuve de paiement',
        DONE: 'Processus terminé',
      };
      return stepMessages[currentStep] ?? `${currentStep} validé`;
    }
    if (status === 'IN_DEROGATION') return 'En dérogation';

    return status;
  }
}
