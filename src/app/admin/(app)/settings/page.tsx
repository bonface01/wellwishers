import { SettingsForm } from "@/components/forms";
import { getRoundState } from "@/lib/data";

export default async function SettingsPage() {
  const s = await getRoundState();
  const g = s.group;
  const scheduled = s.mode === "schedule";
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{g.name}</p>
        <h1>Settings</h1>
      </header>
      <section className="card">
        <SettingsForm
          name={g.name}
          amount={g.amount}
          currency={g.currency}
          recipientPays={g.recipientPays}
          currentRound={g.currentRound}
          cycleStart={g.cycleStart}
          derivedWeek={scheduled ? s.week : null}
          derivedDate={scheduled ? s.currentDate : null}
        />
      </section>
    </>
  );
}
