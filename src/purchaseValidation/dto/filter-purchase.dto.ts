import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  IN_DEROGATION = 'IN_DEROGATION',
  CHANGE_REQUESTED = 'CHANGE_REQUESTED',
}

export enum PurchaseStep {
  DA = 'DA',
  QR = 'QR',
  PV = 'PV',
  BC = 'BC',
  BR = 'BR',
  INVOICE = 'INVOICE',
  DAP = 'DAP',
  PROOF_OF_PAYMENT = 'PROOF_OF_PAYEMENT',
  DONE = 'DONE',
}

export class FilterPurchaseDto {
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsOptional()
  @IsEnum(PurchaseStep)
  step?: PurchaseStep;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
