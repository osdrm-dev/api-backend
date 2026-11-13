import { getExpectedEvaluatorIds } from './pv-evaluators';

const v = (userId: number | null) => ({ userId });

describe('getExpectedEvaluatorIds', () => {
  it('new PV: DA validators with userId, deduped', () =>
    expect(
      getExpectedEvaluatorIds({
        daEvaluationsRequired: true,
        acheteurId: 9,
        daValidators: [v(1), v(null), v(2), v(1)],
      }),
    ).toEqual([1, 2]));

  it('legacy PV: buyer only', () =>
    expect(
      getExpectedEvaluatorIds({
        daEvaluationsRequired: false,
        acheteurId: 9,
        daValidators: [v(1)],
      }),
    ).toEqual([9]));

  it('legacy PV without buyer: nobody', () =>
    expect(
      getExpectedEvaluatorIds({
        daEvaluationsRequired: false,
        acheteurId: null,
        daValidators: [],
      }),
    ).toEqual([]));
});
