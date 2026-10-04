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

const cmp = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
const initial = (s: string) => s.trim().charAt(0).toUpperCase();

// First initial, then second-name initial, then full first name, then full second name.
export function comparePayoutOrder(a: Named, b: Named): number {
  return (
    cmp(initial(a.firstName), initial(b.firstName)) ||
    cmp(initial(a.secondName), initial(b.secondName)) ||
    cmp(a.firstName, b.firstName) ||
    cmp(a.secondName, b.secondName)
  );
}
