import { formatMoney } from "@/lib/format";
import { fullName } from "@/lib/names";
import type { RoundState } from "@/lib/data";

type PotCardViewProps = {
  round: number;
  recipientName: string | null;
  nextName: string | null;
  nextIsNewCycle: boolean;
  collected: number;
  expected: number;
  currency: string;
};

// Presentational, so it can be rendered from server pages and from the live (client) round view.
export function PotCardView(p: PotCardViewProps) {
  const pct = p.expected > 0 ? Math.min(100, Math.round((p.collected / p.expected) * 100)) : 0;

  return (
    <section className="pot">
      <p className="pot-round">Round {p.round}</p>
      <p className="pot-label">This round&apos;s pot goes to</p>
      <h2 className="pot-name">{p.recipientName ?? "—"}</h2>

      <div className="pot-progress">
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="pot-collected">
          <strong>{formatMoney(p.collected, p.currency)}</strong> of {formatMoney(p.expected, p.currency)}{" "}
          collected
        </p>
      </div>

      {p.nextName && (
        <p className="pot-next">
          Next round: <strong>{p.nextName}</strong>
          {p.nextIsNewCycle && " (new cycle)"}
        </p>
      )}
    </section>
  );
}

export function PotCard({ s }: { s: RoundState }) {
  return (
    <PotCardView
      round={s.group.currentRound}
      recipientName={s.recipient ? fullName(s.recipient) : null}
      nextName={s.next ? fullName(s.next) : null}
      nextIsNewCycle={s.nextIsNewCycle}
      collected={s.collected}
      expected={s.expected}
      currency={s.group.currency}
    />
  );
}
