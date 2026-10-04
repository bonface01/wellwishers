// Weekly payout: Sunday 18:00 Nairobi time. Nairobi is UTC+3 all year (no daylight saving), so that is
// Sunday 15:00 UTC.
const PAYOUT_UTC_HOUR = 15;
const SUNDAY = 0;

/** The next Sunday 18:00 (Nairobi) strictly after `now`. */
export function nextPayoutAt(now: Date): Date {
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), PAYOUT_UTC_HOUR, 0, 0),
  );
  target.setUTCDate(target.getUTCDate() + ((7 + SUNDAY - target.getUTCDay()) % 7));
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 7);
  return target;
}

/** "2d 4h", "3h 20m", "12m" (rounded down to the minute). */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
