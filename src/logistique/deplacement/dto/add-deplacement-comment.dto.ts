import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddDeplacementCommentDto {
  @ApiProperty({ example: 'Demande validée, véhicule réservé.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
