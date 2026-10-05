import Link from "next/link";
import { NewCycleButton } from "@/components/forms";
import { RoundLive } from "@/components/RoundLive";
import { ScheduleCard } from "@/components/ScheduleList";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";

export default async function RoundPage() {
  const s = await getRoundState();
  const scheduled = s.mode === "schedule";

  if (s.order.length === 0 || !s.recipient) {
    return (
      <div className="card empty">
        <h2>Welcome 👋</h2>
        <p>
          Start by <Link href="/admin/members">adding your members</Link>, then set the contribution
          amount, currency and cycle start date in <Link href="/admin/settings">Settings</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      {!scheduled && (
        <section className="card prompt">
          <h3>Set the cycle start date</h3>
          <p className="note">
            The weekly schedule is not switched on yet. Set the cycle start date (the Sunday of week 1) in Settings,
            and the current week, each week&apos;s recipient and the full schedule will follow the date and the payout
            order automatically.
          </p>
          <Link href="/admin/settings" className="btn green small">
            Open Settings
          </Link>
        </section>
      )}

      <RoundLive
        groupName={s.group.name}
        round={s.group.currentRound}
        amount={s.group.amount}
        currency={s.group.currency}
        recipientName={fullName(s.recipient)}
        nextName={s.next ? fullName(s.next) : null}
        nextIsNewCycle={s.nextIsNewCycle}
        payers={s.payers.map((m) => ({ id: m.id, name: fullName(m), paid: s.paidIds.has(m.id) }))}
        closed={scheduled && s.closed}
        notice={
          s.group.amount === 0 ? (
            <p className="msg error">
              Contribution amount is 0. Set it in <Link href="/admin/settings">Settings</Link>.
            </p>
          ) : null
        }
      />

      {scheduled && s.unclosedPast.length > 0 && (
        <section className="card">
          <h3>Earlier weeks not recorded</h3>
          <p className="note" style={{ marginBottom: 12 }}>
            {s.unclosedPast.length === 1 ? "Week" : "Weeks"} {s.unclosedPast.join(", ")}{" "}
            {s.unclosedPast.length === 1 ? "is" : "are"} not in the history yet. Add{" "}
            {s.unclosedPast.length === 1 ? "it" : "them"} so the records are complete.
          </p>
          <Link href="/admin/history/new" className="btn small">
            Add a missing week
          </Link>
        </section>
      )}

      {scheduled && s.schedule && <ScheduleCard schedule={s.schedule} />}

      {!scheduled && (
        <section className="card">
          <h3>Cycle</h3>
          <p className="muted">Reset who has received, without deleting members or history.</p>
          <NewCycleButton />
        </section>
      )}
    </>
  );
}
