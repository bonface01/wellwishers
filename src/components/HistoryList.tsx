import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { Icon } from "./ui";

export type HistoryListItem = {
  round: number;
  recipientName: string;
  date: Date;
  amount: number;
  /** null when the week was recorded before per-member payments were kept. */
  paidCount: number | null;
};

/** Past weeks, newest first. Each row opens that week so the admin can correct who paid. */
export function HistoryList({ rows, currency }: { rows: HistoryListItem[]; currency: string }) {
  if (rows.length === 0) {
    return <p className="muted">No weeks have been closed yet. Add a missing week to record earlier ones.</p>;
  }
  return (
    <div className="history-list">
      {rows.map((r) => (
        <Link key={r.round} href={`/admin/history/${r.round}`} className="link-row">
          <span className="wk" aria-hidden="true">
            {r.round}
          </span>
          <span className="lr-body">
            <span className="lr-title">{r.recipientName}</span>
            <span className="lr-sub">
              Week {r.round} · {formatDate(r.date)}
            </span>
            {r.paidCount === null ? (
              <span className="lr-note">Tap to record who paid</span>
            ) : (
              <span className="lr-sub">{r.paidCount} paid</span>
            )}
          </span>
          <span className="lr-amt">{formatMoney(r.amount, currency)}</span>
          <Icon name="chevron" size={18} />
        </Link>
      ))}
    </div>
  );
}
