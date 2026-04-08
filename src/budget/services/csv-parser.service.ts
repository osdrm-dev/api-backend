import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export interface ParsedBudgetRow {
  projectName: string;
  projectCode: string;
  grantCode: string;
  activityCode: string;
  costCenter: string;
  region: string;
  site: string;
  budgetThreshold: number;
}

const REQUIRED_COLUMNS = [
  'nom_projet',
  'code_projet',
  'code_subvention',
  'code_activite',
  'centre_cout',
  'region',
  'site',
  'seuil_budgetaire',
] as const;

@Injectable()
export class CsvParserService {
  /**
   * Parse a CSV buffer for a Budget Table upload.
   * Validates required columns, numeric threshold, and uniqueness of project codes.
   */
  parseBudgetCsv(buffer: Buffer): ParsedBudgetRow[] {
    let records: Record<string, string>[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (err) {
      throw new BadRequestException(
        `Le fichier CSV est invalide: ${(err as Error).message}`,
      );
    }

    if (records.length === 0) {
      throw new BadRequestException('Le fichier CSV est vide.');
    }

    const headers = Object.keys(records[0]);
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Colonnes requises manquantes: ${missing.join(', ')}`,
      );
    }

    const rows: ParsedBudgetRow[] = [];
    const seenCodes = new Set<string>();
    const duplicates = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];

      // Skip fully empty rows
      const allEmpty = REQUIRED_COLUMNS.every(
        (col) => !raw[col] || String(raw[col]).trim() === '',
      );
      if (allEmpty) continue;

      const lineNumber = i + 2; // account for header row

      const projectCode = String(raw['code_projet'] ?? '').trim();
      const projectName = String(raw['nom_projet'] ?? '').trim();
      if (!projectCode) {
        throw new BadRequestException(
          `Ligne ${lineNumber}: le code_projet est obligatoire.`,
        );
      }
      if (!projectName) {
        throw new BadRequestException(
          `Ligne ${lineNumber}: le nom_projet est obligatoire.`,
        );
      }

      if (seenCodes.has(projectCode)) {
        duplicates.add(projectCode);
      } else {
        seenCodes.add(projectCode);
      }

      const rawThreshold = String(raw['seuil_budgetaire'] ?? '')
        .trim()
        .replace(/\s/g, '');
      const threshold = Number(rawThreshold);
      if (
        rawThreshold === '' ||
        Number.isNaN(threshold) ||
        !Number.isFinite(threshold) ||
        threshold < 0
      ) {
        throw new BadRequestException(
          `Ligne ${lineNumber}: seuil_budgetaire invalide ("${raw['seuil_budgetaire']}").`,
        );
      }

      rows.push({
        projectCode,
        projectName,
        grantCode: String(raw['code_subvention'] ?? '').trim(),
        activityCode: String(raw['code_activite'] ?? '').trim(),
        costCenter: String(raw['centre_cout'] ?? '').trim(),
        region: String(raw['region'] ?? '').trim(),
        site: String(raw['site'] ?? '').trim(),
        budgetThreshold: threshold,
      });
    }

    if (duplicates.size > 0) {
      throw new BadRequestException(
        `Codes projet en doublon dans le fichier: ${Array.from(duplicates).join(
          ', ',
        )}`,
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'Aucune ligne de projet valide dans le fichier CSV.',
      );
    }

    return rows;
  }
}
