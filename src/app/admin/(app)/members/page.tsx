import { AddMemberForm, RemoveMemberButton } from "@/components/forms";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";

export default async function MembersPage() {
  const s = await getRoundState();
  return (
    <>
      <section className="card">
        <h3>Add member</h3>
        <AddMemberForm />
      </section>

      <section className="card">
        <h3>Payout order ({s.order.length})</h3>
        {s.order.length === 0 ? (
          <p className="empty">No members yet. Add your first member above.</p>
        ) : (
          <ol className="list numbered">
            {s.order.map((m) => (
              <li key={m.id}>
                <span>
                  {fullName(m)}
                  {m.id === s.recipient?.id ? (
                    <span className="tag good">This round</span>
                  ) : m.receivedThisCycle ? (
                    <span className="tag">Received</span>
                  ) : null}
                </span>
                <RemoveMemberButton id={m.id} name={fullName(m)} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
