import { Injectable, HttpStatus } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { AppException, ErrorCode } from 'src/common/errors';

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
   * Validates required columns, numeric threshold, and uniqueness of activity codes.
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
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_INVALID,
        `Invalid CSV file: ${(err as Error).message}`,
      );
    }

    if (records.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_EMPTY,
        'CSV file is empty',
      );
    }

    const headers = Object.keys(records[0]);
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_COLUMNS_MISSING,
        `Missing required columns: ${missing.join(', ')}`,
        { params: { columns: missing.join(', ') } },
      );
    }

    const rows: ParsedBudgetRow[] = [];
    const seenActivityCodes = new Set<string>();
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
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.BUDGET_CSV_ROW_FIELD_REQUIRED,
          `Line ${lineNumber}: code_projet is required`,
          { params: { line: lineNumber, field: 'code_projet' } },
        );
      }
      if (!projectName) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.BUDGET_CSV_ROW_FIELD_REQUIRED,
          `Line ${lineNumber}: nom_projet is required`,
          { params: { line: lineNumber, field: 'nom_projet' } },
        );
      }

      const activityCode = String(raw['code_activite'] ?? '').trim();
      if (!activityCode) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.BUDGET_CSV_ROW_FIELD_REQUIRED,
          `Line ${lineNumber}: code_activite is required`,
          { params: { line: lineNumber, field: 'code_activite' } },
        );
      }

      if (seenActivityCodes.has(activityCode)) {
        duplicates.add(activityCode);
      } else {
        seenActivityCodes.add(activityCode);
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
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.BUDGET_CSV_ROW_THRESHOLD_INVALID,
          `Line ${lineNumber}: invalid seuil_budgetaire ("${raw['seuil_budgetaire']}")`,
          {
            params: {
              line: lineNumber,
              value: String(raw['seuil_budgetaire']),
            },
          },
        );
      }

      rows.push({
        projectCode,
        projectName,
        grantCode: String(raw['code_subvention'] ?? '').trim(),
        activityCode,
        costCenter: String(raw['centre_cout'] ?? '').trim(),
        region: String(raw['region'] ?? '').trim(),
        site: String(raw['site'] ?? '').trim(),
        budgetThreshold: threshold,
      });
    }

    if (duplicates.size > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_DUPLICATE_ACTIVITY_CODES,
        `Duplicate activity codes in file: ${Array.from(duplicates).join(', ')}`,
        { params: { codes: Array.from(duplicates).join(', ') } },
      );
    }

    if (rows.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_NO_VALID_ROWS,
        'No valid project row in the CSV file',
      );
    }

    return rows;
  }
}
