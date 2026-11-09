import { EquipmentStatus } from '@prisma/client';
import {
  isEquipmentAvailable,
  groupStockByCategory,
  groupStockByModel,
} from './equipment-stock.util';

const cat = (id: string, alertThreshold = 1) => ({
  id,
  name: `Cat ${id}`,
  alertThreshold,
});

function eq(overrides: any = {}) {
  return {
    id: Math.random().toString(),
    categoryId: 'c1',
    category: cat('c1', 2),
    brand: 'Apple',
    model: 'iPhone 17',
    status: EquipmentStatus.NEUF,
    archivedAt: null,
    attributions: [],
    ...overrides,
  };
}

describe('isEquipmentAvailable', () => {
  it('is available when not archived, not broken, not attributed', () => {
    expect(isEquipmentAvailable(eq())).toBe(true);
  });

  it('is not available when attributed (ACTIVE)', () => {
    expect(
      isEquipmentAvailable(eq({ attributions: [{ status: 'ACTIVE' }] })),
    ).toBe(false);
  });

  it('is not available when EN_PANNE or HORS_SERVICE', () => {
    expect(isEquipmentAvailable(eq({ status: EquipmentStatus.EN_PANNE }))).toBe(
      false,
    );
    expect(
      isEquipmentAvailable(eq({ status: EquipmentStatus.HORS_SERVICE })),
    ).toBe(false);
  });

  it('is not available when archived', () => {
    expect(isEquipmentAvailable(eq({ archivedAt: new Date() }))).toBe(false);
  });
});

describe('groupStockByCategory', () => {
  it('counts total / attributed / broken / available and flags below threshold', () => {
    const rows = groupStockByCategory([
      eq(),
      eq({ attributions: [{ status: 'ACTIVE' }] }),
      eq({ status: EquipmentStatus.EN_PANNE }),
      eq({ categoryId: 'c2', category: cat('c2', 1) }),
    ]);
    const c1 = rows.find((r) => r.categoryId === 'c1')!;
    expect(c1).toMatchObject({
      total: 3,
      attributed: 1,
      broken: 1,
      available: 1,
      alertThreshold: 2,
      belowThreshold: true,
    });
    const c2 = rows.find((r) => r.categoryId === 'c2')!;
    expect(c2).toMatchObject({ total: 1, available: 1, belowThreshold: false });
  });
});

describe('groupStockByModel', () => {
  it('groups by brand + model', () => {
    const rows = groupStockByModel([eq(), eq(), eq({ model: 'MacBook Air' })]);
    expect(rows).toHaveLength(2);
    expect(
      rows.find((r) => r.model === 'iPhone 17' && r.brand === 'Apple')?.total,
    ).toBe(2);
  });
});

describe('groupStockByCategory with categories list', () => {
  it('flags an empty category below its threshold', () => {
    const rows = groupStockByCategory(
      [eq()],
      [cat('c1', 2), { id: 'empty', name: 'Vide', alertThreshold: 1 }],
    );
    expect(rows.find((r) => r.categoryId === 'empty')).toMatchObject({
      total: 0,
      available: 0,
      belowThreshold: true,
    });
  });
});
