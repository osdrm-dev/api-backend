import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RequestChangesDto {
  @IsString()
  @IsNotEmpty({ message: 'Le commentaire est obligatoire' })
  @MinLength(10, {
    message: 'Le commentaire doit contenir au moins 10 caractères',
  })
  reason: string;
}
