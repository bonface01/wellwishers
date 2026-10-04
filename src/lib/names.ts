export function capitalizeName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function fullName(m: { firstName: string; secondName: string }) {
  return `${m.firstName} ${m.secondName}`;
}

type Named = { firstName: string; secondName: string };

// Case-insensitive alphabetical comparison.
const cmp = (a: string, b: string) => a.trim().localeCompare(b.trim(), "en", { sensitivity: "accent" });

// Full first name A–Z; only members with exactly the same first name are ordered by second name.
export function comparePayoutOrder(a: Named, b: Named): number {
  return cmp(a.firstName, b.firstName) || cmp(a.secondName, b.secondName);
}
