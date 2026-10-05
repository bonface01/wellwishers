import Link from "next/link";
import { WeekEditor } from "@/components/WeekEditor";
import { Icon } from "@/components/ui";
import { getAddWeekData } from "@/lib/history-data";

export default async function AddWeekPage() {
  const data = await getAddWeekData();
  return (
    <>
      <Link href="/admin/history" className="back">
        <Icon name="chevron" size={18} />
        History
      </Link>
      <header className="page-head">
        <h1>Add a past week</h1>
      </header>
      {data.group.currentRound <= 1 ? (
        <p className="card empty">There are no earlier weeks to add yet. The current week is week 1.</p>
      ) : (
        <WeekEditor
          mode="add"
          members={data.members}
          currentRound={data.group.currentRound}
          existingRounds={data.existingRounds}
          amount={data.group.amount}
          currency={data.group.currency}
          recipientPays={data.group.recipientPays}
        />
      )}
    </>
  );
}
