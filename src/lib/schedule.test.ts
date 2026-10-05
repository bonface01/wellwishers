import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  currentWeekFor,
  daysBetween,
  joinedCycleForNewMember,
  nairobiToday,
  orderForCycle,
  scheduleForWeek,
  weekDate,
  weekInfo,
  type SMember,
} from "./schedule";
import { isSunday } from "./week-edit";

const m = (id: number, name: string, joinedCycle = 1): SMember => ({ id, name, joinedCycle });
const THREE = [m(1, "Agnes Wanjira"), m(2, "Bonface Mutie"), m(3, "Brian Kithua")];
const START = "2026-09-06"; // a Sunday

describe("weekInfo: the Nth member in the order receives week N", () => {
  it("follows the payout order, week by week", () => {
    expect(weekInfo(1, THREE)?.member.name).toBe("Agnes Wanjira");
    expect(weekInfo(2, THREE)?.member.name).toBe("Bonface Mutie");
    expect(weekInfo(3, THREE)?.member.name).toBe("Brian Kithua");
  });

  it("starts the next cycle straight after the last member's week, back at the top", () => {
    expect(weekInfo(4, THREE)).toMatchObject({ cycle: 2, index: 0, startWeek: 4, endWeek: 6 });
    expect(weekInfo(4, THREE)?.member.name).toBe("Agnes Wanjira");
    expect(weekInfo(6, THREE)?.member.name).toBe("Brian Kithua");
    expect(weekInfo(7, THREE)).toMatchObject({ cycle: 3, startWeek: 7 });
  });

  it("matches the real group's first weeks (week 4 is Brian Mutisya)", () => {
    const real = [m(1, "Agnes Wanjira"), m(2, "Bonface Mutie"), m(3, "Brian Kithua"), m(4, "Brian Mutisya"), m(5, "Daniel Muuo")];
    expect([1, 2, 3, 4, 5].map((w) => weekInfo(w, real)?.member.name)).toEqual([
      "Agnes Wanjira", "Bonface Mutie", "Brian Kithua", "Brian Mutisya", "Daniel Muuo",
    ]);
  });

  it("gives nothing for impossible weeks or an empty group", () => {
    expect(weekInfo(0, THREE)).toBeNull();
    expect(weekInfo(-2, THREE)).toBeNull();
    expect(weekInfo(1.5, THREE)).toBeNull();
    expect(weekInfo(Number.NaN, THREE)).toBeNull();
    expect(weekInfo(1, [])).toBeNull();
  });
});

describe("locked order: someone added mid-cycle joins from the next cycle", () => {
  // Alphabetical order is Agnes, Bonface, Brian. Bonface joined during cycle 1, so only joins from cycle 2.
  const withJoiner = [m(1, "Agnes Wanjira"), m(2, "Bonface Mutie", 2), m(3, "Brian Kithua")];

  it("leaves cycle 1 exactly as it was, with the joiner skipped", () => {
    expect(orderForCycle(withJoiner, 1).map((x) => x.name)).toEqual(["Agnes Wanjira", "Brian Kithua"]);
    expect(weekInfo(1, withJoiner)?.member.name).toBe("Agnes Wanjira");
    expect(weekInfo(2, withJoiner)?.member.name).toBe("Brian Kithua");
    expect(weekInfo(2, withJoiner)?.endWeek).toBe(2); // cycle 1 is two weeks long
  });

  it("includes the joiner, in their place in the order, from the next cycle", () => {
    expect([3, 4, 5].map((w) => weekInfo(w, withJoiner)?.member.name)).toEqual([
      "Agnes Wanjira", "Bonface Mutie", "Brian Kithua",
    ]);
    expect(weekInfo(3, withJoiner)).toMatchObject({ cycle: 2, startWeek: 3, endWeek: 5 });
  });

  it("does not move anyone already in the cycle when a member is added", () => {
    const before = [1, 2, 3].map((w) => weekInfo(w, THREE)!.member.id);
    const after = [1, 2, 3].map((w) => weekInfo(w, [...THREE, m(9, "Zed Newcomer", 2)])!.member.id);
    expect(after).toEqual(before);
  });
});

