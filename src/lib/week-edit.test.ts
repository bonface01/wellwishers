import { describe, expect, it } from "vitest";
import {
  addDays,
  buildChecklist,
  dateInputValue,
  diffPaid,
  isRealDate,
  isSunday,
  missingWeeks,
  sanitizePaidNames,
  scheduleForWeek,
  setupProblem,
  sundayPayoutAt,
  validateNewWeek,
  weekTotal,
} from "./week-edit";

describe("dates", () => {
  it("knows real dates and Sundays", () => {
    expect(isRealDate("2026-10-04")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("04/10/2026")).toBe(false);
    expect(isRealDate("")).toBe(false);
    expect(isSunday("2026-10-04")).toBe(true); // a Sunday
    expect(isSunday("2026-10-05")).toBe(false); // Monday
    expect(isSunday("2026-02-30")).toBe(false);
  });

  it("stores a Sunday as 18:00 Nairobi time (15:00 UTC) and reads it back as the same date", () => {
    const d = sundayPayoutAt("2026-10-04");
    expect(d.toISOString()).toBe("2026-10-04T15:00:00.000Z");
    expect(dateInputValue(d)).toBe("2026-10-04");
    expect(dateInputValue(new Date("2026-10-04T21:30:00Z"))).toBe("2026-10-05"); // already Monday in Nairobi
  });
});

describe("weekTotal", () => {
  it("multiplies the payers by the contribution to the cent", () => {
    expect(weekTotal(8, 100)).toBe(800);
    expect(weekTotal(0, 100)).toBe(0);
    expect(weekTotal(3, 33.33)).toBe(99.99);
    expect(weekTotal(3, 0.1)).toBe(0.3);
  });
});

const ORDER = ["Agnes Wanjira", "Bonface Mutie", "Brian Kithua"];

describe("addDays", () => {
  it("adds whole days across month and year ends", () => {
    expect(addDays("2026-09-13", 7)).toBe("2026-09-20");
    expect(addDays("2026-09-27", 7)).toBe("2026-10-04");
    expect(addDays("2026-12-27", 7)).toBe("2027-01-03");
    expect(addDays("2026-03-01", 0)).toBe("2026-03-01");
  });
});

describe("scheduleForWeek (week 1 is the cycle start Sunday)", () => {
  const start = "2026-09-13"; // a Sunday

  it("gives week 1 the start Sunday and the first person in the order", () => {
    expect(scheduleForWeek(1, start, ORDER)).toEqual({ date: "2026-09-13", recipient: "Agnes Wanjira" });
  });

  it("moves one Sunday and one person on for each week", () => {
    expect(scheduleForWeek(2, start, ORDER)).toEqual({ date: "2026-09-20", recipient: "Bonface Mutie" });
    expect(scheduleForWeek(3, start, ORDER)).toEqual({ date: "2026-09-27", recipient: "Brian Kithua" });
  });

  it("wraps back to the top of the order for the next cycle, while the dates keep counting", () => {
    expect(scheduleForWeek(4, start, ORDER)).toEqual({ date: "2026-10-04", recipient: "Agnes Wanjira" });
    expect(scheduleForWeek(7, start, ORDER)).toEqual({ date: "2026-10-25", recipient: "Agnes Wanjira" });
  });

  it("always lands on a Sunday", () => {
    for (let w = 1; w <= 60; w++) expect(isSunday(scheduleForWeek(w, start, ORDER)!.date)).toBe(true);
  });

  it("returns null when it cannot be worked out", () => {
    expect(scheduleForWeek(0, start, ORDER)).toBeNull();
    expect(scheduleForWeek(1.5, start, ORDER)).toBeNull();
    expect(scheduleForWeek(Number.NaN, start, ORDER)).toBeNull();
    expect(scheduleForWeek(2, null, ORDER)).toBeNull();
    expect(scheduleForWeek(2, "2026-09-14", ORDER)).toBeNull(); // a Monday
    expect(scheduleForWeek(2, start, [])).toBeNull();
  });
});

