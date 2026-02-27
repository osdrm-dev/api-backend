import { Injectable } from '@nestjs/common';
import { OperationType, ValidatorRole } from '@prisma/client';

@Injectable()
export class WorkflowService {
  /**
   * Determine le niveau de devis requis selon le montant
   * Niveau 1: < 1,000,000 MGA = 1 devis
   * Niveau 2: 1,000,000 - 5,000,000 MGA = 2 devis
   * Niveau 3: 5,000,000 - 25,000,000 MGA = 3 devis
   * Niveau 4: > 25,000,000 MGA = 3+ devis
   */
  getQuoteLevel(amount: number): number {
    if (amount < 1_000_000) return 1;
    if (amount < 5_000_000) return 2;
    if (amount < 25_000_000) return 3;
    return 4;
  }

  getRequiredQuotesCount(level: number): number {
    switch (level) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 3:
        return 3;
      case 4:
        return 3;
      default:
        return 1;
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
        description: 'Montant < 1,000,000 MGA - 1 devis requis',
      },
      2: {
        level: 2,
        label: 'Niveau 2',
        requiredQuotes: 2,
        description: '1,000,000 - 5,000,000 MGA - 2 devis requis',
      },
      3: {
        level: 3,
        label: 'Niveau 3',
        requiredQuotes: 3,
        description: '5,000,000 - 25,000,000 MGA - 3 devis requis',
      },
      4: {
        level: 4,
        label: 'Niveau 4',
        requiredQuotes: 3,
        description: '> 25,000,000 MGA - 3 devis minimum requis',
      },
    };

    return configs[level] || configs[1];
  }

  /**
   * Determine les validateurs QR selon operationType
   * OPERATION: OM -> CFO -> CEO
   * PROGRAMME: DP -> CFO -> CEO (< 50M) ou OM -> CFO -> CEO (>= 50M)
   */
  /**
   * @deprecated QR logic has been moved into WorkflowConfigService.getRequireValidators
   * which offers a unified, amount/rule-driven configuration. This helper remains
   * only for backwards compatibility with any legacy callers; new code should not
   * use it.
   */
  getQRValidators(
    operationType: OperationType,
    amount: number,
  ): ValidatorRole[] {
    if (operationType === OperationType.OPERATION) {
      return [ValidatorRole.OM, ValidatorRole.CFO, ValidatorRole.CEO];
    } else {
      // PROGRAMME
      if (amount >= 50000000) {
        return [ValidatorRole.OM, ValidatorRole.CFO, ValidatorRole.CEO];
      } else {
        return [ValidatorRole.DP, ValidatorRole.CFO, ValidatorRole.CEO];
      }
    }
  }
}
