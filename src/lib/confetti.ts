export type Particle = {
  id: number;
  dx: number; // final horizontal travel, px
  uy: number; // peak rise (negative), px
  dy: number; // final fall, px
  rot: number; // degrees
  delay: number; // ms
  size: number; // px
  color: string;
  round: boolean;
};

export const CONFETTI_COLORS = ["#3FCB8A", "#62E3A6", "#10B981", "#F2B544", "#FFD66B"] as const;

/** A small burst of green and amber pieces. Pass a seeded `random` for deterministic output. */
export function makeConfetti(count = 28, random: () => number = Math.random): Particle[] {
  const between = (min: number, max: number) => min + random() * (max - min);
  return Array.from({ length: count }, (_, id) => ({
    id,
    dx: between(-190, 190),
    uy: between(-140, -50),
    dy: between(30, 170),
    rot: between(-420, 420),
    delay: Math.round(between(0, 140)),
    size: Math.round(between(6, 11)),
    color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
    round: random() < 0.3,
  }));
}
