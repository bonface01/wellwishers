import { AddMemberForm, ReceivedToggle, RemoveMemberButton } from "@/components/forms";
import { Avatar } from "@/components/ui";
import { getRoundState } from "@/lib/data";
import { formatSunday } from "@/lib/format";
import { fullName } from "@/lib/names";

export default async function MembersPage() {
  const s = await getRoundState();
  const scheduled = s.mode === "schedule";
  // With a schedule, each member's place in the current cycle comes from the order and the dates.
  const slot = new Map((s.schedule?.entries ?? []).map((e) => [e.member.id, e]));

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{s.group.name}</p>
        <h1>Members</h1>
      </header>

      <section className="card">
        <h3>Add member</h3>
        <AddMemberForm />
        {scheduled && (
          <p className="note" style={{ marginTop: 10 }}>
            The order is locked for the current cycle. Someone added now joins from the next cycle, so nobody
            already in the order moves.
          </p>
        )}
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
            {!scheduled && (
              <p className="muted hint">
                Already part-way through a cycle? Mark who has received. The next recipient is the first
                person in the order who has not.
              </p>
            )}
            <ol className="list numbered">
              {s.order.map((m, index) => {
                const entry = slot.get(m.id);
                return (
                  <li key={m.id}>
                    <Avatar name={fullName(m)} tone={index} />
                    <span className="li-name">
                      {fullName(m)}
                      {!scheduled && m.id === s.recipient?.id && <span className="tag amber">This week</span>}
                      {scheduled && entry?.status === "current" && <span className="tag amber">This week</span>}
                      {scheduled && entry && entry.status !== "current" && (
                        <span className="tag">
                          Week {entry.week} · {formatSunday(entry.date)}
                        </span>
                      )}
                      {scheduled && !entry && <span className="tag">Joins next cycle</span>}
                    </span>
                    <div className="actions">
                      {!scheduled && <ReceivedToggle memberId={m.id} name={fullName(m)} received={m.receivedThisCycle} />}
                      <RemoveMemberButton id={m.id} name={fullName(m)} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </>
  );
}
