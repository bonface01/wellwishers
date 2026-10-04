import { PublicView } from "@/components/PublicView";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";
import { buildTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  const s = await getRoundState();
  return (
    <PublicView
      groupName={s.group.name}
      round={s.group.currentRound}
      amount={s.group.amount}
      currency={s.group.currency}
      recipientName={s.recipient ? fullName(s.recipient) : null}
      nextName={s.next ? fullName(s.next) : null}
      nextIsNewCycle={s.nextIsNewCycle}
      collected={s.collected}
      expected={s.expected}
      payers={s.payers.map((m) => ({ id: m.id, name: fullName(m), paid: s.paidIds.has(m.id) }))}
      timeline={buildTimeline(
        s.order.map((m) => ({ id: m.id, name: fullName(m), received: m.receivedThisCycle })),
        s.recipient?.id ?? null,
      )}
      history={s.history.map((h) => ({
        id: h.id,
        round: h.round,
        recipientName: h.recipientName,
        amount: h.amount,
        date: h.date,
      }))}
    />
  );
}
