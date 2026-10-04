import { formatMoney } from "./format";
import { fullName } from "./names";
import type { RoundState } from "./data";

export function buildWhatsAppMessage(s: RoundState): string {
  const { group } = s;
  const money = (n: number) => formatMoney(n, group.currency);
  const lines: string[] = [
    `*${group.name}*`,
    `Round ${group.currentRound}`,
    "",
    `Contribution: ${money(group.amount)} each`,
    `This round's pot goes to: *${s.recipient ? fullName(s.recipient) : "—"}*`,
    "",
  ];

  if (s.paid.length > 0) {
    lines.push(`✅ Paid (${s.paid.length})`, ...s.paid.map((m) => `• ${fullName(m)}`), "");
  }
  if (s.unpaid.length > 0) {
    lines.push(`⏳ Not yet paid (${s.unpaid.length})`, ...s.unpaid.map((m) => `• ${fullName(m)}`), "");
  } else {
    lines.push("🎉 Everyone has paid!", "");
  }

  lines.push(`Collected: ${money(s.collected)} of ${money(s.expected)}`);
  if (s.next) lines.push(`Next round: ${fullName(s.next)}`);
  return lines.join("\n");
}
