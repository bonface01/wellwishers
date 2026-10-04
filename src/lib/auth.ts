import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "cc_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return safeEqual(input, expected);
}

export async function createSession() {
  const payload = String(Date.now() + MAX_AGE_SECONDS * 1000);
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload))) return false;
  return Number(payload) > Date.now();
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}
