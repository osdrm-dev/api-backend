import { EquipmentStatus } from '@prisma/client';

const UNUSABLE_STATUSES: EquipmentStatus[] = [
  EquipmentStatus.EN_PANNE,
  EquipmentStatus.HORS_SERVICE,
];

export interface StockEquipment {
  categoryId: string;
  category?: { name: string; alertThreshold: number } | null;
  brand?: string | null;
  model?: string | null;
  status: EquipmentStatus;
  archivedAt: Date | null;
  attributions?: { status: string }[];
}

export const isAttributed = (e: StockEquipment) =>
  (e.attributions ?? []).some((a) => a.status === 'ACTIVE');

export const isBroken = (e: StockEquipment) =>
  UNUSABLE_STATUSES.includes(e.status);

/** Disponible = non archivé, utilisable, sans attribution active. */
export const isEquipmentAvailable = (e: StockEquipment) =>
  e.archivedAt === null && !isBroken(e) && !isAttributed(e);

interface StockCounts {
  total: number;
  attributed: number;
  broken: number;
  available: number;
}

function count(rows: StockEquipment[]): StockCounts {
  return {
    total: rows.length,
    attributed: rows.filter(isAttributed).length,
    broken: rows.filter(isBroken).length,
    available: rows.filter(isEquipmentAvailable).length,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

/**
 * Stock par catégorie. `categories` (catégories actives) permet d'inclure celles
 * qui n'ont aucun matériel : ce sont les plus en rupture.
 */
export function groupStockByCategory(
  rows: StockEquipment[],
  categories: { id: string; name: string; alertThreshold: number }[] = [],
) {
  const byCategory = groupBy(rows, (r) => r.categoryId);
  for (const c of categories)
    if (!byCategory.has(c.id)) byCategory.set(c.id, []);
  const meta = new Map(categories.map((c) => [c.id, c]));
  return [...byCategory.entries()].map(([categoryId, items]) => {
    const category = meta.get(categoryId) ?? items[0]?.category;
    const alertThreshold = category?.alertThreshold ?? 0;
    const counts = count(items);
    return {
      categoryId,
      category: category?.name ?? 'Inconnue',
      alertThreshold,
      ...counts,
      belowThreshold: counts.available < alertThreshold,
    };
  });
}

export function groupStockByModel(rows: StockEquipment[]) {
  return [
    ...groupBy(
      rows,
      (r) => `${r.categoryId}|${r.brand ?? ''}|${r.model ?? ''}`,
    ).values(),
  ].map((items) => ({
    categoryId: items[0].categoryId,
    category: items[0].category?.name ?? 'Inconnue',
    brand: items[0].brand ?? null,
    model: items[0].model ?? null,
    ...count(items),
  }));
}
