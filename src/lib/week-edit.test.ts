import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  dateInputValue,
  diffPaid,
  isRealDate,
  isSunday,
  sanitizePaidNames,
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

describe("validateNewWeek", () => {
  const ok = { week: 2, date: "2026-09-13", recipientName: "Agnes Wanjira", currentRound: 4, existingRounds: [3] };

  it("accepts a past Sunday week that is not in the history", () => {
    expect(validateNewWeek(ok)).toBeNull();
  });

  it.each([
    [{ week: 0 }, /whole number/],
    [{ week: 2.5 }, /whole number/],
    [{ week: Number.NaN }, /whole number/],
    [{ week: 4 }, /not in the past/],
    [{ week: 9 }, /not in the past/],
    [{ week: 3 }, /already in the history/],
    [{ date: "" }, /Choose the Sunday/],
    [{ date: "2026-02-30" }, /not valid/],
    [{ date: "2026-09-14" }, /Sunday/],
    [{ recipientName: null }, /who received/],
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
