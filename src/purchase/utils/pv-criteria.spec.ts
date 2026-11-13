import {
  PV_CRITERIA_KEYS,
  findAnswersError,
  findCommentsError,
  isEvaluationComplete,
} from './pv-criteria';

const full = Object.fromEntries(PV_CRITERIA_KEYS.map((k) => [k, 'Oui']));

describe('pv-criteria', () => {
  it('has 17 criteria', () => expect(PV_CRITERIA_KEYS).toHaveLength(17));
  it('accepts partial answers for known suppliers', () =>
    expect(findAnswersError({ s1: { sav: 'Non' } }, ['s1'])).toBeNull());
  it('rejects unknown supplier', () =>
    expect(findAnswersError({ sX: { sav: 'Oui' } }, ['s1'])).toMatch(/sX/));
  it('rejects unknown criterion', () =>
    expect(findAnswersError({ s1: { foo: 'Oui' } }, ['s1'])).toMatch(/foo/));
  it('rejects value outside list', () =>
    expect(findAnswersError({ s1: { sav: 'Yes' } }, ['s1'])).toMatch(/Yes/));
  it('rejects non-object', () =>
    expect(findAnswersError([], ['s1'])).not.toBeNull());
  it('complete only when every supplier has 17 answers', () => {
    expect(isEvaluationComplete({ s1: full, s2: full }, ['s1', 's2'])).toBe(
      true,
    );
    expect(isEvaluationComplete({ s1: full }, ['s1', 's2'])).toBe(false);
    expect(isEvaluationComplete({ s1: { ...full, sav: '' } }, ['s1'])).toBe(
      false,
    );
    expect(isEvaluationComplete(null, ['s1'])).toBe(false);
  });
  it('comments: string values on known keys only', () => {
    expect(findCommentsError({ sav: 'ok' })).toBeNull();
    expect(findCommentsError({ foo: 'x' })).not.toBeNull();
    expect(findCommentsError({ sav: 3 })).not.toBeNull();
  });
});
