import Link from "next/link";
import { CloseRoundForm, NewCycleButton, PaymentToggle, WhatsAppShare } from "@/components/forms";
import { PotCard } from "@/components/PotCard";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";
import { buildWhatsAppMessage } from "@/lib/whatsapp";

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
      <PotCard s={s} />

      <section className="card">
        <h3>Payments</h3>
        {s.group.amount === 0 && (
          <p className="msg error">
            Contribution amount is 0. Set it in <Link href="/admin/settings">Settings</Link>.
          </p>
        )}
        {s.payers.length === 0 ? (
          <p className="muted">Nobody needs to pay this round.</p>
        ) : (
          <div className="toggles">
            {s.payers.map((m) => (
              <PaymentToggle key={m.id} memberId={m.id} name={fullName(m)} paid={s.paidIds.has(m.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Close this round</h3>
        <CloseRoundForm
          round={s.group.currentRound}
          recipient={fullName(s.recipient)}
          unpaid={s.unpaid.map(fullName)}
        />
      </section>

      <section className="card">
        <h3>WhatsApp update</h3>
        <WhatsAppShare message={buildWhatsAppMessage(s)} />
      </section>

      <section className="card">
        <h3>Cycle</h3>
        <p className="muted">Reset who has received, without deleting members or history.</p>
        <NewCycleButton />
      </section>
    </>
  );
}
