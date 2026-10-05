import { SettingsForm } from "@/components/forms";
import { getGroup } from "@/lib/data";

export default async function SettingsPage() {
  const g = await getGroup();
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
        />
      </section>
    </>
  );
}
