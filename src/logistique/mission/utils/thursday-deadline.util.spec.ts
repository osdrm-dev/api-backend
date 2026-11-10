import { getThursdayCutoff, isAfterDeadline } from './thursday-deadline.util';

// ISO week helpers — given a year, returns Monday of ISO week W (UTC dates)
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  return new Date(weekOneMonday.getTime() + (week - 1) * 7 * 86400000);
}

describe('thursday-deadline.util', () => {
  describe('getThursdayCutoff', () => {
    it('returns Thursday 23:59:59 UTC+3 of the preceding ISO week', () => {
      // 2026-05-11 is Monday of ISO week 20
      // Departure in week 20 → cutoff should be Thursday of week 19
      const dateDepart = new Date('2026-05-11T00:00:00.000Z'); // Monday week 20
      const cutoff = getThursdayCutoff(dateDepart);

      // Thursday of week 19 = 2026-05-07 23:59:59 UTC+3 = 2026-05-07 20:59:59 UTC
      expect(cutoff.getUTCFullYear()).toBe(2026);
      expect(cutoff.getUTCMonth()).toBe(4); // May
      expect(cutoff.getUTCDate()).toBe(7); // May 7
      expect(cutoff.getUTCHours()).toBe(20);
      expect(cutoff.getUTCMinutes()).toBe(59);
      expect(cutoff.getUTCSeconds()).toBe(59);
    });

    it('handles departure on Sunday (end of ISO week)', () => {
      // 2026-05-17 is Sunday of ISO week 20
      // Departure in week 20 → cutoff Thursday of week 19
      const dateDepart = new Date('2026-05-17T00:00:00.000Z');
      const cutoff = getThursdayCutoff(dateDepart);
      expect(cutoff.getUTCDate()).toBe(7); // May 7 (Thursday of week 19)
    });

    it('returns cutoff in week preceding the week containing dateDepart', () => {
      // 2026-01-05 (Monday, week 2) → cutoff = Thursday of week 1 (Jan 1 2026 = Thursday)
      const dateDepart = new Date('2026-01-05T00:00:00.000Z');
      const cutoff = getThursdayCutoff(dateDepart);
      expect(cutoff.getUTCDate()).toBe(1); // Jan 1 = Thursday of week 1
      expect(cutoff.getUTCMonth()).toBe(0); // January
    });
  });

  describe('isAfterDeadline', () => {
    const dateDepart = new Date('2026-05-11T00:00:00.000Z'); // Monday week 20

    it('returns false when submission is on Wednesday (2026-05-06)', () => {
      const now = new Date('2026-05-06T10:00:00.000Z'); // Wednesday
      expect(isAfterDeadline(dateDepart, now)).toBe(false);
    });

    it('returns false when submission is on Thursday before cutoff (2026-05-07 20:59:58 UTC)', () => {
      const now = new Date('2026-05-07T20:59:58.000Z'); // 1 second before cutoff
      expect(isAfterDeadline(dateDepart, now)).toBe(false);
    });

    it('returns false exactly at cutoff (Thursday 23:59:59 UTC+3)', () => {
      const now = new Date('2026-05-07T20:59:59.999Z'); // at cutoff
      expect(isAfterDeadline(dateDepart, now)).toBe(false);
    });

    it('returns true when submission is on Friday (2026-05-08)', () => {
      const now = new Date('2026-05-08T08:00:00.000Z'); // Friday
      expect(isAfterDeadline(dateDepart, now)).toBe(true);
    });

    it('returns true when submission is on Saturday (day before departure week)', () => {
      const now = new Date('2026-05-09T08:00:00.000Z'); // Saturday
      expect(isAfterDeadline(dateDepart, now)).toBe(true);
    });

    it('returns true when submission is on Monday of departure week', () => {
      const now = new Date('2026-05-11T06:00:00.000Z'); // same Monday as departure
      expect(isAfterDeadline(dateDepart, now)).toBe(true);
    });
  });
});
