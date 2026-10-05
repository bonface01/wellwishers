import Link from "next/link";
import { HistoryList } from "@/components/HistoryList";
import { Icon } from "@/components/ui";
import { getGroup } from "@/lib/data";
import { getHistoryList } from "@/lib/history-data";

const weekFrom = (value: string | undefined, prefix = "") => {
  const v = value && prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value;
  return v && /^\d+$/.test(v) ? Number(v) : null;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const { saved, deleted, error } = await searchParams;
  const savedWeek = weekFrom(saved);
  const deletedWeek = weekFrom(deleted);
  const failedWeek = weekFrom(error, "delete-");
  const [rows, group] = await Promise.all([getHistoryList(), getGroup()]);

  return (
    <>
      <header className="page-head page-top">
        <div>
          <p className="eyebrow">{group.name}</p>
          <h1>History</h1>
        </div>
        <Link href="/admin/history/new" className="btn green small">
          <Icon name="plus" size={18} />
          Add week
        </Link>
      </header>

      {savedWeek !== null && (
        <div className="banner saved" role="status">
          <span className="banner-icon">
            <Icon name="check" size={18} />
          </span>
          <span>Week {savedWeek} saved.</span>
        </div>
      )}
      {deletedWeek !== null && (
        <div className="banner saved" role="status">
          <span className="banner-icon">
            <Icon name="check" size={18} />
          </span>
          <span>Week {deletedWeek} deleted. You can add it again with Add week.</span>
        </div>
      )}
      {failedWeek !== null && (
        <p className="card msg error" role="alert">
          Week {failedWeek} could not be deleted, so nothing was changed. Please try again.
        </p>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Past weeks</h3>
          <span className="count">{rows.length} {rows.length === 1 ? "week" : "weeks"}</span>
        </div>
        {rows.length > 0 && <p className="note" style={{ marginBottom: 12 }}>Tap a week to correct who paid, or to delete it. Its total is recalculated.</p>}
        <HistoryList
          currency={group.currency}
          rows={rows.map((r) => ({
            round: r.round,
            recipientName: r.recipientName,
            date: r.date,
            amount: r.amount,
            paidCount: r.paidCount,
          }))}
        />
      </section>
    </>
  );
}
