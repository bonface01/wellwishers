"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addPastWeek, saveWeek, type FormState } from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import {
  buildChecklist,
  diffPaid,
  missingWeeks,
  scheduleForWeek,
  setupProblem,
  validateNewWeek,
  weekTotal,
  type ChecklistRow,
} from "@/lib/week-edit";
import { ConfirmForm } from "./forms";
import { Avatar, Icon, Money } from "./ui";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Common = {
  /** What each member paid that week. */
  amount: number;
  currency: string;
  recipientPays: boolean;
  /** Defaults to the real server action. Overridden only by the offline design preview and tests. */
  action?: Action;
};

export type EditWeekProps = Common & {
  mode: "edit";
  week: number;
  recipientName: string;
  dateLabel: string;
  rows: ChecklistRow[];
  /** The total saved for this week right now. */
  savedTotal: number;
  /** False for weeks saved before per-member payments were kept. */
  tracked: boolean;
};

export type AddWeekProps = Common & {
  mode: "add";
  /** Current members, in payout order. */
  members: { id: number; name: string }[];
  currentRound: number;
  existingRounds: number[];
  /** The Sunday of week 1 (from Settings), or null when it has not been set. */
  cycleStart: string | null;
};

export type WeekEditorProps = EditWeekProps | AddWeekProps;

const longDate = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/**
 * One checklist for correcting a closed week or adding a missing one. Ticking updates the total straight away;
 * nothing is saved until the admin confirms. When adding, the admin only picks the week number: its Sunday and
 * its recipient are worked out from the cycle start date and the payout order.
 */