describe("weekDate and daysBetween", () => {
  it("puts every week on a Sunday, a week apart", () => {
    expect(weekDate(1, START)).toBe("2026-09-06");
    expect(weekDate(2, START)).toBe("2026-09-13");
    expect(weekDate(5, START)).toBe("2026-10-04");
    for (let w = 1; w <= 80; w++) expect(isSunday(weekDate(w, START))).toBe(true);
  });

  it("counts whole days across month ends and leap years", () => {
    expect(daysBetween("2026-09-06", "2026-09-13")).toBe(7);
    expect(daysBetween("2026-09-13", "2026-09-06")).toBe(-7);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("currentWeekFor: decided by today's date and the cycle start", () => {
  it("is week 1 from the start Sunday through the Sunday of week 1", () => {
    expect(currentWeekFor("2026-09-06", START)).toBe(1);
  });

  it("is still week N on week N's Sunday, and week N+1 from the Monday", () => {
    expect(currentWeekFor("2026-09-07", START)).toBe(2); // Monday after week 1
    expect(currentWeekFor("2026-09-13", START)).toBe(2); // week 2's own Sunday
    expect(currentWeekFor("2026-09-14", START)).toBe(3);
    expect(currentWeekFor("2026-10-04", START)).toBe(5);
    expect(currentWeekFor("2026-10-05", START)).toBe(6);
  });

  it("is week 1 before the cycle has started", () => {
    expect(currentWeekFor("2026-08-30", START)).toBe(1);
  });

  it("never skips or repeats a week across a long run of days", () => {
    let last = 0;
    for (let d = 0; d <= 70; d++) {
      const day = new Date(Date.UTC(2026, 8, 6 + d)).toISOString().slice(0, 10);
      const w = currentWeekFor(day, START);
      expect(w - last).toBeGreaterThanOrEqual(0);
      expect(w - last).toBeLessThanOrEqual(1);
      last = w;
    }
    expect(last).toBe(11);
  });
});

describe("nairobiToday", () => {
  it("uses Nairobi's date, three hours ahead of UTC", () => {
    expect(nairobiToday(new Date("2026-10-04T20:59:00Z"))).toBe("2026-10-04");
    expect(nairobiToday(new Date("2026-10-04T21:00:00Z"))).toBe("2026-10-05"); // midnight in Nairobi
  });
});

describe("joinedCycleForNewMember", () => {
  it("is cycle 1 when no start date is set or the first cycle has not begun", () => {
    expect(joinedCycleForNewMember("2026-09-10", null, THREE)).toBe(1);
    expect(joinedCycleForNewMember("2026-09-01", START, THREE)).toBe(1);
    expect(joinedCycleForNewMember("2026-09-06", START, THREE)).toBe(1); // start day itself: nothing has happened yet
  });

  it("is the next cycle while a cycle is running, including its very last week", () => {
    expect(joinedCycleForNewMember("2026-09-07", START, THREE)).toBe(2); // week 2 of cycle 1
    expect(joinedCycleForNewMember("2026-09-20", START, THREE)).toBe(2); // week 3 = last week of cycle 1
  });

  it("is two cycles on once the next cycle is the running one", () => {
    expect(joinedCycleForNewMember("2026-09-21", START, THREE)).toBe(3); // week 4, first week of cycle 2
  });

  it("counts a member added earlier in the same cycle the same way", () => {
    const withJoiner = [...THREE, m(9, "Earlier Joiner", 2)];
    expect(joinedCycleForNewMember("2026-09-08", START, withJoiner)).toBe(2); // still cycle 1, so next is 2
  });
});

describe("buildSchedule", () => {
  it("marks each week received, this week or upcoming, with its Sunday", () => {
    const s = buildSchedule({ cycleStart: START, members: THREE, currentWeek: 2 })!;
    expect(s.entries.map((e) => [e.week, e.member.name, e.date, e.status])).toEqual([
      [1, "Agnes Wanjira", "2026-09-06", "received"],
      [2, "Bonface Mutie", "2026-09-13", "current"],
      [3, "Brian Kithua", "2026-09-20", "upcoming"],
    ]);
    expect(s).toMatchObject({ cycle: 1, startWeek: 1, endWeek: 3 });
  });

  it("starts the next cycle on the Sunday after the last member's week", () => {
    const s = buildSchedule({ cycleStart: START, members: THREE, currentWeek: 3 })!;
    expect(s.nextCycleStartWeek).toBe(4);
    expect(s.nextCycleStartDate).toBe("2026-09-27");
    expect(isSunday(s.nextCycleStartDate)).toBe(true);
  });

  it("shows the cycle the current week is in, with new members listed for the next one", () => {
    const members = [...THREE, m(9, "Zed Newcomer", 2)];
    const s = buildSchedule({ cycleStart: START, members, currentWeek: 2 })!;
    expect(s.entries.map((e) => e.member.name)).toEqual(["Agnes Wanjira", "Bonface Mutie", "Brian Kithua"]);
    expect(s.joiningNext.map((x) => x.name)).toEqual(["Zed Newcomer"]);

    const next = buildSchedule({ cycleStart: START, members, currentWeek: 4 })!;
    expect(next.cycle).toBe(2);
    expect(next.entries.map((e) => e.member.name)).toEqual(["Agnes Wanjira", "Bonface Mutie", "Brian Kithua", "Zed Newcomer"]);
    expect(next.joiningNext).toEqual([]);
  });

  it("marks everything received in a past cycle's last week, and nothing is current before the start", () => {
    const last = buildSchedule({ cycleStart: START, members: THREE, currentWeek: 3 })!;
    expect(last.entries.map((e) => e.status)).toEqual(["received", "received", "current"]);
  });

  it("is null when there is nobody to schedule", () => {
    expect(buildSchedule({ cycleStart: START, members: [], currentWeek: 1 })).toBeNull();
  });
});

describe("scheduleForWeek", () => {
  it("gives a week's Sunday, recipient and cycle", () => {
    expect(scheduleForWeek(2, START, THREE)).toMatchObject({ date: "2026-09-13", cycle: 1 });
    expect(scheduleForWeek(2, START, THREE)?.recipient.name).toBe("Bonface Mutie");
    expect(scheduleForWeek(4, START, THREE)).toMatchObject({ date: "2026-09-27", cycle: 2 });
    expect(scheduleForWeek(4, START, THREE)?.recipient.name).toBe("Agnes Wanjira");
  });

  it("is null without a start date, members or a real week", () => {
    expect(scheduleForWeek(2, null, THREE)).toBeNull();
    expect(scheduleForWeek(2, START, [])).toBeNull();
    expect(scheduleForWeek(0, START, THREE)).toBeNull();
  });
});
