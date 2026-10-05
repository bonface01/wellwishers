import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groups, history, members, payments } from "@/db/schema";
import { comparePayoutOrder, fullName } from "./names";
import {
  buildSchedule,
  currentWeekFor,
  nairobiToday,
  orderForCycle,
  weekDate,
  weekInfo,
  type SMember,
} from "./schedule";
import { missingWeeks } from "./week-edit";

export type Member = typeof members.$inferSelect;
type HistoryRow = typeof history.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export async function getGroup() {
  const db = getDb();
  await db.insert(groups).values({ id: 1 }).onConflictDoNothing();
  const [g] = await db.select().from(groups).where(eq(groups.id, 1));
  return { ...g, amount: Number(g.amount) };
}

export type GroupRow = Awaited<ReturnType<typeof getGroup>>;

/**
 * Everything the screens need about the current week.
 *
 * With a cycle start date set ("schedule" mode) the week comes from today's date in Nairobi and the recipient
 * from the locked payout order: nothing is set by hand and nobody's "received" flag matters.
 * Without one ("legacy" mode) it works exactly as it always has, from the manual week number and the flags.
 */
export function computeRoundState(input: {
  group: GroupRow;
  members: Member[];
  payments: PaymentRow[];
  history: HistoryRow[];
  /** Today's date in Nairobi, yyyy-mm-dd. */
  today: string;
}) {
  const { group } = input;
  const order = [...input.members].sort(comparePayoutOrder);
  const historyRows = [...input.history].sort((a, b) => b.round - a.round || b.id - a.id);
  const base = {
    order,
    history: historyRows.map((h) => ({ ...h, amount: Number(h.amount) })),
  };

  if (group.cycleStart) return { ...scheduleState(), ...base };
  return { ...legacyState(), ...base };

  function finish(recipient: Member | null, payers: Member[], week: number) {
    const paidIds = new Set(input.payments.filter((p) => p.round === week).map((p) => p.memberId));
    const paid = payers.filter((m) => paidIds.has(m.id));
    const unpaid = payers.filter((m) => !paidIds.has(m.id));
    return {
      recipient,
      payers,
      paidIds,
      paid,
      unpaid,
      collected: paid.length * group.amount,
      expected: payers.length * group.amount,
    };
  }

  function legacyState() {
    // If everyone has received (normally auto-reset), show a fresh cycle.
    let unreceived = order.filter((m) => !m.receivedThisCycle);
    if (order.length > 0 && unreceived.length === 0) unreceived = order;

    const recipient: Member | null = unreceived[0] ?? null;
    const nextIsNewCycle = unreceived.length <= 1;
    const next: Member | null = nextIsNewCycle ? (order[0] ?? null) : unreceived[1];
    const payers = group.recipientPays ? order : order.filter((m) => m.id !== recipient?.id);

    return {
      mode: "legacy" as const,
      group,
      week: group.currentRound,
      currentDate: null as string | null,
      next,
      nextIsNewCycle,
      schedule: null,
      closed: false,
      unclosedPast: [] as number[],
      cycleOrder: order,
      ...finish(recipient, payers, group.currentRound),
    };
  }

  function scheduleState() {
    const cycleStart = group.cycleStart as string;
    const week = currentWeekFor(input.today, cycleStart);
    const sm: SMember[] = order.map((m) => ({ id: m.id, name: fullName(m), joinedCycle: m.joinedCycle }));
    const byId = new Map(order.map((m) => [m.id, m]));
    const info = weekInfo(week, sm);
    const nextInfo = weekInfo(week + 1, sm);

    const recipient = info ? (byId.get(info.member.id) ?? null) : null;
    const next = nextInfo ? (byId.get(nextInfo.member.id) ?? null) : null;
    const cycleOrder = info ? orderForCycle(sm, info.cycle).map((x) => byId.get(x.id)!) : [];
    const payers = group.recipientPays ? cycleOrder : cycleOrder.filter((m) => m.id !== recipient?.id);

    return {
      mode: "schedule" as const,
      // The week is worked out, so the stored "current week" is replaced by it for everything downstream.
      group: { ...group, currentRound: week },
      week,
      currentDate: weekDate(week, cycleStart) as string | null,
      next,
      nextIsNewCycle: Boolean(info && nextInfo && nextInfo.cycle !== info.cycle),
      schedule: buildSchedule({ cycleStart, members: sm, currentWeek: week }),
      closed: historyRows.some((h) => h.round === week),
      unclosedPast: missingWeeks(week, historyRows.map((h) => h.round)),
      cycleOrder,
      ...finish(recipient, payers, week),
    };
  }
}

export async function getRoundState() {
  const db = getDb();
  const group = await getGroup();
  const [memberRows, paymentRows, historyRows] = await Promise.all([
    db.select().from(members),
    db.select().from(payments),
    db.select().from(history).orderBy(desc(history.round)),
  ]);
  return computeRoundState({
    group,
    members: memberRows,
    payments: paymentRows,
    history: historyRows,
    today: nairobiToday(),
  });
}

export type RoundState = Awaited<ReturnType<typeof getRoundState>>;
