import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { parse } from 'csv-parse/sync';

export interface ParsedSupplierRow {
  /** Numéro de ligne Excel (1 = première ligne du fichier). */
  line: number;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactPosition?: string;
  nif?: string;
  stat?: string;
  rcs?: string;
  languages?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}

export interface SkippedSupplierRow {
  line: number;
  name: string;
  reason: string;
}

type Column =
  | 'name'
  | 'category'
  | 'address'
  | 'city'
  | 'country'
  | 'contactName'
  | 'contactPosition'
  | 'identity'
  | 'rcs'
  | 'languages'
  | 'email'
  | 'phone'
  | 'website'
  | 'documents'
  | 'remarks';

const normalizeHeader = (h: string) =>
  h
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

/** Clé de comparaison des noms (doublons) : sans accents, casse ni espaces multiples. */
export const normalizeSupplierName = (name: string) =>
  normalizeHeader(name).toLowerCase();

/** En-têtes du modèle « Liste des fournisseurs MADA » ; les autres colonnes (évaluation) sont ignorées. */
function columnOf(header: string): Column | undefined {
  const h = normalizeHeader(header);
  if (h === 'FOURNISSEUR') return 'name';
  if (h === 'CATEGORIE') return 'category';
  if (h === 'ADRESSE') return 'address';
  if (h === 'VILLE') return 'city';
  if (h === 'PAYS') return 'country';
  if (h.startsWith('CONTACT')) return 'contactName';
  if (h === 'FONCTION') return 'contactPosition';
  if (h.includes('IDENTITE')) return 'identity';
  if (h.includes('KBIS')) return 'rcs';
  if (h === 'LANGUES') return 'languages';
  if (h === 'ADRESSE MAIL') return 'email';
  if (h.startsWith('TELEPHONE')) return 'phone';
  if (h === 'SITE INTERNET') return 'website';
  if (h.startsWith('PIECES JUSTIFICATIVES')) return 'documents';
  if (h === 'REMARQUES') return 'remarks';
  return undefined;
}

/** Excel FR exporte en Windows-1252 ; un vrai UTF-8 (avec ou sans BOM) est essayé d'abord. */
function decode(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Essaie « ; » (Excel FR) puis « , » et garde celui qui fait apparaître la colonne FOURNISSEUR. */
function readRecords(text: string): {
  records: string[][];
  headerIndex: number;
} {
  for (const delimiter of [';', ',']) {
    let records: string[][];
    try {
      records = parse(text, {
        delimiter,
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: false,
      });
    } catch {
      continue;
    }
    const headerIndex = records.findIndex((r) =>
      r.some((c) => columnOf(c) === 'name'),
    );
    if (headerIndex >= 0) return { records, headerIndex };
  }
  throw new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.SUPPLIER_IMPORT_COLUMN_MISSING,
    'Supplier name column is missing from the CSV file',
  );
}

const oneLine = (v?: string) => v?.replace(/\s+/g, ' ').trim() || undefined;
const digitsAfter = (label: string, v: string) =>
  v
    .match(new RegExp(`${label}\\s*:?\\s*([\\d\\s]+)`, 'i'))?.[1]
    .replace(/\s/g, '') || undefined;

export function parseSupplierCsv(buffer: Buffer): {
  rows: ParsedSupplierRow[];
  skipped: SkippedSupplierRow[];
} {
  const { records, headerIndex } = readRecords(decode(buffer));
  const columns = records[headerIndex].map(columnOf);

  const rows: ParsedSupplierRow[] = [];
  const skipped: SkippedSupplierRow[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < records.length; i++) {
    const cell: Partial<Record<Column, string>> = {};
    columns.forEach((col, j) => {
      if (col && records[i][j]?.trim()) cell[col] = records[i][j].trim();
    });
    const name = oneLine(cell.name);
    if (!name) continue;
    const line = i + 1;

    const identity = cell.identity ?? '';
    const nif = digitsAfter('NIF', identity);
    const stat = digitsAfter('STAT', identity);
    const notes = [
      cell.documents,
      cell.remarks,
      identity && !nif && !stat
        ? `Pièce d'identité : ${oneLine(identity)}`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const keys = [
      `name:${normalizeSupplierName(name)}`,
      nif && `nif:${nif}`,
    ].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) {
      skipped.push({ line, name, reason: 'Doublon dans le fichier' });
      continue;
    }
    keys.forEach((k) => seen.add(k));

    rows.push({
      line,
      name,
      category: oneLine(cell.category),
      address: oneLine(cell.address),
      city: oneLine(cell.city),
      country: oneLine(cell.country),
      contactName: oneLine(cell.contactName),
      contactPosition: oneLine(cell.contactPosition),
      nif,
      stat,
      rcs: oneLine(cell.rcs),
      languages: oneLine(cell.languages),
      email: cell.email?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0],
      phone: oneLine(cell.phone),
      website: oneLine(cell.website),
      notes: notes || undefined,
    });
  }

  return { rows, skipped };
}
