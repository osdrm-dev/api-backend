import { CreateLiquidationDto } from './create-liquidation.dto';

/**
 * Resoumission d'une liquidation rejetée. Mêmes champs que la création :
 * le DEMANDEUR corrige les montants/observations avant de relancer le circuit.
 */
export class ResubmitLiquidationDto extends CreateLiquidationDto {}
