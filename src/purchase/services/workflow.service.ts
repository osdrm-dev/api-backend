import { Injectable } from '@nestjs/common';
import { OperationType, ValidatorRole, PurchaseStatus } from '@prisma/client';

export interface ValidatorConfig {
  role: ValidatorRole;
  order: number;
}

@Injectable()
export class WorkflowService {
  /**
   * Determine le niveau de devis requis selon le montant
   * Niveau 1: < 500,000 MGA = 1 devis
   * Niveau 2: 500,000 - 2,000,000 MGA = 2 devis (region) ou 3 devis (province)
   * Niveau 3: 2,000,000 - 5,000,000 MGA = 3 devis
   * Niveau 4: >= 5,000,000 MGA = 3+ devis
   */
  getQuoteLevel(amount: number): number {
    if (amount < 500000) return 1;
    if (amount < 2000000) return 2;
    if (amount < 5000000) return 3;
    return 4;
  }

  getRequiredQuotesCount(level: number, isProvince: boolean = false): number {
    switch (level) {
      case 1:
        return 1;
      case 2:
        return isProvince ? 3 : 2;
      case 3:
        return 3;
      case 4:
        return 3;
      default:
        return 1;
    }
  }

  /**
   * Determine les validateurs pour la derogation initiale selon le montant
   */
  getDerogationValidators(amount: number): ValidatorConfig[] {
    const validators: ValidatorConfig[] = [
      { role: ValidatorRole.DEMANDEUR, order: 0 },
    ];

    if (amount < 5000000) {
      // < 5M MGA: RFR, CPR
      validators.push(
        { role: ValidatorRole.RFR, order: 1 },
        { role: ValidatorRole.CPR, order: 2 },
      );
    } else {
      // >= 5M MGA: DP, CFO, CEO
      validators.push(
        { role: ValidatorRole.DP, order: 1 },
        { role: ValidatorRole.CFO, order: 2 },
        { role: ValidatorRole.CEO, order: 3 },
      );
    }

    return validators;
  }

  /**
   * Determine les validateurs pour la validation finale de la DA
   */
  getFinalValidators(operationType: OperationType): ValidatorConfig[] {
    const validators: ValidatorConfig[] = [
      { role: ValidatorRole.DEMANDEUR, order: 0 },
    ];

    if (operationType === OperationType.OPERATION) {
      // Operation: OM, CFO, CEO
      validators.push(
        { role: ValidatorRole.OM, order: 1 },
        { role: ValidatorRole.CFO, order: 2 },
        { role: ValidatorRole.CEO, order: 3 },
      );
    } else {
      // Programme: OM, DP, CFO, CEO
      validators.push(
        { role: ValidatorRole.OM, order: 1 },
        { role: ValidatorRole.DP, order: 2 },
        { role: ValidatorRole.CFO, order: 3 },
        { role: ValidatorRole.CEO, order: 4 },
      );
    }

    return validators;
  }

  /**
   * Verifie si un utilisateur peut valider a l'etape actuelle
   */
  canUserValidate(
    userRole: ValidatorRole,
    validators: Array<{
      role: ValidatorRole;
      order: number;
      isValidated: boolean;
    }>,
  ): boolean {
    // Trouver le validateur correspondant au role de l'utilisateur
    const userValidator = validators.find((v) => v.role === userRole);
    if (!userValidator) return false;

    // Verifier que tous les validateurs precedents ont valide
    const previousValidators = validators.filter(
      (v) => v.order < userValidator.order,
    );
    const allPreviousValidated = previousValidators.every((v) => v.isValidated);

    // L'utilisateur peut valider si c'est son tour et il n'a pas encore valide
    return allPreviousValidated && !userValidator.isValidated;
  }

  /**
   * Verifie si tous les validateurs ont valide
   */
  isWorkflowComplete(validators: Array<{ isValidated: boolean }>): boolean {
    return validators.every((v) => v.isValidated);
  }

  /**
   * Determine le prochain statut apres validation complete
   */
  getNextStatus(currentStatus: PurchaseStatus): PurchaseStatus {
    switch (currentStatus) {
      case PurchaseStatus.PUBLISHED:
        return PurchaseStatus.VALIDATED;
      case PurchaseStatus.IN_DEROGATION:
        return PurchaseStatus.PUBLISHED;
      default:
        return currentStatus;
    }
  }

  /**
   * Retourne des informations sur le niveau de devis
   */
  getQuoteLevelInfo(level: number): {
    level: number;
    label: string;
    requiredQuotes: number;
    description: string;
  } {
    const configs = {
      1: {
        level: 1,
        label: 'Niveau 1',
        requiredQuotes: 1,
        description: 'Montant < 500,000 MGA - 1 devis requis',
      },
      2: {
        level: 2,
        label: 'Niveau 2',
        requiredQuotes: 2,
        description:
          '500,000 - 2,000,000 MGA - 2 devis (region) ou 3 devis (province)',
      },
      3: {
        level: 3,
        label: 'Niveau 3',
        requiredQuotes: 3,
        description: '2,000,000 - 5,000,000 MGA - 3 devis requis',
      },
      4: {
        level: 4,
        label: 'Niveau 4',
        requiredQuotes: 3,
        description: '>= 5,000,000 MGA - 3 devis minimum requis',
      },
    };

    return configs[level] || configs[1];
  }
}
