import { AddMemberForm, ReceivedToggle, RemoveMemberButton } from "@/components/forms";
import { Avatar } from "@/components/ui";
import { getRoundState } from "@/lib/data";
import { fullName } from "@/lib/names";

export default async function MembersPage() {
  const s = await getRoundState();
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{s.group.name}</p>
        <h1>Members</h1>
      </header>

      <section className="card">
        <h3>Add member</h3>
        <AddMemberForm />
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Payout order</h3>
          <span className="count">{s.order.length} members</span>
        </div>
        {s.order.length === 0 ? (
          <p className="empty">No members yet. Add your first member above.</p>
        ) : (
          <>
            <p className="muted hint">
              Already part-way through a cycle? Mark who has received. The next recipient is the first
              person in the order who has not.
            </p>
            <ol className="list numbered">
              {s.order.map((m, index) => (
                <li key={m.id}>
                  <Avatar name={fullName(m)} tone={index} />
                  <span className="li-name">
                    {fullName(m)}
                    {m.id === s.recipient?.id && <span className="tag amber">This week</span>}
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
