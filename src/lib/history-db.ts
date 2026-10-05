import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { groups, history, historyPayments, members, payments } from "@/db/schema";
import type * as schema from "@/db/schema";
import { weekTotal } from "./week-edit";

// Query builders only: the callers run them as one atomic batch (neon-http) or one by one (tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<any, typeof schema>;
export type Statements = [BatchItem<"pg">, ...BatchItem<"pg">[]];
export type PaidMember = { id: number | null; name: string };

/**
 * Reserves the next history id up front, so a week and its per-member payments can be written in one batch
 * (the payments need the week's id, and a batch cannot read a value produced by an earlier statement).
 */
export async function nextHistoryId(db: Db): Promise<number> {
  const res = (await db.execute(sql`select nextval(pg_get_serial_sequence('history', 'id')) as id`)) as unknown;
  const rows = (Array.isArray(res) ? res : (res as { rows: { id: unknown }[] }).rows) as { id: unknown }[];
  return Number(rows[0].id);
}

const paymentRows = (historyId: number, paid: PaidMember[]) =>
  paid.map((p) => ({ historyId, memberId: p.id, memberName: p.name }));

/** Closing the current week: record it (with who paid), mark the recipient, clear the checklist, move on. */
export function closeWeekStatements(
  db: Db,
  p: {
    historyId: number;
    round: number;
    recipientId: number;
    recipientName: string;
    contribution: number;
    recipientPays: boolean;
    paid: PaidMember[];
    cycleEnds: boolean;
  },
): Statements {
  const out: BatchItem<"pg">[] = [
    db.insert(history).values({
      id: p.historyId,
      round: p.round,
      recipientName: p.recipientName,
      amount: weekTotal(p.paid.length, p.contribution).toFixed(2),
      contribution: p.contribution.toFixed(2),
      recipientPays: p.recipientPays,
    }),
  ];
  if (p.paid.length > 0) out.push(db.insert(historyPayments).values(paymentRows(p.historyId, p.paid)));
  out.push(
    p.cycleEnds
      ? db.update(members).set({ receivedThisCycle: false })
      : db.update(members).set({ receivedThisCycle: true }).where(eq(members.id, p.recipientId)),
    db.delete(payments).where(eq(payments.round, p.round)),
    db.update(groups).set({ currentRound: p.round + 1 }).where(eq(groups.id, 1)),
  );
  return out as Statements;
}

/** Correcting a closed week: replace who paid and recalculate its total. */
export function saveWeekStatements(
  db: Db,
  p: { historyId: number; contribution: number; recipientPays: boolean; paid: PaidMember[] },
): Statements {
  const out: BatchItem<"pg">[] = [db.delete(historyPayments).where(eq(historyPayments.historyId, p.historyId))];
  if (p.paid.length > 0) out.push(db.insert(historyPayments).values(paymentRows(p.historyId, p.paid)));
  out.push(
    db
      .update(history)
      .set({
        amount: weekTotal(p.paid.length, p.contribution).toFixed(2),
        contribution: p.contribution.toFixed(2),
        recipientPays: p.recipientPays,
      })
      .where(eq(history.id, p.historyId)),
  );
  return out as Statements;
}

/** Adding a past week that was never recorded in the app. Does not touch the current cycle. */
export function addWeekStatements(
  db: Db,
  p: {
    historyId: number;
    round: number;
    date: Date;
    recipientName: string;
    contribution: number;
    recipientPays: boolean;
    paid: PaidMember[];
  },
): Statements {
  const out: BatchItem<"pg">[] = [
    db.insert(history).values({
      id: p.historyId,
      round: p.round,
      recipientName: p.recipientName,
      amount: weekTotal(p.paid.length, p.contribution).toFixed(2),
      date: p.date,
      contribution: p.contribution.toFixed(2),
      recipientPays: p.recipientPays,
    }),
  ];
  if (p.paid.length > 0) out.push(db.insert(historyPayments).values(paymentRows(p.historyId, p.paid)));
  return out as Statements;
}

/**
 * Recording a week that is not in the history yet (closing the current week, or adding a missed one). It also
 * clears any ticks still waiting in the live checklist for that week, so none are left behind.
 */
export function recordWeekStatements(db: Db, p: Parameters<typeof addWeekStatements>[1]): Statements {
  return [...addWeekStatements(db, p), db.delete(payments).where(eq(payments.round, p.round))] as Statements;
}

/** Deleting a recorded week. Its per-member payments go with it (the foreign key cascades). */
export function deleteWeekStatements(db: Db, historyId: number): Statements {
  return [db.delete(history).where(eq(history.id, historyId))];
}
