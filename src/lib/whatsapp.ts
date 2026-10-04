import { formatMoney } from "./format";

export type WhatsAppInput = {
  groupName: string;
  round: number;
  amount: number;
  currency: string;
  recipientName: string | null;
  nextName: string | null;
  paid: string[];
  unpaid: string[];
};

export function buildWhatsAppMessage(i: WhatsAppInput): string {
  const money = (n: number) => formatMoney(n, i.currency);
  const collected = i.paid.length * i.amount;
  const expected = (i.paid.length + i.unpaid.length) * i.amount;
  const lines: string[] = [
    `*${i.groupName}*`,
    `Week ${i.round}`,
    "",
    `Contribution: ${money(i.amount)} each`,
    `This week's pot goes to: *${i.recipientName ?? "—"}*`,
    "",
  ];

  if (i.paid.length > 0) {
    lines.push(`✅ Paid (${i.paid.length})`, ...i.paid.map((n) => `• ${n}`), "");
  }
  if (i.unpaid.length > 0) {
    lines.push(`⏳ Not yet paid (${i.unpaid.length})`, ...i.unpaid.map((n) => `• ${n}`), "");
  } else {
    lines.push("🎉 Everyone has paid!", "");
  }

  lines.push(`Collected: ${money(collected)} of ${money(expected)}`);
  if (i.nextName) lines.push(`Next week: ${i.nextName}`);
  return lines.join("\n");
}
