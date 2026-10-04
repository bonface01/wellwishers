/** True when the user has asked the OS/browser for reduced motion. Also true where we can't tell. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Short haptic tap where supported (mostly Android). Skipped for reduced-motion users. */
export function buzz(ms = 10): void {
  if (prefersReducedMotion()) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
}
