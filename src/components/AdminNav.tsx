"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Icon } from "./ui";

const TABS = [
  { href: "/admin", label: "Week", icon: "round" },
  { href: "/admin/members", label: "Members", icon: "members" },
  { href: "/admin/history", label: "History", icon: "history" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
] as const;

/** Floating glass pill with a highlight that slides under the active tab. */
export function AdminNav() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex((t) => (t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href)));
  return (
    <nav className="tabbar" aria-label="Admin">
      <span
        className="tab-pill"
        aria-hidden="true"
        data-none={activeIndex < 0 ? "true" : undefined}
        style={{ "--i": Math.max(activeIndex, 0) } as CSSProperties}
      />
      {TABS.map((t, index) => {
        const active = index === activeIndex;
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
