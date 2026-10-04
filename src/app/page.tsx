import Link from "next/link";
import { PotCard } from "@/components/PotCard";
import { getRoundState } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/format";
import { fullName } from "@/lib/names";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  const s = await getRoundState();
  const { group } = s;

  return (
    <main className="page">
      <header className="top">
        <h1>{group.name}</h1>
        <p className="muted">
          {formatMoney(group.amount, group.currency)} each per round
        </p>
      </header>

      {s.order.length === 0 ? (
        <p className="empty">No members have been added yet. Check back soon.</p>
      ) : (
        <>
          <PotCard s={s} />

          <section className="card">
            <h3>This round&apos;s payments</h3>
            <ul className="list">
              {s.payers.map((m) => (
                <li key={m.id}>
                  <span>{fullName(m)}</span>
                  <span className={s.paidIds.has(m.id) ? "tag good" : "tag"}>
                    {s.paidIds.has(m.id) ? "Paid" : "Not yet"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Payout order</h3>
            <ol className="list numbered">
              {s.order.map((m) => (
                <li key={m.id}>
                  <span>{fullName(m)}</span>
                  {m.id === s.recipient?.id ? (
                    <span className="tag good">This round</span>
                  ) : m.receivedThisCycle ? (
                    <span className="tag">Received</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h3>Past rounds</h3>
            {s.history.length === 0 ? (
              <p className="muted">No rounds completed yet.</p>
            ) : (
              <ul className="list">
                {s.history.map((h) => (
                  <li key={h.id}>
                    <span>
                      <strong>Round {h.round}</strong> · {h.recipientName}
                      <br />
                      <small className="muted">{formatDate(h.date)}</small>
                    </span>
                    <span>{formatMoney(h.amount, group.currency)}</span>
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
