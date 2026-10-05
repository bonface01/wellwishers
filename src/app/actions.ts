"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { groups, members, payments } from "@/db/schema";
import { createSession, destroySession, isAdmin, passwordMatches, requireAdmin } from "@/lib/auth";
import { getGroup, getRoundState } from "@/lib/data";
import {
  closeWeekStatements,
  deleteWeekStatements,
  nextHistoryId,
  recordWeekStatements,
  saveWeekStatements,
} from "@/lib/history-db";
import { getAddWeekData, getWeek } from "@/lib/history-data";
import { comparePayoutOrder, capitalizeName, fullName } from "@/lib/names";
import {
  clearFailedAttempts,
  clientIp,
  lockoutMessage,
  lockoutMinutesLeft,
  recordFailedAttempt,
} from "@/lib/rate-limit";
import { joinedCycleForNewMember, nairobiToday, orderForCycle, scheduleForWeek } from "@/lib/schedule";
import { buildChecklist, isSunday, sanitizePaidNames, sundayPayoutAt, validateNewWeek } from "@/lib/week-edit";

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

  // The week number is only sent while no cycle start date is set. Once it is, the week follows the date.
  const roundField = formData.get("currentRound");
  const cycleStartRaw = String(formData.get("cycleStart") ?? "").trim();
  const cycleStart = cycleStartRaw === "" ? null : cycleStartRaw;

  if (!name) return { error: "Group name is required." };
  if (cycleStart !== null && !isSunday(cycleStart)) return { error: "The cycle start date must be a Sunday." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a valid contribution amount." };

  const group = await getGroup();
  const round = roundField === null ? group.currentRound : Number(roundField);
  if (!Number.isInteger(round) || round < 1) return { error: "Week number must be a whole number, 1 or higher." };

  const db = getDb();
  const update = db
    .update(groups)
    .set({ name, currency, amount: amount.toFixed(2), recipientPays, currentRound: round, cycleStart })
    .where(eq(groups.id, 1));

  if (round !== group.currentRound) {
    // Payments belong to a specific round, so jumping to another round starts with a clean checklist.
    await db.batch([update, db.delete(payments)]);
  } else {
    await update;
  }
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

  // The order is locked for the running cycle: a member added mid-cycle joins from the next cycle, so nobody
  // already in the order moves. Before the first cycle starts (or with no start date) they join cycle 1.
  const group = await getGroup();
  const existing = [...(await db.select().from(members))].sort(comparePayoutOrder);
  const joinedCycle = joinedCycleForNewMember(
    nairobiToday(),
    group.cycleStart,
    existing.map((m) => ({ id: m.id, name: fullName(m), joinedCycle: m.joinedCycle })),
  );

  await db.insert(members).values({ firstName, secondName, joinedCycle });
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

// Used to set up a group that is already part-way through a cycle (only while no cycle start date is set).
export async function setReceived(memberId: number, received: boolean): Promise<FormState> {
  await requireAdmin();
  const db = getDb();
  const all = await db.select().from(members);
  if (!all.some((m) => m.id === memberId)) return { error: "Member not found." };

  if (received && all.every((m) => m.id === memberId || m.receivedThisCycle)) {
    return {
      error: "At least one member must still be waiting to receive. To begin a new cycle, use Start new cycle.",
    };
  }
  await db.update(members).set({ receivedThisCycle: received }).where(eq(members.id, memberId));
  refresh();
  return { ok: true };
}

// ---- Rounds ----

// Returns an error instead of throwing so the UI can roll back its optimistic update and explain why.
export async function setPaid(memberId: number, paid: boolean): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Your session has expired. Please sign in again." };
  try {
    const s = await getRoundState();
    if (!s.payers.some((m) => m.id === memberId)) {
      return { error: "This member does not pay this week. Reload the page." };
    }
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
    return { ok: true };
  } catch {
    return { error: "The server could not save it." };
  }
}

