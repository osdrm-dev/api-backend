export interface ExpectedEvaluatorsInput {
  daEvaluationsRequired: boolean;
  acheteurId: number | null;
  daValidators: { userId: number | null }[];
}

// Legacy PVs (no DA evaluations) are evaluated by the buyer only.
export function getExpectedEvaluatorIds(
  input: ExpectedEvaluatorsInput,
): number[] {
  const ids = input.daEvaluationsRequired
    ? input.daValidators.map((validator) => validator.userId)
    : [input.acheteurId];
  return [...new Set(ids.filter((id): id is number => id !== null))];
}
