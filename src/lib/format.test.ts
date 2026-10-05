import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("puts the currency before the amount", () => {
    expect(formatMoney(100, "KSh")).toBe("KSh 100");
    expect(formatMoney(1000, "KSh")).toBe("KSh 1,000");
    expect(formatMoney(2000, "KSh")).toBe("KSh 2,000");
  });

  it("keeps up to two decimals and handles an empty currency", () => {
    expect(formatMoney(12.5, "KSh")).toBe("KSh 12.5");
    expect(formatMoney(1500, "")).toBe("1,500");
  });
});

import { formatSunday } from "./format";

describe("formatSunday", () => {
  it("writes a calendar date the way the schedule shows it", () => {
    expect(formatSunday("2026-10-11")).toBe("Sun 11 Oct");
    expect(formatSunday("2026-09-06")).toBe("Sun 6 Sept");
  });
});
