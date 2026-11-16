export const PV_CRITERIA_KEYS = [
  'reponseDansDelai',
  'annexe1',
  'devisSpecifications',
  'regulariteFiscale',
  'copiecin',
  'conformiteSpecs',
  'distanceBureaux',
  'delaiLivraison',
  'sav',
  'disponibiliteArticles',
  'qualiteArticles',
  'experienceAnterieure',
  'producteurOuSousTraitant',
  'echantillonBat',
  'validiteOffre',
  'modePaiement',
  'delaiPaiement',
] as const;

export type PVCriterionKey = (typeof PV_CRITERIA_KEYS)[number];

export const PV_ANSWER_VALUES = ['N/A', 'Oui', 'Non', 'Partiel'] as const;

// Keyed by Supplier.id (not PVSupplier.id, which is recreated on every PV update).
export type PVAnswers = Record<string, Partial<Record<PVCriterionKey, string>>>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isKey = (k: string): k is PVCriterionKey =>
  (PV_CRITERIA_KEYS as readonly string[]).includes(k);

/** Shape check only: a partial grid is accepted. */
export function findAnswersError(
  answers: unknown,
  supplierIds: string[],
): string | null {
  if (!isPlainObject(answers)) return 'answers must be an object';
  for (const [supplierId, grid] of Object.entries(answers)) {
    if (!supplierIds.includes(supplierId))
      return `Unknown supplier: ${supplierId}`;
    if (!isPlainObject(grid))
      return `Answers for supplier ${supplierId} must be an object`;
    for (const [key, value] of Object.entries(grid)) {
      if (!isKey(key)) return `Unknown criterion: ${key}`;
      if (!(PV_ANSWER_VALUES as readonly unknown[]).includes(value))
        return `Invalid answer for ${key}: ${String(value)}`;
    }
  }
  return null;
}

export function isEvaluationComplete(
  answers: PVAnswers | null,
  supplierIds: string[],
): boolean {
  if (!answers) return false;
  return supplierIds.every((id) =>
    PV_CRITERIA_KEYS.every((k) =>
      (PV_ANSWER_VALUES as readonly unknown[]).includes(answers[id]?.[k]),
    ),
  );
}

export function findCommentsError(comments: unknown): string | null {
  if (!isPlainObject(comments)) return 'criteriaComments must be an object';
  for (const [key, value] of Object.entries(comments)) {
    if (!isKey(key)) return `Unknown criterion: ${key}`;
    if (typeof value !== 'string') return `Comment for ${key} must be a string`;
  }
  return null;
}
