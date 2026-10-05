import { addDays, dateInputValue } from "./week-edit";

// The weekly schedule. Contributions happen every Sunday. Week 1 is the cycle start Sunday, and week N always
// falls (N − 1) weeks after it. A cycle is one pass through the members, in payout order; the next cycle
// starts the following Sunday. Everything here is pure, so the same maths drives every screen.

export type SMember = { id: number; name: string; joinedCycle: number };

/** The first cycle a member takes part in is `joinedCycle`; they are in every cycle after that too. */
export function orderForCycle(members: SMember[], cycle: number): SMember[] {
  return members.filter((m) => m.joinedCycle <= cycle);
}

export type WeekInfo = {
  week: number;
  cycle: number;
  /** Position within the cycle, from 0. */
  index: number;
  startWeek: number;
  endWeek: number;
  size: number;
  member: SMember;
};

const MAX_CYCLES = 5000;

/**
 * Which cycle a week falls in and who receives it. `members` must already be in payout order. Cycles follow each
 * other with no gap, and a cycle is as long as the number of members who have joined by then.
 */
export function weekInfo(week: number, members: SMember[]): WeekInfo | null {
  if (!Number.isInteger(week) || week < 1 || members.length === 0) return null;
  let start = 1;
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const order = orderForCycle(members, cycle);
    if (order.length === 0) continue; // nobody has joined yet: a cycle of zero weeks
    const end = start + order.length - 1;
    if (week <= end) {
      const index = week - start;
      return { week, cycle, index, startWeek: start, endWeek: end, size: order.length, member: order[index] };
    }
    start = end + 1;
  }
  return null;
}

/** The Sunday of week N, as yyyy-mm-dd. */
export function weekDate(week: number, cycleStart: string): string {
  return addDays(cycleStart, 7 * (week - 1));
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Whole days from one date to another (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

/** Today's date in Nairobi, as yyyy-mm-dd. */
export function nairobiToday(now: Date = new Date()): string {
  return dateInputValue(now);
}

/**
 * The current week, from today's date and the cycle start Sunday. A week belongs to its Sunday: it is the current
 * week up to and including that Sunday, and the next week begins on the Monday. Before the start it is week 1.
 */
export function currentWeekFor(todayIso: string, cycleStart: string): number {
  const days = daysBetween(cycleStart, todayIso);
  return days <= 0 ? 1 : Math.ceil(days / 7) + 1;
}

/**
 * The cycle a member added today should join. During a running cycle that is the next one, so nobody already in
 * the order is moved; before the first cycle has begun (or while no start date is set) it is cycle 1.
 */
export function joinedCycleForNewMember(todayIso: string, cycleStart: string | null, members: SMember[]): number {
  if (!cycleStart || daysBetween(cycleStart, todayIso) <= 0) return 1;
  const info = weekInfo(currentWeekFor(todayIso, cycleStart), members);
  return info ? info.cycle + 1 : 1;
}

export type ScheduleStatus = "received" | "current" | "upcoming";
export type ScheduleEntry = { week: number; date: string; member: SMember; status: ScheduleStatus };

export type CycleSchedule = {
  cycle: number;
  startWeek: number;
  endWeek: number;
  entries: ScheduleEntry[];
  nextCycleStartWeek: number;
  nextCycleStartDate: string;
  /** People added during this cycle, who join the order from the next one. */
  joiningNext: SMember[];
};

/** Every week of the cycle the current week is in, each with its Sunday, its recipient and where it stands. */
export function buildSchedule(opts: { cycleStart: string; members: SMember[]; currentWeek: number }): CycleSchedule | null {
  const info = weekInfo(opts.currentWeek, opts.members);
  if (!info) return null;
  const order = orderForCycle(opts.members, info.cycle);
  const entries: ScheduleEntry[] = order.map((member, i) => {
    const week = info.startWeek + i;
    return {
      week,
      date: weekDate(week, opts.cycleStart),
      member,
      status: week < opts.currentWeek ? "received" : week === opts.currentWeek ? "current" : "upcoming",
    };
  });
  return {
    cycle: info.cycle,
    startWeek: info.startWeek,
    endWeek: info.endWeek,
    entries,
    nextCycleStartWeek: info.endWeek + 1,
    nextCycleStartDate: weekDate(info.endWeek + 1, opts.cycleStart),
    joiningNext: opts.members.filter((m) => m.joinedCycle > info.cycle),
  };
}

/** The Sunday, recipient and cycle of any week, or null when it cannot be worked out. */
export function scheduleForWeek(
  week: number,
  cycleStart: string | null,
  members: SMember[],
): { date: string; recipient: SMember; cycle: number } | null {
  if (!cycleStart) return null;
  const info = weekInfo(week, members);
  return info ? { date: weekDate(week, cycleStart), recipient: info.member, cycle: info.cycle } : null;
}
