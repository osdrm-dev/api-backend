import { IsOptional, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RejectPurchaseDto {
  @IsString()
  @IsNotEmpty({ message: 'Le commentaire est obligatoire' })
  @MinLength(10, {
    message: 'Le commentaire doit contenir au moins dix caractères ',
  })
  comment: string;
}
