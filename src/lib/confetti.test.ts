import { describe, expect, it } from "vitest";
import { CONFETTI_COLORS, makeConfetti } from "./confetti";

// Small deterministic generator so the test is repeatable.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("makeConfetti", () => {
  it("makes the requested number of particles with unique ids", () => {
    const p = makeConfetti(28, seeded(1));
    expect(p).toHaveLength(28);
    expect(new Set(p.map((x) => x.id)).size).toBe(28);
  });

  it("uses only the green and amber palette", () => {
    for (const p of makeConfetti(200, seeded(7))) expect(CONFETTI_COLORS).toContain(p.color);
  });

  it("keeps travel, timing and size in small, tasteful ranges", () => {
    for (const p of makeConfetti(200, seeded(3))) {
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(190);
      expect(p.uy).toBeLessThan(0);
      expect(p.dy).toBeGreaterThan(0);
      expect(p.delay).toBeLessThanOrEqual(140);
      expect(p.size).toBeGreaterThanOrEqual(6);
      expect(p.size).toBeLessThanOrEqual(11);
    }
  });

  it("is repeatable for the same seed and different for another", () => {
    expect(makeConfetti(10, seeded(5))).toEqual(makeConfetti(10, seeded(5)));
    expect(makeConfetti(10, seeded(5))).not.toEqual(makeConfetti(10, seeded(6)));
  });
});
