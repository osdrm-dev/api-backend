export interface HolderAttribution {
  id: string;
  attributedAt: Date;
  beneficiary: { id: number; name: string; email: string; role: string } | null;
  asset: { categoryId: string };
}

/**
 * Regroupe les attributions ACTIVES par détenteur. Avec `categoryId`, ne garde que
 * les détenteurs ayant au moins un matériel de cette catégorie (avec tout leur matériel).
 */
export function groupAttributionsByHolder<T extends HolderAttribution>(
  rows: T[],
  categoryId?: string,
) {
  const byUser = new Map<number, T[]>();
  for (const r of rows) {
    if (!r.beneficiary) continue; // attribution sans détenteur (compte supprimé)
    byUser.set(r.beneficiary.id, [...(byUser.get(r.beneficiary.id) ?? []), r]);
  }
  return [...byUser.values()]
    .filter(
      (items) =>
        !categoryId || items.some((a) => a.asset.categoryId === categoryId),
    )
    .map((items) => ({
      user: items[0].beneficiary!,
      equipmentCount: items.length,
      oldestAttributedAt: new Date(
        Math.min(...items.map((a) => a.attributedAt.getTime())),
      ),
      attributions: items,
    }))
    .sort(
      (a, b) =>
        b.equipmentCount - a.equipmentCount ||
        a.user.name.localeCompare(b.user.name),
    );
}
