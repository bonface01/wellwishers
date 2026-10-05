"use client";

import { useEffect } from "react";

/**
 * What the glass blurs: soft colour orbs drifting slowly behind everything plus a faint film grain.
 * The orbs animate only transform and opacity (see globals.css). The animation is paused while the tab is hidden.
 */
export function Backdrop() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => root.setAttribute("data-tab-hidden", String(document.hidden));
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />
      <div className="orb o4" />
      <div className="grain" />
    </div>
  );
}
