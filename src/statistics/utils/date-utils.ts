/**
 * Utility functions for date manipulation in KPI calculations.
 * Extracted to keep services focused on business logic.
 */

/**
 * Converts a Date to YYYY-MM format string (month key for aggregations).
 */
export function toMonthKey(date: Date): string {
  return date.toISOString().substring(0, 7);
}

/**
 * Builds a Map of the 12 months preceding dateTo (inclusive).
 * Used to initialize monthly aggregations so all months appear in results.
 */
export function buildEmptyMonthlyMap(
  dateTo: Date,
): Map<string, { total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(dateTo);
    d.setMonth(d.getMonth() - i);
    map.set(toMonthKey(d), { total: 0, count: 0 });
  }
  return map;
}

/**
 * Builds an empty monthly series (array of months with 0 values).
 * Convenience wrapper around buildEmptyMonthlyMap for series output.
 */
export function buildEmptyMonthlySeries(
  dateTo: Date,
): Array<{ month: string; avgDelay: number; count: number }> {
  return Array.from(buildEmptyMonthlyMap(dateTo).keys()).map((month) => ({
    month,
    avgDelay: 0,
    count: 0,
  }));
}

/**
 * Rounds a number to 1 decimal place.
 * Used for KPI display values (delays in days, percentages, etc.).
 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
