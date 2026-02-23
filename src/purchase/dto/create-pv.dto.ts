import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';

export class CreatePVSupplierItemDto {
  @IsOptional()
  @IsString()
  purchaseItemId?: string;

  @IsString()
  designation: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  disponibilite?: string;
}

export class CreatePVSupplierDto {
  @IsInt()
  @Min(1)
  @Max(3)
  order: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  rang?: number;

  // Recevabilité administrative
  @IsOptional()
  @IsString()
  reponseDansDelai?: string;

  @IsOptional()
  @IsString()
  annexe1?: string;

  @IsOptional()
  @IsString()
  devisSpecifications?: string;

  @IsOptional()
  @IsString()
  regulariteFiscale?: string;

  @IsOptional()
  @IsString()
  copiecin?: string;

  // Recevabilité technique
  @IsOptional()
  @IsString()
  conformiteSpecs?: string;

  @IsOptional()
  @IsString()
  distanceBureaux?: string;

  @IsOptional()
  @IsString()
  delaiLivraison?: string;

  @IsOptional()
  @IsString()
  sav?: string;

  @IsOptional()
  @IsString()
  disponibiliteArticles?: string;

  @IsOptional()
  @IsString()
  qualiteArticles?: string;

  @IsOptional()
  @IsString()
  experienceAnterieure?: string;

  @IsOptional()
  @IsString()
  producteurOuSousTraitant?: string;

  @IsOptional()
  @IsString()
  echantillonBat?: string;

  // Recevabilité financière
  @IsOptional()
  @IsString()
  validiteOffre?: string;

  @IsOptional()
  @IsString()
  modePaiement?: string;

  @IsOptional()
  @IsString()
  delaiPaiement?: string;

  @IsOptional()
  @IsNumber()
  offreFinanciere?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePVSupplierItemDto)
  items?: CreatePVSupplierItemDto[];
}

export class CreatePVDto {
  @IsOptional()
  @IsString()
  evaluateur?: string;

  @IsOptional()
  @IsDateString()
  dateEvaluation?: string;

  @IsOptional()
  @IsString()
  natureObjet?: string;

  @IsOptional()
  @IsString()
  decisionFinale?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePVSupplierDto)
  suppliers: CreatePVSupplierDto[];
}
