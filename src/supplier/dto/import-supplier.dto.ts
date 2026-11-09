import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Champs multipart : arrivent en chaîne « true » / « false ».
const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

export class ImportSupplierDto {
  @ApiPropertyOptional({
    description: 'Importer comme fournisseurs potentiels',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  potential?: boolean;

  @ApiPropertyOptional({
    description: "Aperçu seulement, rien n'est enregistré",
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  dryRun?: boolean;
}
