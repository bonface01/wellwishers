"use client";

import { formatMoney } from "@/lib/format";
import { formatCountdown, nextPayoutAt } from "@/lib/countdown";
import type { Particle } from "@/lib/confetti";
import { Confetti, Tilt } from "./effects";
import { Money, Ring, useNow } from "./ui";

/** Group name, big "Week N", and a live "Payout in …" pill counting down to Sunday 18:00 Nairobi time. */
export function RoundHeader({ groupName, round }: { groupName: string; round: number }) {
  const now = useNow(60_000);
  const left = now ? formatCountdown(nextPayoutAt(now).getTime() - now.getTime()) : null;
  return (
    <header className="round-head">
      <div>
        <p className="eyebrow">{groupName}</p>
        <h1>Week {round}</h1>
      </div>
      <div className="pill" data-testid="payout-pill">
        <span className="dot" aria-hidden="true" />
        <span>
          Payout in <strong>{left ?? "…"}</strong>
        </span>
      </div>
    </header>
  );
}

export type HeroProps = {
  recipientName: string | null;
  collected: number;
  expected: number;
  currency: string;
  paidCount: number;
  totalCount: number;
  nextName: string | null;
  nextIsNewCycle: boolean;
  /** Ring glows and pulses once (set briefly when the pot becomes complete). */
  celebrate?: boolean;
  /** Confetti pieces to show right now, if any. */
  confetti?: Particle[] | null;
};

export function isComplete(paidCount: number, totalCount: number) {
  return totalCount > 0 && paidCount >= totalCount;
}

/** Dark hero card: progress ring, this week's recipient, collected amount in amber, next recipient. */
export function Hero(p: HeroProps) {
  const complete = isComplete(p.paidCount, p.totalCount);
  return (
    <Tilt className="hero-wrap">
      <section className={`hero ${complete ? "is-complete" : ""}`}>
        <div className="hero-main">
          <Ring paid={p.paidCount} total={p.totalCount} complete={complete} celebrate={p.celebrate} />
          <div className="hero-text">
            <p className="hero-label">This week&apos;s pot goes to</p>
            <h2 className="hero-name">{p.recipientName ?? "—"}</h2>
            <p className="hero-collected">
              <Money value={p.collected} currency={p.currency} />
            </p>
            <p className="hero-expected">of {formatMoney(p.expected, p.currency)} expected</p>
          </div>
        </div>
        {p.nextName && (
          <>
            <hr className="hero-divider" />
            <p className="hero-next">
              Next week: <strong>{p.nextName}</strong>
              {p.nextIsNewCycle && <span className="hero-muted"> (new cycle)</span>}
            </p>
          </>
        )}
      </section>
      {p.confetti && p.confetti.length > 0 && <Confetti particles={p.confetti} />}
    </Tilt>
  );
}
