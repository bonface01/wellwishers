import { describe, expect, it } from "vitest";
import { formatCountdown, nextPayoutAt } from "./countdown";

// Sunday 18:00 in Nairobi (UTC+3) is Sunday 15:00 UTC.
const iso = (d: Date) => d.toISOString();

describe("nextPayoutAt", () => {
  it("picks the coming Sunday 18:00 Nairobi time", () => {
    // Wednesday 2026-10-07 12:00 UTC
    expect(iso(nextPayoutAt(new Date("2026-10-07T12:00:00Z")))).toBe("2026-10-11T15:00:00.000Z");
  });

  it("uses the same Sunday when it is Sunday before 18:00 Nairobi", () => {
    expect(iso(nextPayoutAt(new Date("2026-10-11T14:59:00Z")))).toBe("2026-10-11T15:00:00.000Z");
    expect(iso(nextPayoutAt(new Date("2026-10-11T00:10:00Z")))).toBe("2026-10-11T15:00:00.000Z");
  });

  it("rolls to next week at and after 18:00 Nairobi on Sunday", () => {
    expect(iso(nextPayoutAt(new Date("2026-10-11T15:00:00Z")))).toBe("2026-10-18T15:00:00.000Z");
    expect(iso(nextPayoutAt(new Date("2026-10-11T20:00:00Z")))).toBe("2026-10-18T15:00:00.000Z");
  });

  it("handles Saturday night and month ends", () => {
    expect(iso(nextPayoutAt(new Date("2026-10-10T23:30:00Z")))).toBe("2026-10-11T15:00:00.000Z");
    expect(iso(nextPayoutAt(new Date("2026-10-27T10:00:00Z")))).toBe("2026-11-01T15:00:00.000Z");
  });
});

describe("formatCountdown", () => {
  const min = 60_000;
  it("shows days and hours, then hours and minutes, then minutes", () => {
    expect(formatCountdown((2 * 1440 + 4 * 60 + 30) * min)).toBe("2d 4h");
    expect(formatCountdown((3 * 60 + 20) * min)).toBe("3h 20m");
    expect(formatCountdown(12 * min)).toBe("12m");
    expect(formatCountdown(7 * 1440 * min - 1)).toBe("6d 23h");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toBe("0m");
    expect(formatCountdown(0)).toBe("0m");
  });
});
