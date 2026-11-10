// UTC+3 offset for Madagascar
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function toLocalDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + TZ_OFFSET_MS);
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // ISO week: Monday = day 1
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: date.getUTCFullYear(), week };
}

/**
 * Returns Thursday 23:59:59 UTC of the ISO week preceding dateDepart's ISO week,
 * adjusted for UTC+3 comparison (i.e., Thursday 20:59:59 UTC = Thursday 23:59:59 UTC+3).
 */
export function getThursdayCutoff(dateDepart: Date): Date {
  const local = toLocalDate(dateDepart);
  const { year, week } = getISOWeek(local);

  // Find Thursday of the preceding ISO week
  // ISO week 1 = week containing first Thursday of January
  // We use a direct calculation: find Monday of target week, then add 3 days (Thursday)
  const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 is always in ISO week 1
  const jan4Day = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);

  // Monday of the preceding week (week - 1)
  const targetMonday = new Date(
    weekOneMonday.getTime() + (week - 2) * 7 * 86400000,
  );
  // Thursday = Monday + 3 days
  const thursday = new Date(targetMonday.getTime() + 3 * 86400000);
  // Set to 23:59:59 local (UTC+3) = 20:59:59 UTC
  thursday.setUTCHours(20, 59, 59, 999);
  return thursday;
}

export function isAfterDeadline(
  dateDepart: Date,
  now: Date = new Date(),
): boolean {
  const cutoff = getThursdayCutoff(dateDepart);
  return now.getTime() > cutoff.getTime();
}
