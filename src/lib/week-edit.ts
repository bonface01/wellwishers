// Pure helpers for correcting and adding past weeks.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as yyyy-mm-dd. */
export function isRealDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isSunday(value: string): boolean {
  if (!isRealDate(value)) return false;
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === 0;
}

/** The payout moment for a Sunday: 18:00 Nairobi time, which is 15:00 UTC (Nairobi has no daylight saving). */
export function sundayPayoutAt(value: string): Date {
  const [y, mo, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 15, 0, 0));
}

/** yyyy-mm-dd for a stored payout time, in Nairobi. Used to prefill date inputs. */
export function dateInputValue(d: Date): string {
  const nairobi = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return nairobi.toISOString().slice(0, 10);
}

/** Total for a week: number of payers times the amount each paid, to the cent. */
export function weekTotal(paidCount: number, contribution: number): number {
  return Math.round(paidCount * contribution * 100) / 100;
}

export type NewWeekInput = {
  week: number;
  date: string;
  recipientName: string | null;
  currentRound: number;
  existingRounds: number[];
};

/** Returns a human-readable problem, or null when the new week can be added. */
export function validateNewWeek(i: NewWeekInput): string | null {
  if (!Number.isInteger(i.week) || i.week < 1) return "Enter the week number as a whole number, 1 or higher.";
  if (i.week >= i.currentRound) {
    return `Week ${i.week} is not in the past. The current week is ${i.currentRound}, so add weeks 1 to ${i.currentRound - 1}.`;
  }
  if (i.existingRounds.includes(i.week)) return `Week ${i.week} is already in the history. Open it from the list to correct it.`;
  if (!i.date) return "Choose the Sunday date for that week.";
  if (!isRealDate(i.date)) return "That date is not valid.";
  if (!isSunday(i.date)) return "Weeks end on a Sunday. Choose a Sunday date.";
  if (!i.recipientName) return "Choose who received that week's pot.";
  return null;
}

export type ChecklistMember = { id: number; name: string };
export type SavedPayment = { memberId: number | null; name: string };
export type ChecklistRow = { name: string; memberId: number | null; former: boolean; paid: boolean };

/**
 * Rows for a week's paid/not-paid checklist. Everyone currently in the group can be ticked (the recipient is left
 * out when the recipient did not contribute that week). Anyone who paid but has since been removed stays on the
 * list, marked as a former member, so their payment is not lost when the week is corrected.
 */
export function buildChecklist(opts: {
  members: ChecklistMember[];
  saved: SavedPayment[];
  recipientName: string | null;
  recipientPays: boolean;
}): ChecklistRow[] {
  const savedNames = new Set(opts.saved.map((s) => s.name));
  const rows: ChecklistRow[] = [];
  const current = new Set<string>();
  for (const m of opts.members) {
    current.add(m.name);
    const isRecipient = m.name === opts.recipientName;
    if (isRecipient && !opts.recipientPays && !savedNames.has(m.name)) continue;
    rows.push({ name: m.name, memberId: m.id, former: false, paid: savedNames.has(m.name) });
  }
  for (const s of opts.saved) {
    if (!current.has(s.name)) rows.push({ name: s.name, memberId: null, former: true, paid: true });
  }
  return rows;
}

/** Who was newly ticked and who was unticked, for the "are you sure?" step. */
export function diffPaid(before: ReadonlySet<string>, after: ReadonlySet<string>) {
  return {
    added: [...after].filter((n) => !before.has(n)).sort(),
    removed: [...before].filter((n) => !after.has(n)).sort(),
  };
}

/** Keeps only names that are allowed on this week's checklist, once each. */
export function sanitizePaidNames(submitted: string[], allowed: string[]): string[] {
  const ok = new Set(allowed);
  return [...new Set(submitted.map((s) => s.trim()))].filter((n) => ok.has(n));
}
