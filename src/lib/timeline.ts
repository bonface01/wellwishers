export type TimelineMember = { id: number; name: string; received: boolean };
export type TimelineStatus = "received" | "current" | "upcoming";
export type TimelineEntry = { id: number; name: string; status: TimelineStatus; when: string | null };

/** "next week", "in 2 weeks", … for a member `weeks` payouts after the current one. */
export function weeksLabel(weeks: number): string {
  return weeks === 1 ? "next week" : `in ${weeks} weeks`;
}

/**
 * Payout order as a timeline. `order` is already in payout order; `currentId` is this week's recipient.
 * Everyone not yet received comes after the recipient, labelled by how many weeks away they are.
 */
export function buildTimeline(order: TimelineMember[], currentId: number | null): TimelineEntry[] {
  let weeksAhead = 0;
  return order.map((m) => {
    if (m.id === currentId) return { id: m.id, name: m.name, status: "current", when: "this week" };
    if (m.received) return { id: m.id, name: m.name, status: "received", when: null };
    weeksAhead += 1;
    return { id: m.id, name: m.name, status: "upcoming", when: weeksLabel(weeksAhead) };
  });
}

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
};

export { initialsOf };