/** Close the current week: confirm the payout and save who paid. */
export async function closeRound(formData: FormData) {
  await requireAdmin();
  const s = await getRoundState();
  // Ignore stale or double submissions for a week that has already been closed.
  if (Number(formData.get("round")) !== s.group.currentRound) return;
  if (!s.recipient) return;

  const db = getDb();
  const round = s.group.currentRound;
  const paid = s.paid.map((m) => ({ id: m.id, name: fullName(m) }));

  if (s.mode === "schedule") {
    // The date and the order already decide the week and who has received, so closing only records the week.
    if (s.closed || !s.currentDate) return;
    await db.batch(
      recordWeekStatements(db, {
        historyId: await nextHistoryId(db),
        round,
        date: sundayPayoutAt(s.currentDate),
        recipientName: fullName(s.recipient),
        contribution: s.group.amount,
        recipientPays: s.group.recipientPays,
        paid,
      }),
    );
    refresh();
    return;
  }

  // Legacy (no cycle start date yet): record the week, mark the recipient, clear the checklist and move on.
  const waiting = s.order.filter((m) => !m.receivedThisCycle).length;
  await db.batch(
    closeWeekStatements(db, {
      historyId: await nextHistoryId(db),
      round,
      recipientId: s.recipient.id,
      recipientName: fullName(s.recipient),
      contribution: s.group.amount,
      recipientPays: s.group.recipientPays,
      paid,
      cycleEnds: waiting <= 1,
    }),
  );
  refresh();
}

// ---- Past weeks ----

/** Correct who paid in a closed week. The week's total is recalculated from the ticks. */
export async function saveWeek(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const round = Number(formData.get("round"));
  if (!Number.isInteger(round)) return { error: "Unknown week." };
  const week = await getWeek(round);
  if (!week) return { error: `Week ${round} was not found.` };

  const names = sanitizePaidNames(
    formData.getAll("paid").map(String),
    week.checklist.map((r) => r.name),
  );
  const paid = names.map((name) => ({ id: week.checklist.find((r) => r.name === name)?.memberId ?? null, name }));

  try {
    const db = getDb();
    await db.batch(
      saveWeekStatements(db, {
        historyId: week.row.id,
        contribution: week.contribution,
        recipientPays: week.recipientPays,
        paid,
      }),
    );
  } catch {
    return { error: "Could not save, so nothing was changed. Please try again." };
  }
  refresh();
  redirect(`/admin/history?saved=${round}`);
}

/** Delete a recorded week (for example one entered wrongly), so it can be added again properly. */
export async function deleteWeek(formData: FormData) {
  await requireAdmin();
  const round = Number(formData.get("round"));
  if (!Number.isInteger(round)) redirect("/admin/history");
  const week = await getWeek(round);
  if (!week) redirect("/admin/history");

  try {
    const db = getDb();
    await db.batch(deleteWeekStatements(db, week.row.id));
  } catch {
    redirect(`/admin/history?error=delete-${round}`);
  }
  refresh();
  redirect(`/admin/history?deleted=${round}`);
}

/** Add a past week that was never recorded in the app. Its Sunday and recipient come from the schedule. */
export async function addPastWeek(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const data = await getAddWeekData();
  const week = Number(formData.get("week"));

  const problem = validateNewWeek({
    week,
    currentRound: data.currentRound,
    existingRounds: data.existingRounds,
    cycleStart: data.group.cycleStart,
    memberCount: data.members.length,
  });
  const schedule = scheduleForWeek(week, data.group.cycleStart, data.members);
  if (problem || !schedule) return { error: problem ?? "Could not work out that week's date and recipient." };

  // Only the members of that week's cycle could have paid (someone who joined later was not in it).
  const checklist = buildChecklist({
    members: orderForCycle(data.members, schedule.cycle).map((m) => ({ id: m.id, name: m.name })),
    saved: [],
    recipientName: schedule.recipient.name,
    recipientPays: data.group.recipientPays,
  });
  const names = sanitizePaidNames(
    formData.getAll("paid").map(String),
    checklist.map((r) => r.name),
  );
  const paid = names.map((name) => ({ id: checklist.find((r) => r.name === name)?.memberId ?? null, name }));

  try {
    const db = getDb();
    await db.batch(
      recordWeekStatements(db, {
        historyId: await nextHistoryId(db),
        round: week,
        date: sundayPayoutAt(schedule.date),
        recipientName: schedule.recipient.name,
        contribution: data.group.amount,
        recipientPays: data.group.recipientPays,
        paid,
      }),
    );
  } catch {
    return { error: "Could not add the week, so nothing was changed. Please try again." };
  }
  refresh();
  redirect(`/admin/history?saved=${week}`);
}

export async function startNewCycle() {
  await requireAdmin();
  await getDb().update(members).set({ receivedThisCycle: false });
  refresh();
}
