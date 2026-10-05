"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { formatNumber } from "@/lib/format";
import { initialsOf } from "@/lib/timeline";

/** Current time, refreshed every `ms`. Null until mounted, so server and client markup match. */
export function useNow(ms = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number that rolls digit by digit like a slot counter when it changes. Each digit is a column holding 0–9;
 * changing the number just moves the column (CSS transition on transform), so it needs no timers or frames.
 * Columns are keyed from the right so units, tens and hundreds stay in place as the number grows.
 */
export function RollingNumber({ value }: { value: number }) {
  const text = formatNumber(Math.round(value * 100) / 100);
  const chars = text.split("");
  return (
    <span className="num" data-value={value} role="img" aria-label={text}>
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i;
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${fromRight}`} className="sep" aria-hidden="true">
              {ch}
            </span>
          );
        }
        return (
          <span key={`d${fromRight}`} className="digit" aria-hidden="true">
            <span className="strip" style={{ "--d": Number(ch), "--i": fromRight } as CSSProperties}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** "KSh" small and light, the number big and bold. Size comes from the parent's CSS. */
export function Money({ value, currency, className = "" }: { value: number; currency: string; className?: string }) {
  return (
    <span className={`money ${className}`}>
      {currency && <span className="cur">{currency}</span>}
      <RollingNumber value={value} />
    </span>
  );
}

export function Avatar({ name, tone }: { name: string; tone: number }) {
  return (
    <span className="avatar" data-tone={(tone % 5) + 1} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/**
 * Circular progress ring with "8/10" and "paid" in the centre, a gradient stroke (green to emerald, amber to gold
 * when complete) and a soft amber glow behind it. `celebrate` makes it glow and pulse once.
 */
export function Ring({
  paid,
  total,
  complete,
  celebrate = false,
}: {
  paid: number;
  total: number;
  complete: boolean;
  celebrate?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const R = 50;
  const C = 2 * Math.PI * R;
  const fraction = total > 0 ? Math.min(1, paid / total) : 0;
  return (
    <div
      className={`ring ${complete ? "complete" : ""} ${celebrate ? "celebrate" : ""}`}
      role="progressbar"
      aria-label={`${paid} of ${total} paid`}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="ring-glow" aria-hidden="true" />
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}ok`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6EE7B0" />
            <stop offset="1" stopColor="#0E9F6E" />
          </linearGradient>
          <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F2B544" />
            <stop offset="1" stopColor="#FFD66B" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="60" cy="60" r={R} />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r={R}
          stroke={`url(#${uid}${complete ? "gold" : "ok"})`}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-label">
        <strong>
          {paid}/{total}
        </strong>
        <span>paid</span>
      </div>
    </div>
  );
}

type IconName = "check" | "share" | "download" | "round" | "members" | "settings" | "whatsapp";

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  share: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  round: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M16 5.2a3 3 0 010 5.6" />
      <path d="M17.5 14.3c1.7.6 2.8 2.1 3 4.7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.2-4A8 8 0 1112 20a8 8 0 01-3.9-1z" />
      <path d="M9.2 9.2c.3 2.2 2.4 4.3 4.6 4.6l1-1.2-1.8-.9-.7.6c-.8-.4-1.5-1.1-1.9-1.9l.6-.7-.9-1.8z" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Bottom sheet on phones, centred card on larger screens. Native <dialog>: focus trap and Esc for free. */
export function SheetDialog(props: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
}) {
  const close = () => props.dialogRef.current?.close();
  return (
    <dialog
      ref={props.dialogRef}
      className="sheet"
      aria-label={props.title}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself) dismisses it.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-grip" aria-hidden="true" />
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </dialog>
  );
}
