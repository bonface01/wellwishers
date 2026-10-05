import Link from "next/link";
import { notFound } from "next/navigation";
import { WeekEditor } from "@/components/WeekEditor";
import { Icon } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getWeek } from "@/lib/history-data";

export default async function EditWeekPage({ params }: { params: Promise<{ round: string }> }) {
  const { round: raw } = await params;
  if (!/^\d+$/.test(raw)) notFound();
  const round = Number(raw);
  const week = await getWeek(round);
  if (!week) notFound();

  return (
    <>
      <Link href="/admin/history" className="back">
        <Icon name="chevron" size={18} />
        History
      </Link>
      <WeekEditor
        mode="edit"
        week={round}
        recipientName={week.row.recipientName}
        dateLabel={formatDate(week.row.date)}
        rows={week.checklist}
        savedTotal={week.row.amount}
        tracked={week.tracked}
        amount={week.contribution}
        currency={week.group.currency}
        recipientPays={week.recipientPays}
      />
    </>
  );
}
