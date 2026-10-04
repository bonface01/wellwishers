import { describe, expect, it } from "vitest";
import {
  drawStatusImage,
  STATUS_IMAGE_HEIGHT,
  STATUS_IMAGE_WIDTH,
  statusImageFilename,
  type StatusImageInput,
} from "./status-image";

// A recording stand-in for a canvas 2D context (jsdom has no real canvas).
function fakeContext() {
  const texts: string[] = [];
  const fills: string[] = [];
  const state: Record<string, unknown> = { font: "20px x", fillStyle: "" };
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop === "fillText") return (s: string) => texts.push(s);
      if (prop === "fillRect") return () => fills.push(String(target.fillStyle));
      if (prop === "fill") return () => fills.push(String(target.fillStyle));
      if (prop === "measureText") return (s: string) => ({ width: s.length * 12 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, fills };
}

const base: StatusImageInput = {
  groupName: "Test Group",
  week: 4,
  recipientName: "Agnes Wanjira",
  collected: 800,
  expected: 1000,
  currency: "KSh",
  paidCount: 8,
  totalCount: 10,
  nextName: "Brian Kay",
  unpaid: ["Carl Dune", "Zuri Apple"],
};

describe("drawStatusImage", () => {
  it("is a 1080×1920 portrait card", () => {
    expect([STATUS_IMAGE_WIDTH, STATUS_IMAGE_HEIGHT]).toEqual([1080, 1920]);
  });

  it("draws the week, recipient, amounts, progress, next recipient and who still has to pay", () => {
    const { ctx, texts } = fakeContext();
    drawStatusImage(ctx, base);
    expect(texts).toEqual(
      expect.arrayContaining([
        "TEST GROUP",
        "Week 4",
        "THIS WEEK'S POT GOES TO",
        "Agnes Wanjira",
        "KSh",
        "800",
        "of KSh 1,000 expected",
        "8 of 10 paid",
        "Next: Brian Kay",
        "STILL TO PAY",
        "Carl Dune",
        "Zuri Apple",
      ]),
    );
    expect(texts).not.toContain("Pot complete");
    expect(texts).not.toContain("Everyone has paid");
  });

  it("switches to the complete state when everybody has paid", () => {
    const { ctx, texts, fills } = fakeContext();
    drawStatusImage(ctx, { ...base, paidCount: 10, collected: 1000, unpaid: [] });
    expect(texts).toEqual(expect.arrayContaining(["10 of 10 paid", "Pot complete", "Everyone has paid"]));
    expect(fills).toContain("#F2B544"); // amber progress segments
  });

  it("uses the green progress colour while the pot is incomplete", () => {
    const { ctx, fills } = fakeContext();
    drawStatusImage(ctx, base);
    expect(fills).toContain("#3FCB8A");
  });

  it("caps a long unpaid list with a '+N more' line", () => {
    const { ctx, texts } = fakeContext();
    const unpaid = Array.from({ length: 40 }, (_, n) => `Member ${n + 1}`);
    drawStatusImage(ctx, { ...base, unpaid });
    const more = texts.find((t) => /^\+\d+ more$/.test(t));
    expect(more).toBeDefined();
    const shown = unpaid.filter((n) => texts.includes(n)).length;
    expect(shown + Number(more!.match(/\d+/)![0])).toBe(40);
  });

  it("works without a currency or a next recipient", () => {
    const { ctx, texts } = fakeContext();
    drawStatusImage(ctx, { ...base, currency: "", nextName: null });
    expect(texts).toContain("of 1,000 expected");
    expect(texts.some((t) => t.startsWith("Next:"))).toBe(false);
  });
});

describe("statusImageFilename", () => {
  it("makes a tidy file name", () => {
    expect(statusImageFilename("Test Group!", 4)).toBe("test-group-week-4-status.png");
    expect(statusImageFilename("***", 12)).toBe("group-week-12-status.png");
  });
});
