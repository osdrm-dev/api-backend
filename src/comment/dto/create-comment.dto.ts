import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire',
    maxLength: 2000,
    example: 'Merci de vérifier les quantités demandées.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
