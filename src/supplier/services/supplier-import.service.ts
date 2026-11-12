import { Injectable, HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { SupplierActiveStatus } from '@prisma/client';
import type { File as MulterFile } from 'multer';
import { SupplierRepository } from 'src/repository/supplier/supplier.repository';
import {
  normalizeSupplierName,
  parseSupplierCsv,
  ParsedSupplierRow,
  SkippedSupplierRow,
} from '../utils/supplier-csv-parser.util';

const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];

export interface SupplierImportReport {
  created: number;
  toCreate: ParsedSupplierRow[];
  skipped: SkippedSupplierRow[];
}

@Injectable()
export class SupplierImportService {
  constructor(private readonly repository: SupplierRepository) {}

  /** Importe le CSV du modèle « Liste des fournisseurs » ; les fournisseurs déjà connus sont ignorés. */
  async importCsv(
    file: MulterFile,
    options: { potential: boolean; dryRun: boolean },
  ): Promise<SupplierImportReport> {
    if (!file)
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SUPPLIER_IMPORT_FILE_MISSING,
        'CSV file is missing',
      );
    if (file.size > MAX_CSV_SIZE)
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SUPPLIER_IMPORT_FILE_TOO_LARGE,
        'CSV file exceeds 5 MB',
      );
    if (!ALLOWED_MIME.includes(file.mimetype))
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SUPPLIER_IMPORT_FILE_TYPE_UNSUPPORTED,
        `Unsupported file type (${file.mimetype}): export the sheet as CSV`,
      );

    const { rows, skipped } = parseSupplierCsv(file.buffer);

    const existing = await this.repository.findAllIdentities();
    const knownNames = new Set(
      existing.map((s) => normalizeSupplierName(s.name)),
    );
    const knownNifs = new Set(existing.map((s) => s.nif).filter(Boolean));

    const toCreate: ParsedSupplierRow[] = [];
    for (const row of rows) {
      if (
        knownNames.has(normalizeSupplierName(row.name)) ||
        (row.nif && knownNifs.has(row.nif))
      ) {
        skipped.push({ line: row.line, name: row.name, reason: 'Existe déjà' });
      } else {
        toCreate.push(row);
      }
    }
    skipped.sort((a, b) => a.line - b.line);

    if (options.dryRun || toCreate.length === 0) {
      return { created: toCreate.length, toCreate, skipped };
    }

    const activeStatus = options.potential
      ? SupplierActiveStatus.POTENTIAL
      : SupplierActiveStatus.ACTIVE;
    const { count } = await this.repository.createMany(
      toCreate.map(({ line: _line, ...data }) => ({ ...data, activeStatus })),
    );
    return { created: count, toCreate, skipped };
  }
}
