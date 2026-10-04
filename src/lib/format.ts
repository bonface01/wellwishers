export function formatMoney(n: number, currency: string): string {
  const num = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency ? `${num} ${currency}` : num;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
