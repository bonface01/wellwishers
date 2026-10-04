import { describe, expect, it } from "vitest";
import { summarizeRound } from "./round";
import { buildWhatsAppMessage } from "./whatsapp";

const payers = [
  { id: 1, name: "Agnes Wanjira" },
  { id: 2, name: "Boniface Mutinda" },
  { id: 3, name: "Brian Mutinda" },
];

describe("summarizeRound", () => {
  it("totals what has been collected and splits paid from unpaid", () => {
    const s = summarizeRound(payers, new Set([2]), 100);
    expect(s.paid.map((p) => p.name)).toEqual(["Boniface Mutinda"]);
    expect(s.unpaid.map((p) => p.name)).toEqual(["Agnes Wanjira", "Brian Mutinda"]);
    expect(s.collected).toBe(100);
    expect(s.expected).toBe(300);
    expect(s.pct).toBe(33);
  });

  it("handles nobody paid, everybody paid and a zero amount", () => {
    expect(summarizeRound(payers, new Set(), 100)).toMatchObject({ collected: 0, expected: 300, pct: 0 });
    expect(summarizeRound(payers, new Set([1, 2, 3]), 100)).toMatchObject({ collected: 300, pct: 100 });
    expect(summarizeRound(payers, new Set([1]), 0)).toMatchObject({ collected: 0, expected: 0, pct: 0 });
  });

  it("ignores paid ids that are not payers this round", () => {
    expect(summarizeRound(payers, new Set([99]), 100).collected).toBe(0);
  });
});

describe("buildWhatsAppMessage", () => {
  const base = {
    groupName: "Test Group",
    round: 3,
    amount: 1000,
    currency: "KSh",
    recipientName: "Agnes Wanjira",
    nextName: "Boniface Mutinda",
  };

  it("matches the agreed format with the currency before the amount", () => {
    expect(
      buildWhatsAppMessage({ ...base, paid: ["Boniface Mutinda"], unpaid: ["Agnes Wanjira", "Brian Mutinda"] }),
    ).toBe(
      [
        "*Test Group*",
        "Week 3",
        "",
        "Contribution: KSh 1,000 each",
        "This week's pot goes to: *Agnes Wanjira*",
        "",
        "✅ Paid (1)",
        "• Boniface Mutinda",
        "",
        "⏳ Not yet paid (2)",
        "• Agnes Wanjira",
        "• Brian Mutinda",
        "",
        "Collected: KSh 1,000 of KSh 3,000",
        "Next week: Boniface Mutinda",
      ].join("\n"),
    );
  });

  it("says so when everyone has paid and omits the empty paid list when nobody has", () => {
    expect(buildWhatsAppMessage({ ...base, paid: ["A B"], unpaid: [] })).toContain("🎉 Everyone has paid!");
    const none = buildWhatsAppMessage({ ...base, paid: [], unpaid: ["A B"] });
    expect(none).not.toContain("✅ Paid");
    expect(none).toContain("Collected: KSh 0 of KSh 1,000");
  });
});
