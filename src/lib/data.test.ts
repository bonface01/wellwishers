import { describe, expect, it } from "vitest";
import { computeRoundState, type GroupRow, type Member } from "./data";
import { fullName } from "./names";

const member = (id: number, first: string, second: string, over: Partial<Member> = {}): Member => ({
  id,
  firstName: first,
  secondName: second,
  receivedThisCycle: false,
  joinedCycle: 1,
  ...over,
});

const MEMBERS = [
  member(1, "Agnes", "Wanjira"),
  member(2, "Bonface", "Mutie"),
  member(3, "Brian", "Kithua"),
  member(4, "Brian", "Mutisya"),
  member(5, "Daniel", "Muuo"),
];

const group = (over: Partial<GroupRow> = {}): GroupRow => ({
  id: 1,
  name: "Test Group",
  amount: 100,
  currency: "KSh",
  recipientPays: false,
  currentRound: 4,
  cycleStart: null,
  ...over,
});

const hist = (round: number, id = round) => ({
  id, round, recipientName: "X Y", amount: "100.00", date: new Date("2026-09-13T15:00:00Z"),
  contribution: "100.00", recipientPays: false,
});

const START = "2026-09-06"; // Sunday of week 1
const names = (ms: Member[]) => ms.map(fullName);

describe("legacy mode (no cycle start date): behaves exactly as before", () => {
  const legacy = (members: Member[], g = group()) =>
    computeRoundState({ group: g, members, payments: [], history: [], today: "2026-10-01" });

  it("takes the week from the stored number and the recipient from who has not received", () => {
    const s = legacy([{ ...MEMBERS[0], receivedThisCycle: true }, ...MEMBERS.slice(1)]);
    expect(s.mode).toBe("legacy");
    expect(s.week).toBe(4);
    expect(s.group.currentRound).toBe(4);
    expect(fullName(s.recipient!)).toBe("Bonface Mutie");
    expect(fullName(s.next!)).toBe("Brian Kithua");
    expect(s.schedule).toBeNull();
    expect(s.closed).toBe(false);
    expect(s.unclosedPast).toEqual([]);
  });

  it("leaves the recipient out of the payers when recipients do not contribute", () => {
    const s = legacy(MEMBERS);
    expect(names(s.payers)).not.toContain("Agnes Wanjira");
    expect(s.expected).toBe(400);
  });

  it("ignores the date entirely", () => {
    const a = computeRoundState({ group: group(), members: MEMBERS, payments: [], history: [], today: "2026-09-01" });
    const b = computeRoundState({ group: group(), members: MEMBERS, payments: [], history: [], today: "2027-03-01" });
    expect(a.week).toBe(b.week);
    expect(fullName(a.recipient!)).toBe(fullName(b.recipient!));
  });
});