export function WeekEditor(props: WeekEditorProps) {
  const hydrated = useHydrated();
  const edit = props.mode === "edit";
  const [state, formAction] = useActionState(props.action ?? (edit ? saveWeek : addPastWeek), undefined);
  const [week, setWeek] = useState("");

  // What this form is about: the stored week (edit) or the worked-out week (add).
  const order = props.mode === "add" ? props.members.map((m) => m.name) : [];
  const schedule = props.mode === "add" && week ? scheduleForWeek(Number(week), props.cycleStart, order) : null;
  const issue =
    props.mode === "add" && week
      ? validateNewWeek({
          week: Number(week),
          currentRound: props.currentRound,
          existingRounds: props.existingRounds,
          cycleStart: props.cycleStart,
          order,
        })
      : null;

  const rows: ChecklistRow[] =
    props.mode === "edit"
      ? props.rows
      : buildChecklist({
          members: props.members,
          saved: [],
          recipientName: schedule?.recipient ?? null,
          recipientPays: props.recipientPays,
        });

  const [initial] = useState<Set<string>>(
    () => new Set(props.mode === "edit" ? props.rows.filter((r) => r.paid).map((r) => r.name) : []),
  );
  const [paid, setPaid] = useState<Set<string>>(() => new Set(initial));

  // Only people on this week's checklist count (the recipient drops out when they did not contribute).
  const ticked = rows.filter((r) => paid.has(r.name)).map((r) => r.name);
  const total = weekTotal(ticked.length, props.amount);
  const { added, removed } = diffPaid(initial, new Set(ticked));
  const changed = added.length > 0 || removed.length > 0;

  // Adding needs the cycle start date and members first, and at least one earlier week still missing.
  const setup = props.mode === "add" ? setupProblem(props.cycleStart, props.members.length) : null;
  const available = props.mode === "add" ? missingWeeks(props.currentRound, props.existingRounds) : [];
  if (props.mode === "add" && (setup || available.length === 0)) {
    return (
      <section className="card">
        <p className="note" style={{ marginBottom: setup ? 12 : 0 }}>
          {setup ?? "Every earlier week is already in the history. Open one from the list to correct it."}
        </p>
        {setup && props.members.length > 0 && (
          <Link href="/admin/settings" className="btn green small">
            Open Settings
          </Link>
        )}
      </section>
    );
  }

  const canSave = props.mode === "edit" ? !props.tracked || changed : schedule !== null && issue === null;
  const weekNumber = props.mode === "edit" ? props.week : Number(week) || null;
  const dateLabel = props.mode === "edit" ? props.dateLabel : schedule ? longDate(schedule.date) : "—";
  const recipientName = props.mode === "edit" ? props.recipientName : (schedule?.recipient ?? null);

  function toggle(name: string) {
    setPaid((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // The date and recipient are not sent: the server works them out again from its own copy of the settings.
  const hidden = (
    <>
      {props.mode === "edit" ? (
        <input type="hidden" name="round" value={props.week} />
      ) : (
        <input type="hidden" name="week" value={week} />
      )}
      {ticked.map((name) => (
        <input key={name} type="hidden" name="paid" value={name} />
      ))}
    </>
  );

  return (
    <>
      {props.mode === "add" && (
        <section className="card">
          <div className="stack">
            <label>
              Week number
              <select value={week} onChange={(e) => setWeek(e.target.value)}>
                <option value="">Choose a week…</option>
                {available.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </label>
            {schedule ? (
              <div className="derived">
                <p>
                  <span>Sunday</span>
                  <strong>{longDate(schedule.date)}</strong>
                </p>
                <p>
                  <span>Recipient</span>
                  <strong>{schedule.recipient}</strong>
                </p>
              </div>
            ) : (
              <p className="note">Pick a week and its Sunday and recipient fill in automatically.</p>
            )}
            {issue && (
              <p className="msg error" role="alert">
                {issue}
              </p>
            )}
            {schedule && props.cycleStart && (
              <p className="note">
                Worked out from the cycle start date ({longDate(props.cycleStart)}) and the payout order. Each member paid{" "}
                {formatMoney(props.amount, props.currency)}.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="hero week-summary">
        <p className="hero-label">
          {weekNumber ? `Week ${weekNumber}` : "New week"} · {dateLabel}
        </p>
        <h2 className="hero-name">{recipientName ?? "Pick a week"}</h2>
        <p className="hero-collected">
          <Money value={total} currency={props.currency} />
        </p>
        <p className="hero-expected">
          {ticked.length} of {rows.length} paid
          {props.mode === "edit" && props.savedTotal !== total && ` · was ${formatMoney(props.savedTotal, props.currency)}`}
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Who paid</h3>
          <span className="count">
            {ticked.length} of {rows.length} paid
          </span>
        </div>
        {props.mode === "edit" && !props.tracked && (
          <p className="note" style={{ marginBottom: 10 }}>
            This week was saved before payments were recorded per member. Tick who paid and the total is recalculated.
          </p>
        )}
        {rows.length === 0 ? (
          <p className="muted">Pick a week to see who can be ticked.</p>
        ) : (
          <div className="toggles">
            {rows.map((r, index) => {
              const isPaid = paid.has(r.name);
              return (
                <button
                  key={r.name}
                  type="button"
                  className={`toggle ${isPaid ? "paid" : ""}`}
                  aria-pressed={isPaid}
                  disabled={!hydrated}
                  onClick={() => toggle(r.name)}
                >
                  <Avatar name={r.name} tone={index} />
                  <span className="toggle-body">
                    <span className="toggle-name">
                      {r.name}
                      {r.former && <span className="tag former">Former member</span>}
                    </span>
                    <span className="toggle-state">
                      {isPaid ? `Paid ${formatMoney(props.amount, props.currency)}` : "Did not pay"}
                    </span>
                  </span>
                  <span className="tick" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="save-bar">
        {state?.error && (
          <p className="msg error" role="alert">
            {state.error}
          </p>
        )}
        <ConfirmForm
          action={formAction}
          trigger={edit ? "Save changes" : "Add week"}
          triggerClassName="btn green wide"
          triggerAction="save-week"
          disabled={!canSave}
          title={edit ? `Save changes to week ${weekNumber}?` : `Add week ${weekNumber ?? ""}?`}
          confirmLabel={edit ? "Save changes" : "Add week"}
          hidden={hidden}
        >
          <div className="sheet-lines">
            {props.mode === "add" && (
              <>
                <p>
                  <span>Sunday</span>
                  <strong>{dateLabel}</strong>
                </p>
                <p>
                  <span>Recipient</span>
                  <strong>{recipientName}</strong>
                </p>
              </>
            )}
            <p>
              <span>Paid</span>
              <strong>
                {ticked.length} of {rows.length}
              </strong>
            </p>
            <p>
              <span>Total</span>
              <strong>
                {props.mode === "edit" && props.savedTotal !== total
                  ? `${formatMoney(props.savedTotal, props.currency)} → ${formatMoney(total, props.currency)}`
                  : formatMoney(total, props.currency)}
              </strong>
            </p>
          </div>
          {(added.length > 0 || removed.length > 0) && props.mode === "edit" && (
            <ul className="change-list">
              {added.map((n) => (
                <li key={`a-${n}`}>
                  <span className="sign plus">+</span>
                  <span>{n} marked as paid</span>
                </li>
              ))}
              {removed.map((n) => (
                <li key={`r-${n}`}>
                  <span className="sign minus">−</span>
                  <span>{n} marked as not paid</span>
                </li>
              ))}
            </ul>
          )}
          {props.mode === "edit" && !props.tracked && (
            <p className="note">The total is recalculated from the ticks, so it replaces the one saved before.</p>
          )}
        </ConfirmForm>
      </div>
    </>
  );
}
