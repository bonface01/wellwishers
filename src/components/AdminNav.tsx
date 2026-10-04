"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const TABS = [
  { href: "/admin", label: "Round", icon: "round" },
  { href: "/admin/members", label: "Members", icon: "members" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Admin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
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
