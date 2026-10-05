"use client";

import { useActionState, useState } from "react";
import { addPastWeek, saveWeek, type FormState } from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import {
  buildChecklist,
  diffPaid,
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
  members: { id: number; name: string }[];
  currentRound: number;
  existingRounds: number[];
};

export type WeekEditorProps = EditWeekProps | AddWeekProps;

/**
 * One checklist for correcting a closed week or adding a missing one. Ticking updates the total straight away;
 * nothing is saved until the admin confirms.
 */
export function WeekEditor(props: WeekEditorProps) {
  const hydrated = useHydrated();
  const edit = props.mode === "edit";
  const [state, formAction] = useActionState(props.action ?? (edit ? saveWeek : addPastWeek), undefined);

  // Fields used when adding a week.
  const [week, setWeek] = useState("");
  const [date, setDate] = useState("");
  const [recipient, setRecipient] = useState("");

  const rows: ChecklistRow[] =
    props.mode === "edit"
      ? props.rows
      : buildChecklist({
          members: props.members,
          saved: [],
          recipientName: recipient || null,
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

  const touched = Boolean(week || date || recipient);
  const issue =
    props.mode === "add" && touched
      ? validateNewWeek({
          week: Number(week),
          date,
          recipientName: recipient || null,
          currentRound: props.currentRound,
          existingRounds: props.existingRounds,
        })
      : null;
  const incomplete = props.mode === "add" && (!week || !date || !recipient);

  const canSave = props.mode === "edit" ? !props.tracked || changed : !incomplete && issue === null;
  const weekNumber = props.mode === "edit" ? props.week : Number(week) || null;
  const dateLabel =
    props.mode === "edit"
      ? props.dateLabel
      : date && !issue?.includes("date") && !issue?.includes("Sunday")
        ? formatDate(new Date(`${date}T12:00:00Z`))
        : date
          ? date
          : "—";

  function toggle(name: string) {
    setPaid((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const hidden = (
    <>
      {props.mode === "edit" ? (
        <input type="hidden" name="round" value={props.week} />
      ) : (
        <>
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="recipient" value={recipient} />
        </>
      )}
      {ticked.map((name) => (
        <input key={name} type="hidden" name="paid" value={name} />
      ))}
    </>
  );

  const heroName = props.mode === "edit" ? props.recipientName : recipient || "Choose a recipient";

  return (
    <>
      {props.mode === "add" && (
        <section className="card">
          <div className="stack">
            <div className="field-grid">
              <label>
                Week number
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, props.currentRound - 1)}
                  step={1}
                  placeholder={`1 to ${Math.max(1, props.currentRound - 1)}`}
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </label>
              <label>
                Sunday date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="full">
                Who received that week&apos;s pot
                <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
                  <option value="">Choose a member…</option>
                  {props.members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {issue && (
              <p className="msg error" role="alert">
                {issue}
              </p>
            )}
            <p className="note">Only weeks before week {props.currentRound} can be added. Each member paid {formatMoney(props.amount, props.currency)}.</p>
          </div>
        </section>
      )}

      <section className="hero week-summary">
        <p className="hero-label">
          {weekNumber ? `Week ${weekNumber}` : "New week"} · {dateLabel}
        </p>
        <h2 className="hero-name">{heroName}</h2>
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
          <p className="muted">Choose a recipient to see who can be ticked.</p>
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
                  <strong>{recipient}</strong>
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
