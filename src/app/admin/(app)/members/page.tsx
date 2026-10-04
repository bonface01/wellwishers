import { AddMemberForm, ReceivedToggle, RemoveMemberButton } from "@/components/forms";
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
          <>
            <p className="muted hint">
              Already part-way through a cycle? Mark who has received. The next recipient is the first
              person in the order who has not.
            </p>
            <ol className="list numbered">
              {s.order.map((m) => (
                <li key={m.id}>
                  <span>
                    {fullName(m)}
                    {m.id === s.recipient?.id && <span className="tag good">This round</span>}
                  </span>
                  <div className="actions">
                    <ReceivedToggle memberId={m.id} name={fullName(m)} received={m.receivedThisCycle} />
                    <RemoveMemberButton id={m.id} name={fullName(m)} />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </>
  );
}
