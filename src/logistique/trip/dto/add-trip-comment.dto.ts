import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddTripCommentDto {
  @ApiProperty({ example: 'Le trajet a été effectué sans incident.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
