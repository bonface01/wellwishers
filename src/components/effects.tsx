"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Particle } from "@/lib/confetti";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Gentle 3D tilt that follows the mouse. Desktop only: ignored for touch and pen input,
 * on devices without hover, and for users who prefer reduced motion.
 */
export function Tilt({ children, className = "", maxDeg = 7 }: { children: ReactNode; className?: string; maxDeg?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(px * maxDeg * 2).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-py * maxDeg * 2).toFixed(2)}deg`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", reset);
    };
  }, [maxDeg]);

  return (
    <div ref={ref} className={`tilt ${className}`}>
      {children}
    </div>
  );
}

/** A small burst of confetti pieces. Pure CSS animation (transform and opacity only). */
export function Confetti({ particles }: { particles: Particle[] }) {
  return (
    <div className="confetti" aria-hidden="true" data-testid="confetti">
      {particles.map((p) => (
        <i
          key={p.id}
          className={p.round ? "round" : undefined}
          style={
            {
              "--dx": `${p.dx}px`,
              "--uy": `${p.uy}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              "--delay": `${p.delay}ms`,
              "--s": `${p.size}px`,
              "--c": p.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
