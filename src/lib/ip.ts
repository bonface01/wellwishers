const UNKNOWN = "unknown";

function parseIPv4(s: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return null;
  const octets = s.split(".").map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

// Returns the 8 16-bit groups of an IPv6 address, or null if it isn't valid.
function parseIPv6(input: string): number[] | null {
  let s = input;
  if (!s.includes(":")) return null;

  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1
  if (s.includes(".")) {
    const cut = s.lastIndexOf(":");
    const v4 = parseIPv4(s.slice(cut + 1));
    if (!v4) return null;
    s = `${s.slice(0, cut + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const parts = s.split("::");
  if (parts.length > 2) return null;
  const groupsOf = (p: string) => (p === "" ? [] : p.split(":"));
  const head = groupsOf(parts[0]);
  let groups: string[];
  if (parts.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const tail = groupsOf(parts[1]);
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  }
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Canonical key for rate limiting:
 *  - IPv4 stays as-is; IPv4-mapped IPv6 (::ffff:a.b.c.d) becomes plain IPv4
 *  - ::1 and 127.0.0.1 are the same address
 *  - other IPv6 addresses are grouped by /64, e.g. "2001:db8:abcd:12::/64"
 *  - anything unparseable becomes "unknown"
 */
export function normalizeIp(raw: string | null | undefined): string {
  let s = (raw ?? "").trim().toLowerCase();
  if (!s) return UNKNOWN;

  const bracketed = s.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) s = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(":"));
  s = s.split("%")[0]; // zone id, e.g. fe80::1%eth0

  const v4 = parseIPv4(s);
  if (v4) return v4.join(".");

  const g = parseIPv6(s);
  if (!g) return UNKNOWN;

  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return "127.0.0.1";
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  }
  return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}
