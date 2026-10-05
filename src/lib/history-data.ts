import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { history, historyPayments, members } from "@/db/schema";
import { getGroup } from "./data";
import { comparePayoutOrder, fullName } from "./names";
import { buildChecklist, type ChecklistRow } from "./week-edit";

export type HistoryListRow = {
  id: number;
  round: number;
  recipientName: string;
  date: Date;
  amount: number;
  /** null for weeks recorded before per-member payments were kept. */
  paidCount: number | null;
};

export async function getHistoryList(): Promise<HistoryListRow[]> {
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(history).orderBy(desc(history.round), desc(history.id)),
    db
      .select({ historyId: historyPayments.historyId, n: sql<number>`count(*)::int` })
      .from(historyPayments)
      .groupBy(historyPayments.historyId),
  ]);
  const paid = new Map(counts.map((c) => [c.historyId, Number(c.n)]));
  return rows.map((h) => ({
    id: h.id,
    round: h.round,
    recipientName: h.recipientName,
    date: h.date,
    amount: Number(h.amount),
    // A week closed (or corrected) since the change always has a contribution saved, even if nobody paid.
    paidCount: h.contribution === null ? null : (paid.get(h.id) ?? 0),
  }));
}

export async function getWeek(round: number) {
  const db = getDb();
  const [row] = await db.select().from(history).where(eq(history.round, round)).orderBy(desc(history.id)).limit(1);
  if (!row) return null;
  const [group, saved, memberRows] = await Promise.all([
    getGroup(),
    db.select().from(historyPayments).where(eq(historyPayments.historyId, row.id)),
    db.select().from(members),
  ]);
  const contribution = row.contribution === null ? group.amount : Number(row.contribution);
  const recipientPays = row.recipientPays ?? group.recipientPays;
  const checklist: ChecklistRow[] = buildChecklist({
    members: [...memberRows].sort(comparePayoutOrder).map((m) => ({ id: m.id, name: fullName(m) })),
    saved: saved.map((s) => ({ memberId: s.memberId, name: s.memberName })),
    recipientName: row.recipientName,
    recipientPays,
  });
  return {
    row: { ...row, amount: Number(row.amount) },
    group,
    tracked: row.contribution !== null,
    contribution,
    recipientPays,
    checklist,
  };
}

export async function getAddWeekData() {
  const db = getDb();
  const [group, memberRows, rounds] = await Promise.all([
    getGroup(),
    db.select().from(members),
    db.select({ round: history.round }).from(history),
  ]);
  return {
    group,
    // In payout order: week N goes to the N-th name here (wrapping), starting on the cycle start Sunday.
    members: [...memberRows].sort(comparePayoutOrder).map((m) => ({ id: m.id, name: fullName(m) })),
    existingRounds: rounds.map((r) => r.round),
  };
}
