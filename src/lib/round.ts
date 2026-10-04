export type Payer = { id: number; name: string };

/** Totals for the current round, derived from who is marked paid. Pure so the UI can recompute instantly. */
export function summarizeRound(payers: Payer[], paidIds: ReadonlySet<number>, amount: number) {
  const paid = payers.filter((p) => paidIds.has(p.id));
  const unpaid = payers.filter((p) => !paidIds.has(p.id));
  const collected = paid.length * amount;
  const expected = payers.length * amount;
  const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  return { paid, unpaid, collected, expected, pct };
}
