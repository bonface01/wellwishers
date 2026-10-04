"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { groups, history, members, payments } from "@/db/schema";
import { createSession, destroySession, passwordMatches, requireAdmin } from "@/lib/auth";
import { getGroup, getRoundState } from "@/lib/data";
import { capitalizeName, fullName } from "@/lib/names";
import {
  clearFailedAttempts,
  clientIp,
  lockoutMessage,
  lockoutMinutesLeft,
  recordFailedAttempt,
} from "@/lib/rate-limit";

export type FormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/", "layout");
}

// ---- Session ----

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  const locked = await lockoutMinutesLeft(ip);
  if (locked > 0) return { error: lockoutMessage(locked) };

  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    const nowLocked = await recordFailedAttempt(ip);
    return { error: nowLocked > 0 ? lockoutMessage(nowLocked) : "Incorrect password." };
  }
  await clearFailedAttempts(ip);
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ---- Settings ----

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const recipientPays = formData.get("recipientPays") === "on";

  if (!name) return { error: "Group name is required." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a valid contribution amount." };

  await getGroup();
  await getDb()
    .update(groups)
    .set({ name, currency, amount: amount.toFixed(2), recipientPays })
    .where(eq(groups.id, 1));
  refresh();
  return { ok: true };
}

// ---- Members ----

export async function addMember(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const firstName = capitalizeName(String(formData.get("firstName") ?? ""));
  const secondName = capitalizeName(String(formData.get("secondName") ?? ""));
  if (!firstName || !secondName) return { error: "Enter both a first name and a second name." };

  const db = getDb();
  const [dup] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        sql`lower(${members.firstName}) = ${firstName.toLowerCase()}`,
        sql`lower(${members.secondName}) = ${secondName.toLowerCase()}`,
      ),
    );
  if (dup) return { error: `${firstName} ${secondName} is already a member.` };

  await db.insert(members).values({ firstName, secondName });
  refresh();
  return { ok: true };
}

export async function removeMember(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const db = getDb();
  await db.delete(members).where(eq(members.id, id));

  // If the removed member was the last one still waiting, everyone left has received: start fresh.
  const remaining = await db.select().from(members);
  if (remaining.length > 0 && remaining.every((m) => m.receivedThisCycle)) {
    await db.update(members).set({ receivedThisCycle: false });
  }
  refresh();
}

// ---- Rounds ----

export async function setPaid(memberId: number, paid: boolean) {
  await requireAdmin();
  const s = await getRoundState();
  if (!s.payers.some((m) => m.id === memberId)) return;
  const db = getDb();
  if (paid) {
    await db
      .insert(payments)
      .values({ round: s.group.currentRound, memberId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(payments)
      .where(and(eq(payments.round, s.group.currentRound), eq(payments.memberId, memberId)));
  }
  refresh();
}

export async function closeRound(formData: FormData) {
  await requireAdmin();
  const s = await getRoundState();
  // Ignore stale or double submissions for a round that has already been closed.
  if (Number(formData.get("round")) !== s.group.currentRound) return;
  if (!s.recipient) return;

  const db = getDb();
  const round = s.group.currentRound;
  const waiting = s.order.filter((m) => !m.receivedThisCycle).length;
  const cycleEnds = waiting <= 1;

  await db.batch([
    db.insert(history).values({
      round,
      recipientName: fullName(s.recipient),
      amount: s.collected.toFixed(2),
    }),
    cycleEnds
      ? db.update(members).set({ receivedThisCycle: false })
      : db.update(members).set({ receivedThisCycle: true }).where(eq(members.id, s.recipient.id)),
    db.delete(payments).where(eq(payments.round, round)),
    db.update(groups).set({ currentRound: round + 1 }).where(eq(groups.id, 1)),
  ]);
  refresh();
}

export async function startNewCycle() {
  await requireAdmin();
  await getDb().update(members).set({ receivedThisCycle: false });
  refresh();
}
