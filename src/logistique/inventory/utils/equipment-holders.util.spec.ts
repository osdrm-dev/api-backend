import { groupAttributionsByHolder } from './equipment-holders.util';

const alice = { id: 1, name: 'Alice', email: 'alice@x.mg', role: 'DEMANDEUR' };
const bob = { id: 2, name: 'Bob', email: 'bob@x.mg', role: 'OM' };

const att = (
  id: string,
  beneficiary: any,
  attributedAt: string,
  categoryId = 'c1',
) => ({
  id,
  beneficiary,
  attributedAt: new Date(attributedAt),
  asset: { id: `e-${id}`, categoryId },
});

describe('groupAttributionsByHolder', () => {
  const rows = [
    att('a1', alice, '2026-05-01'),
    att('a2', bob, '2026-03-01', 'c2'),
    att('a3', alice, '2026-01-15', 'c2'),
  ];

  it('groups active attributions by beneficiary with count and oldest date', () => {
    const holders = groupAttributionsByHolder(rows);
    const a = holders.find((h) => h.user.id === 1)!;
    expect(a.equipmentCount).toBe(2);
    expect(a.oldestAttributedAt).toEqual(new Date('2026-01-15'));
    expect(a.attributions.map((x) => x.id)).toEqual(['a1', 'a3']);
  });

  it('sorts holders by equipment count desc, then name', () => {
    expect(groupAttributionsByHolder(rows).map((h) => h.user.name)).toEqual([
      'Alice',
      'Bob',
    ]);
  });

  it('keeps only holders having an equipment of the category, with all their equipment', () => {
    const holders = groupAttributionsByHolder(rows, 'c1');
    expect(holders.map((h) => h.user.name)).toEqual(['Alice']);
    expect(holders[0].equipmentCount).toBe(2);
  });

  it('ignores attributions without beneficiary', () => {
    expect(groupAttributionsByHolder([att('a9', null, '2026-01-01')])).toEqual(
      [],
    );
  });

  it('returns an empty list when nothing is attributed', () => {
    expect(groupAttributionsByHolder([])).toEqual([]);
  });
});
