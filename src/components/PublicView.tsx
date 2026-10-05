import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { CycleSchedule } from "@/lib/schedule";
import type { TimelineEntry } from "@/lib/timeline";
import { Hero, RoundHeader } from "./Hero";
import { ScheduleCard } from "./ScheduleList";
import { Avatar, Icon } from "./ui";

export type PublicViewProps = {
  groupName: string;
  round: number;
  amount: number;
  currency: string;
  recipientName: string | null;
  nextName: string | null;
  nextIsNewCycle: boolean;
  collected: number;
  expected: number;
  payers: { id: number; name: string; paid: boolean }[];
  /** The old "who is next" list, used until a cycle start date is set. */
  timeline: TimelineEntry[];
  /** The full dated schedule for the current cycle, once a cycle start date is set. */
  schedule?: CycleSchedule | null;
  history: { id: number; round: number; recipientName: string; amount: number; date: Date }[];
};

/** The read-only member page. Pure presentation so it can be rendered with real or sample data. */
export function PublicView(p: PublicViewProps) {
  const paidCount = p.payers.filter((m) => m.paid).length;

  return (
    <main className="page cascade">
      {p.timeline.length === 0 ? (
        <>
          <header className="page-head">
            <p className="eyebrow">{p.groupName}</p>
            <h1>Contribution Circle</h1>
          </header>
          <p className="card empty">No members have been added yet. Check back soon.</p>
        </>
      ) : (
        <>
          <RoundHeader groupName={p.groupName} round={p.round} />

          <Hero
            recipientName={p.recipientName}
            collected={p.collected}
            expected={p.expected}
            currency={p.currency}
            paidCount={paidCount}
            totalCount={p.payers.length}
            nextName={p.nextName}
            nextIsNewCycle={p.nextIsNewCycle}
          />

          <section className="card">
            <div className="card-head">
              <h3>This week&apos;s payments</h3>
              <span className="count">
                {paidCount} of {p.payers.length} paid
              </span>
            </div>
            <div className="toggles">
              {p.payers.map((m, index) => (
                <div key={m.id} className={`toggle static ${m.paid ? "paid" : ""}`}>
                  <Avatar name={m.name} tone={index} />
                  <span className="toggle-body">
                    <span className="toggle-name">{m.name}</span>
                    <span className="toggle-state">
                      {m.paid ? `Paid ${formatMoney(p.amount, p.currency)}` : "Not paid yet"}
                    </span>
                  </span>
                  <span className="tick" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </div>
              ))}
            </div>
          </section>

          {p.schedule ? (
            <ScheduleCard schedule={p.schedule} />
          ) : (
            <section className="card">
              <div className="card-head">
                <h3>Payout order</h3>
                <span className="count">{formatMoney(p.amount, p.currency)} each</span>
              </div>
              <ol className="timeline">
                {p.timeline.map((e) => (
                  <li key={e.id} className={e.status}>
                    <span className="node" aria-hidden="true">
                      {e.status === "received" && <Icon name="check" size={14} />}
                    </span>
                    <span className="tl-name">{e.name}</span>
                    {e.status === "received" && <span className="tl-when">Received</span>}
                    {e.status === "current" && <span className="tag amber">This week</span>}
                    {e.status === "upcoming" && <span className="tl-when">{e.when}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h3>Past weeks</h3>
            </div>
            {p.history.length === 0 ? (
              <p className="muted">No weeks completed yet.</p>
            ) : (
              <ul className="list">
                {p.history.map((h) => (
                  <li key={h.id}>
                    <span className="li-name">
                      <strong>Week {h.round}</strong> · {h.recipientName}
                      <small className="muted block">{formatDate(h.date)}</small>
                    </span>
                    <span className="amt">{formatMoney(h.amount, p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <footer className="foot">
        <Link href="/admin">Admin</Link>
      </footer>
    </main>
  );
}