describe("missingWeeks", () => {
  it("lists the earlier weeks that are not in the history", () => {
    expect(missingWeeks(5, [3, 4])).toEqual([1, 2]);
    expect(missingWeeks(5, [])).toEqual([1, 2, 3, 4]);
    expect(missingWeeks(5, [1, 2, 3, 4])).toEqual([]);
    expect(missingWeeks(1, [])).toEqual([]);
  });

  it("ignores history for weeks that are not before the current one", () => {
    expect(missingWeeks(4, [9, 3])).toEqual([1, 2]);
  });
});

describe("setupProblem", () => {
  it("asks for the members and the cycle start date before anything else", () => {
    expect(setupProblem("2026-09-13", 3)).toBeNull();
    expect(setupProblem("2026-09-13", 0)).toMatch(/members/);
    expect(setupProblem(null, 3)).toMatch(/cycle start date in Settings/);
    expect(setupProblem("2026-09-14", 3)).toMatch(/must be a Sunday/);
  });
});

describe("validateNewWeek", () => {
  const ok = { week: 2, currentRound: 4, existingRounds: [3], cycleStart: "2026-09-13", order: ORDER };

  it("accepts a past week that is not in the history once the cycle start is set", () => {
    expect(validateNewWeek(ok)).toBeNull();
  });

  it.each([
    [{ week: 0 }, /Choose the week/],
    [{ week: 2.5 }, /Choose the week/],
    [{ week: Number.NaN }, /Choose the week/],
    [{ week: 4 }, /not in the past/],
    [{ week: 9 }, /not in the past/],
    [{ week: 3 }, /already in the history/],
    [{ cycleStart: null }, /cycle start date in Settings/],
    [{ cycleStart: "2026-09-14" }, /must be a Sunday/],
    [{ order: [] }, /Add the members/],
  ])("rejects %j", (patch, message) => {
    expect(validateNewWeek({ ...ok, ...patch })).toMatch(message);
  });
});

describe("buildChecklist", () => {
  const members = [
    { id: 1, name: "Agnes Wanjira" },
    { id: 2, name: "Bonface Mutie" },
    { id: 3, name: "Brian Kithua" },
  ];

  it("lists everyone, marking who paid", () => {
    const rows = buildChecklist({
      members,
      saved: [{ memberId: 2, name: "Bonface Mutie" }],
      recipientName: "Agnes Wanjira",
      recipientPays: true,
    });
    expect(rows.map((r) => [r.name, r.paid, r.former])).toEqual([
      ["Agnes Wanjira", false, false],
      ["Bonface Mutie", true, false],
      ["Brian Kithua", false, false],
    ]);
  });

  it("leaves the recipient out when they did not contribute that week", () => {
    const rows = buildChecklist({ members, saved: [], recipientName: "Agnes Wanjira", recipientPays: false });
    expect(rows.map((r) => r.name)).toEqual(["Bonface Mutie", "Brian Kithua"]);
  });

  it("keeps the recipient if they are already recorded as having paid", () => {
    const rows = buildChecklist({
      members,
      saved: [{ memberId: 1, name: "Agnes Wanjira" }],
      recipientName: "Agnes Wanjira",
      recipientPays: false,
    });
    expect(rows.find((r) => r.name === "Agnes Wanjira")?.paid).toBe(true);
  });

  it("keeps a removed member's payment as a former member", () => {
    const rows = buildChecklist({
      members,
      saved: [{ memberId: null, name: "Zed Gone" }],
      recipientName: "Agnes Wanjira",
      recipientPays: true,
    });
    expect(rows[rows.length - 1]).toEqual({ name: "Zed Gone", memberId: null, former: true, paid: true });
  });
});

describe("diffPaid / sanitizePaidNames", () => {
  it("reports who was added and removed", () => {
    expect(diffPaid(new Set(["A", "B"]), new Set(["B", "C"]))).toEqual({ added: ["C"], removed: ["A"] });
    expect(diffPaid(new Set(["A"]), new Set(["A"]))).toEqual({ added: [], removed: [] });
  });

  it("drops names that are not on the checklist and removes duplicates", () => {
    expect(sanitizePaidNames(["A", "A", " B ", "Hacker"], ["A", "B", "C"])).toEqual(["A", "B"]);
    expect(sanitizePaidNames([], ["A"])).toEqual([]);
  });
});
