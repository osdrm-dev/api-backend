import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignVehicleDto {
  @ApiProperty({
    description: 'Identifiant du véhicule à affecter',
    example: 'clxxx...',
  })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}
