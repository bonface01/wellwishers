import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";
import { normalizeIp } from "./ip";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return normalizeIp(forwarded || h.get("x-real-ip"));
}

/** Minutes left on an active lockout for this IP, or 0 if not locked. */
export async function lockoutMinutesLeft(ip: string): Promise<number> {
  const [row] = await getDb().select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  if (!row?.lockedUntil) return 0;
  const msLeft = row.lockedUntil.getTime() - Date.now();
  return msLeft > 0 ? Math.ceil(msLeft / 60_000) : 0;
}

/**
 * Records a failed attempt in one atomic upsert. The counter restarts if the
 * previous failure is older than the lockout window. Returns minutes locked (0 if not locked).
 */
export async function recordFailedAttempt(ip: string): Promise<number> {
  const window = sql.raw(`interval '${LOCKOUT_MINUTES} minutes'`);
  const nextCount = sql`case when ${loginAttempts.lastFailedAt} < now() - ${window} then 1 else ${loginAttempts.failedCount} + 1 end`;

  const [row] = await getDb()
    .insert(loginAttempts)
    .values({ ip, failedCount: 1, lastFailedAt: sql`now()`, lockedUntil: null })
    .onConflictDoUpdate({
      target: loginAttempts.ip,
      set: {
        failedCount: nextCount,
        lastFailedAt: sql`now()`,
        lockedUntil: sql`case when ${nextCount} >= ${MAX_FAILED_ATTEMPTS} then now() + ${window} else null end`,
      },
    })
    .returning();

  return row.lockedUntil && row.failedCount >= MAX_FAILED_ATTEMPTS ? LOCKOUT_MINUTES : 0;
}

export async function clearFailedAttempts(ip: string) {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}

export function lockoutMessage(minutes: number): string {
  return `Too many failed attempts. Login is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}. Try again later.`;
}
