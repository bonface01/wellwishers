import { formatSunday } from "@/lib/format";
import type { CycleSchedule } from "@/lib/schedule";
import { Icon } from "./ui";

/**
 * The full schedule for the cycle the group is in: every member with their week number and Sunday, marked
 * received, this week or upcoming. Shown on both the admin and the public page.
 */
export function ScheduleCard({ schedule }: { schedule: CycleSchedule }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Schedule</h3>
        <span className="count">
          Cycle {schedule.cycle} · weeks {schedule.startWeek}–{schedule.endWeek}
        </span>
      </div>
      <ol className="timeline schedule">
        {schedule.entries.map((e) => (
          <li key={e.week} className={e.status} aria-label={`Week ${e.week} · ${e.member.name} · ${formatSunday(e.date)}`}>
            <span className="node" aria-hidden="true">
              {e.status === "received" && <Icon name="check" size={14} />}
            </span>
            <span className="tl-body">
              <span className="tl-name">{e.member.name}</span>
              <span className="tl-sub">
                Week {e.week} · {formatSunday(e.date)}
              </span>
            </span>
            {e.status === "received" && <span className="tl-when">Received</span>}
            {e.status === "current" && <span className="tag amber">This week</span>}
            {e.status === "upcoming" && <span className="tl-when">Upcoming</span>}
          </li>
        ))}
      </ol>
      <p className="note" style={{ marginTop: 12 }}>
        The next cycle starts {formatSunday(schedule.nextCycleStartDate)} (week {schedule.nextCycleStartWeek}).
        {schedule.joiningNext.length > 0 &&
          ` Joining from then: ${schedule.joiningNext.map((m) => m.name).join(", ")}.`}
      </p>
    </section>
  );
}
