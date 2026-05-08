import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddMaintenanceCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire',
    maxLength: 2000,
    example: 'Les pièces de rechange ont été commandées.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
