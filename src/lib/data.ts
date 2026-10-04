import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groups, history, members, payments } from "@/db/schema";
import { comparePayoutOrder } from "./names";

export type Member = typeof members.$inferSelect;

export async function getGroup() {
  const db = getDb();
  await db.insert(groups).values({ id: 1 }).onConflictDoNothing();
  const [g] = await db.select().from(groups).where(eq(groups.id, 1));
  return { ...g, amount: Number(g.amount) };
}

export async function getRoundState() {
  const db = getDb();
  const group = await getGroup();
  const [memberRows, paymentRows, historyRows] = await Promise.all([
    db.select().from(members),
    db.select().from(payments).where(eq(payments.round, group.currentRound)),
    db.select().from(history).orderBy(desc(history.round)),
  ]);

  const order = [...memberRows].sort(comparePayoutOrder);

  // If everyone has received (normally auto-reset), show a fresh cycle.
  let unreceived = order.filter((m) => !m.receivedThisCycle);
  if (order.length > 0 && unreceived.length === 0) unreceived = order;

  const recipient: Member | null = unreceived[0] ?? null;
  const nextIsNewCycle = unreceived.length <= 1;
  const next: Member | null = nextIsNewCycle ? (order[0] ?? null) : unreceived[1];

  const payers = group.recipientPays ? order : order.filter((m) => m.id !== recipient?.id);
  const paidIds = new Set(paymentRows.map((p) => p.memberId));
  const paid = payers.filter((m) => paidIds.has(m.id));
  const unpaid = payers.filter((m) => !paidIds.has(m.id));

  return {
    group,
    order,
    recipient,
    next,
    nextIsNewCycle,
    payers,
    paidIds,
    paid,
    unpaid,
    collected: paid.length * group.amount,
    expected: payers.length * group.amount,
    history: historyRows.map((h) => ({ ...h, amount: Number(h.amount) })),
  };
}

export type RoundState = Awaited<ReturnType<typeof getRoundState>>;
