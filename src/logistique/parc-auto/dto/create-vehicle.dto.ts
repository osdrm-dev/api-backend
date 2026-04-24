import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Plaque d’immatriculation (unique)',
    example: '1234 TAA',
  })
  @IsString()
  @IsNotEmpty()
  immatriculation: string;

  @ApiProperty({
    description: 'Marque du véhicule',
    example: 'Toyota',
  })
  @IsString()
  @IsNotEmpty()
  marque: string;

  @ApiProperty({
    description: 'Modèle du véhicule',
    example: 'Hilux',
  })
  @IsString()
  @IsNotEmpty()
  modele: string;

  @ApiProperty({
    description: 'Année de mise en circulation',
    example: 2022,
    minimum: 1900,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  annee: number;
}
