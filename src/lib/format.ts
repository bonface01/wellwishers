export function formatMoney(n: number, currency: string): string {
  const num = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency ? `${num} ${currency}` : num;
}

const DEFAULT_TIMEZONE = "Africa/Nairobi";

// Timezone for all displayed dates, from APP_TIMEZONE (IANA name). Falls back if unset or invalid.
function appTimeZone(): string {
  const tz = process.env.APP_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: appTimeZone(),
  });
}
