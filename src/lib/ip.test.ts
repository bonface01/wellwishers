import { describe, expect, it } from "vitest";
import { normalizeIp } from "./ip";

describe("normalizeIp", () => {
  it("treats ::1, 127.0.0.1 and the IPv4-mapped forms as the same address", () => {
    const expected = "127.0.0.1";
    expect(normalizeIp("127.0.0.1")).toBe(expected);
    expect(normalizeIp("::1")).toBe(expected);
    expect(normalizeIp("::ffff:127.0.0.1")).toBe(expected);
    expect(normalizeIp("::ffff:7f00:1")).toBe(expected);
    expect(normalizeIp("0:0:0:0:0:0:0:1")).toBe(expected);
  });

  it("strips the ::ffff: prefix from IPv4-mapped addresses", () => {
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("::FFFF:203.0.113.5")).toBe("203.0.113.5");
  });

  it("leaves plain IPv4 alone and drops a port", () => {
    expect(normalizeIp("203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("203.0.113.5:4711")).toBe("203.0.113.5");
  });

  it("groups IPv6 addresses by /64", () => {
    const a = normalizeIp("2001:db8:abcd:12:1:2:3:4");
    const b = normalizeIp("2001:db8:abcd:12:ffff::9");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(normalizeIp("2001:db8:abcd:13::1")).not.toBe(a);
  });

  it("expands compressed IPv6 and ignores case, brackets, ports and zone ids", () => {
    expect(normalizeIp("2001:0DB8::1")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("falls back to 'unknown' for missing or invalid input", () => {
    for (const bad of [undefined, null, "", "   ", "not-an-ip", "999.1.1.1", "1:2:3", "1::2::3", "::g"]) {
      expect(normalizeIp(bad)).toBe("unknown");
    }
  });
});
