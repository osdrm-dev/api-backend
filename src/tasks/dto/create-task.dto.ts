import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Title of the task',
    example: 'Complete the projec report',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Description of the task',
    example: 'Write a detailed report on the project progress',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Status of the task',
    example: 'TODO',
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}
