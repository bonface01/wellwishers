import { SettingsForm } from "@/components/forms";
import { getGroup } from "@/lib/data";

export default async function SettingsPage() {
  const g = await getGroup();
  return (
    <section className="card">
      <h3>Settings</h3>
      <SettingsForm
        name={g.name}
        amount={g.amount}
        currency={g.currency}
        recipientPays={g.recipientPays}
      />
    </section>
  );
}
