import { CreateSettlementDto } from './create-settlement.dto';

/**
 * Resoumission d'une liquidation rejetée. Mêmes champs que la création :
 * le DEMANDEUR corrige les montants/observations avant de relancer le circuit.
 */
export class ResubmitSettlementDto extends CreateSettlementDto {}