describe("schedule mode (cycle start date set)", () => {
  const sched = (today: string, over: { members?: Member[]; payments?: { round: number; memberId: number }[]; history?: ReturnType<typeof hist>[]; g?: Partial<GroupRow> } = {}) =>
    computeRoundState({
      group: group({ cycleStart: START, ...over.g }),
      members: over.members ?? MEMBERS,
      payments: over.payments ?? [],
      history: over.history ?? [],
      today,
    });

  it("works out the week from today's date, not from the stored number", () => {
    expect(sched("2026-09-06").week).toBe(1);
    expect(sched("2026-09-13").week).toBe(2);
    expect(sched("2026-09-14").week).toBe(3);
    expect(sched("2026-10-04").week).toBe(5);
    const s = sched("2026-10-04"); // stored currentRound is 4, but the date says week 5
    expect(s.group.currentRound).toBe(5);
    expect(s.week).toBe(5);
  });

  it("makes the Nth member in the order the recipient of week N", () => {
    expect(fullName(sched("2026-09-06").recipient!)).toBe("Agnes Wanjira"); // week 1
    expect(fullName(sched("2026-09-13").recipient!)).toBe("Bonface Mutie"); // week 2
    expect(fullName(sched("2026-09-20").recipient!)).toBe("Brian Kithua"); // week 3
    expect(fullName(sched("2026-09-27").recipient!)).toBe("Brian Mutisya"); // week 4
    expect(fullName(sched("2026-10-04").recipient!)).toBe("Daniel Muuo"); // week 5
  });

  it("ignores the received flags: they no longer decide anything", () => {
    const flagged = MEMBERS.map((m) => ({ ...m, receivedThisCycle: true }));
    expect(fullName(sched("2026-09-13", { members: flagged }).recipient!)).toBe("Bonface Mutie");
  });

  it("names the next week's recipient, and flags when it starts a new cycle", () => {
    const mid = sched("2026-09-13");
    expect(fullName(mid.next!)).toBe("Brian Kithua");
    expect(mid.nextIsNewCycle).toBe(false);
    const last = sched("2026-10-04"); // week 5 = last of a five-member cycle
    expect(fullName(last.next!)).toBe("Agnes Wanjira"); // week 6 = back to the top
    expect(last.nextIsNewCycle).toBe(true);
  });

  it("starts the next cycle the Sunday after the last member's week", () => {
    const lastWeek = sched("2026-10-04");
    expect(lastWeek.schedule!.cycle).toBe(1);
    expect(lastWeek.schedule!.nextCycleStartDate).toBe("2026-10-11");
    const nextCycle = sched("2026-10-05"); // Monday: week 6, cycle 2
    expect(nextCycle.week).toBe(6);
    expect(nextCycle.schedule!.cycle).toBe(2);
    expect(fullName(nextCycle.recipient!)).toBe("Agnes Wanjira");
  });

  it("marks received, this week and upcoming from the date", () => {
    const s = sched("2026-09-20"); // week 3
    expect(s.schedule!.entries.map((e) => [e.week, e.member.name, e.status])).toEqual([
      [1, "Agnes Wanjira", "received"],
      [2, "Bonface Mutie", "received"],
      [3, "Brian Kithua", "current"],
      [4, "Brian Mutisya", "upcoming"],
      [5, "Daniel Muuo", "upcoming"],
    ]);
  });

  it("locks the order: a member added mid-cycle shifts nobody and joins the next cycle", () => {
    const withJoiner = [...MEMBERS, member(6, "Cecilia", "Newcomer", { joinedCycle: 2 })]; // alphabetically between Brian and Daniel
    const s = computeRoundState({
      group: group({ cycleStart: START }),
      members: [...withJoiner],
      payments: [],
      history: [],
      today: "2026-09-20",
    });
    // Cycle 1 is unchanged and Cecilia is not in it.
    expect(s.schedule!.entries.map((e) => e.member.name)).toEqual([
      "Agnes Wanjira", "Bonface Mutie", "Brian Kithua", "Brian Mutisya", "Daniel Muuo",
    ]);
    expect(names(s.cycleOrder)).not.toContain("Cecilia Newcomer");
    expect(s.schedule!.joiningNext.map((m) => m.name)).toEqual(["Cecilia Newcomer"]);
    // From the next cycle she is in her place in the order.
    const later = computeRoundState({ group: group({ cycleStart: START }), members: withJoiner, payments: [], history: [], today: "2026-10-12" });
    expect(later.schedule!.cycle).toBe(2);
    expect(later.schedule!.entries.map((e) => e.member.name)).toEqual([
      "Agnes Wanjira", "Bonface Mutie", "Brian Kithua", "Brian Mutisya", "Cecilia Newcomer", "Daniel Muuo",
    ]);
  });

  it("counts payments for the current week only, and only from this cycle's members", () => {
    const s = sched("2026-09-13", {
      payments: [
        { round: 2, memberId: 1 },
        { round: 2, memberId: 3 },
        { round: 1, memberId: 4 }, // another week
      ],
    });
    expect(names(s.paid)).toEqual(["Agnes Wanjira", "Brian Kithua"]);
    expect(s.collected).toBe(200);
    expect(s.expected).toBe(400); // five members, the recipient (Bonface) does not pay
    expect(names(s.payers)).not.toContain("Bonface Mutie");
  });

  it("includes the recipient among the payers when recipients contribute", () => {
    const s = sched("2026-09-13", { g: { recipientPays: true } });
    expect(s.payers).toHaveLength(5);
    expect(s.expected).toBe(500);
  });

  it("knows when the current week has already been closed", () => {
    expect(sched("2026-09-13", { history: [hist(2)] }).closed).toBe(true);
    expect(sched("2026-09-13", { history: [hist(1)] }).closed).toBe(false);
  });

  it("lists earlier weeks that were never recorded", () => {
    expect(sched("2026-09-27", { history: [hist(2)] }).unclosedPast).toEqual([1, 3]); // week 4 is current
    expect(sched("2026-09-06").unclosedPast).toEqual([]); // week 1: nothing earlier
  });

  it("has no recipient when there are no members", () => {
    const s = sched("2026-09-13", { members: [] });
    expect(s.recipient).toBeNull();
    expect(s.schedule).toBeNull();
    expect(s.payers).toEqual([]);
  });

  it("returns the recorded weeks newest first, whichever way the data arrives", () => {
    const s = sched("2026-09-27", { history: [hist(1), hist(3), hist(2)] });
    expect(s.history.map((h) => h.round)).toEqual([3, 2, 1]);
  });
});
