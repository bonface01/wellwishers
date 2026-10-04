import Link from "next/link";
import { NewCycleButton } from "@/components/forms";
import { RoundLive } from "@/components/RoundLive";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";

export default async function RoundPage() {
  const s = await getRoundState();

  if (s.order.length === 0 || !s.recipient) {
    return (
      <div className="card empty">
        <h2>Welcome 👋</h2>
        <p>
          Start by <Link href="/admin/members">adding your members</Link>, then set the contribution
          amount and currency in <Link href="/admin/settings">Settings</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <RoundLive
        groupName={s.group.name}
        round={s.group.currentRound}
        amount={s.group.amount}
        currency={s.group.currency}
        recipientName={fullName(s.recipient)}
        nextName={s.next ? fullName(s.next) : null}
        nextIsNewCycle={s.nextIsNewCycle}
        payers={s.payers.map((m) => ({ id: m.id, name: fullName(m), paid: s.paidIds.has(m.id) }))}
        notice={
          s.group.amount === 0 ? (
            <p className="msg error">
              Contribution amount is 0. Set it in <Link href="/admin/settings">Settings</Link>.
            </p>
          ) : null
        }
      />

      <section className="card">
        <h3>Cycle</h3>
        <p className="muted">Reset who has received, without deleting members or history.</p>
        <NewCycleButton />
      </section>
    </>
  );
}
