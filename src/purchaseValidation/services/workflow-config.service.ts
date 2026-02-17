import { Injectable } from '@nestjs/common';
import { OperationType, ValidatorRole, PurchaseStep } from '@prisma/client';
import { config } from 'dotenv';

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

//Service reutilisable pour gerer la configuration des workflows à differentes etapes
@Injectable()
export class WorkflowConfigService {
  //configuration du workflow par etape(on peut ajouter d'autre étapes)
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
            maxAmount: 50_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.DP,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
          {
            minAmount: 50_000_000,
            roles: [
              ValidatorRole.DEMANDEUR,
              ValidatorRole.OM,
              ValidatorRole.CFO,
              ValidatorRole.CEO,
            ],
          },
        ],
      },
    },
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
              ValidatorRole.CEO,
              ValidatorRole.CFO,
              ValidatorRole.DEMANDEUR,
            ],
          },
        ],
      },
    },

    //ici on peut ajouter d'autre étapes selon le step avec leur règles
  ];

  // Obtenir les validateurs reaquis pour une étape, type et montant donnés(Reutilisables pour toutes les etapes)
  getRequireValidators(
    step: PurchaseStep,
    operationType: OperationType,
    amount: number,
  ): ValidatorRole[] {
    const stepConfig = this.stepconfigs.find((config) => config.step === step);

    if (!stepConfig) {
      throw new Error(`Aucune configuration trouvé pout l'étape ${step}`);
    }

    const rules = stepConfig.rules[operationType];

    for (const rule of rules) {
      if (this.isAmountInRange(amount, rule.minAmount, rule.maxAmount)) {
        return rule.roles;
      }
    }

    return rules[0].roles;
  }

  //Verifie si un montant est dans un plage donné
  private isAmountInRange(
    amount: number,
    minAmount?: number,
    maxAmount?: number,
  ): boolean {
    const isAboveMin = minAmount === undefined || amount >= minAmount;
    const isBelowMax = maxAmount === undefined || amount < maxAmount;
    return isAboveMin && isBelowMax;
  }

  // Obtenir le prochain validateur non validé dasn l'ordre
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

  //verifie si un validateur est autorsisé(c'est son tour)
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

  //Verifie si tous les validateurs ont validé
  isWorkflowComplete(validators: Array<{ isValidated: boolean }>): boolean {
    return validators.every((v) => v.isValidated);
  }

  //convertir un role utilisateur en ValidatorRole
  roleToValidatorRole(role: string): ValidatorRole {
    const mapping: Record<string, ValidatorRole> = {
      DEMANDEUR: ValidatorRole.DEMANDEUR,
      OM: ValidatorRole.OM,
      CFO: ValidatorRole.CFO,
      CEO: ValidatorRole.CEO,
      DP: ValidatorRole.DP,
      RFR: ValidatorRole.RFR,
      CPR: ValidatorRole.CPR,
    };

    return mapping[role] || ValidatorRole.DEMANDEUR;
  }

  //Ajoute une configuration pour une nouvelle etape permettant d'étendre facilement le systeme
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
}
