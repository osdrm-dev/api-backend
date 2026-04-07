import { Injectable } from '@nestjs/common';
import { ParsedBudgetRow } from './csv-parser.service';

export interface BudgetDiffEntry {
  projectCode: string;
  projectName: string;
}

export interface BudgetDiffModifiedEntry extends BudgetDiffEntry {
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface BudgetDiff {
  added: BudgetDiffEntry[];
  removed: BudgetDiffEntry[];
  modified: BudgetDiffModifiedEntry[];
  unchanged: BudgetDiffEntry[];
}

type ExistingProject = {
  projectCode: string;
  projectName: string;
  grantCode: string;
  activityCode: string;
  costCenter: string;
  region: string;
  site: string;
  budgetThreshold: number | string | { toString(): string };
};

const COMPARED_FIELDS: Array<keyof ParsedBudgetRow> = [
  'projectName',
  'grantCode',
  'activityCode',
  'costCenter',
  'region',
  'site',
  'budgetThreshold',
];

@Injectable()
export class BudgetDiffService {
  /**
   * Compute a diff (added / removed / modified / unchanged) between an
   * existing active table's projects and the incoming parsed rows.
   */
  computeDiff(
    current: ExistingProject[] | null | undefined,
    incoming: ParsedBudgetRow[],
  ): BudgetDiff {
    const currentMap = new Map<string, ExistingProject>();
    for (const p of current ?? []) currentMap.set(p.projectCode, p);

    const incomingMap = new Map<string, ParsedBudgetRow>();
    for (const p of incoming) incomingMap.set(p.projectCode, p);

    const diff: BudgetDiff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    };

    for (const [code, row] of incomingMap) {
      const existing = currentMap.get(code);
      if (!existing) {
        diff.added.push({
          projectCode: row.projectCode,
          projectName: row.projectName,
        });
        continue;
      }

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const field of COMPARED_FIELDS) {
        const oldRaw = (existing as any)[field];
        const newVal = row[field];
        const oldVal =
          field === 'budgetThreshold'
            ? Number(oldRaw?.toString ? oldRaw.toString() : oldRaw)
            : oldRaw;
        if (oldVal !== newVal) {
          changes[field] = { old: oldVal, new: newVal };
        }
      }

      if (Object.keys(changes).length > 0) {
        diff.modified.push({
          projectCode: row.projectCode,
          projectName: row.projectName,
          changes,
        });
      } else {
        diff.unchanged.push({
          projectCode: row.projectCode,
          projectName: row.projectName,
        });
      }
    }

    for (const [code, existing] of currentMap) {
      if (!incomingMap.has(code)) {
        diff.removed.push({
          projectCode: existing.projectCode,
          projectName: existing.projectName,
        });
      }
    }

    return diff;
  }
}
