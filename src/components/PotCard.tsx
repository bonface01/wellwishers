import { formatMoney } from "@/lib/format";
import { fullName } from "@/lib/names";
import type { RoundState } from "@/lib/data";

export function PotCard({ s }: { s: RoundState }) {
  const { group } = s;
  const pct = s.expected > 0 ? Math.min(100, Math.round((s.collected / s.expected) * 100)) : 0;

  return (
    <section className="pot">
      <p className="pot-round">Round {group.currentRound}</p>
      <p className="pot-label">This round&apos;s pot goes to</p>
      <h2 className="pot-name">{s.recipient ? fullName(s.recipient) : "—"}</h2>

      <div className="pot-progress">
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="pot-collected">
          <strong>{formatMoney(s.collected, group.currency)}</strong> of{" "}
          {formatMoney(s.expected, group.currency)} collected
        </p>
      </div>

      {s.next && (
        <p className="pot-next">
          Next round: <strong>{fullName(s.next)}</strong>
          {s.nextIsNewCycle && " (new cycle)"}
        </p>
      )}
    </section>
  );
}
