/**
 * Shared data helper utilities used across modules.
 * These are extracted to keep services focused on business logic.
 */

/**
 * Aggregates numeric values from an array of items.
 * Used for summing amounts, counts, etc.
 */
export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

/**
 * Groups items by a key selector and aggregates them.
 * Returns a Map where each key maps to aggregated values.
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keySelector: (item: T) => K,
  aggregator?: (group: T[]) => any,
): Map<K, any> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = keySelector(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  if (aggregator) {
    const aggregated = new Map<K, any>();
    for (const [key, group] of grouped.entries()) {
      aggregated.set(key, aggregator(group));
    }
    return aggregated;
  }
  return grouped;
}

/**
 * Enriches an object with computed fields derived from related data.
 * Returns null if the base object is null/undefined.
 */
export function enrich<T, R extends Record<string, any>>(
  item: T | null | undefined,
  enricher: (item: T) => R,
): (T & R) | null {
  return item ? { ...item, ...enricher(item) } : null;
}

/**
 * Normalizes a string for comparison and deduplication.
 * Trims whitespace and converts to lowercase.
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().toLowerCase();
}

/**
 * Generates a display name from a normalized key, preserving original casing if possible.
 * Useful for market types, regions, etc. where we deduplicate but want nice display.
 */
export function createDisplayMap<T>(
  items: T[],
  keySelector: (item: T) => string,
): Map<string, string> {
  const displayMap = new Map<string, string>();
  for (const item of items) {
    const key = keySelector(item);
    const normalized = normalizeString(key) || 'unknown';
    // Keep first original value found for display
    if (!displayMap.has(normalized)) {
      displayMap.set(normalized, key || 'Non spécifié');
    }
  }
  return displayMap;
}

/**
 * Safely parses a number with a default fallback.
 */
export function parseNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Calculates percentage of items matching a condition.
 */
export function percentageOf<T>(
  items: T[],
  predicate: (item: T) => boolean,
): number {
  if (items.length === 0) return 0;
  const matched = items.filter(predicate).length;
  return (matched / items.length) * 100;
}

/**
 * Calculates median of a sorted array.
 */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
