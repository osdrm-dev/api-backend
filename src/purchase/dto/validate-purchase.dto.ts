import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export enum ValidationDecision {
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  CHANGE_REQUESTED = 'CHANGE_REQUESTED',
}

export class ValidatePurchaseDto {
  @IsNotEmpty()
  @IsEnum(ValidationDecision)
  decision: ValidationDecision;

  @IsOptional()
  @IsString()
  comment?: string;
}
