"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { setPaid, type FormState } from "@/app/actions";
import { makeConfetti, type Particle } from "@/lib/confetti";
import { formatMoney } from "@/lib/format";
import { buzz, prefersReducedMotion } from "@/lib/motion";
import { summarizeRound, type Payer } from "@/lib/round";
import { useHydrated } from "@/lib/use-hydrated";
import { buildWhatsAppMessage } from "@/lib/whatsapp";
import { CloseRoundForm } from "./forms";
import { Hero, RoundHeader, isComplete } from "./Hero";
import { ShareSheet } from "./ShareSheet";
import { Avatar, Icon } from "./ui";

export type LiveRoundProps = {
  groupName: string;
  round: number;
  amount: number;
  currency: string;
  recipientName: string;
  nextName: string | null;
  nextIsNewCycle: boolean;
  payers: (Payer & { paid: boolean })[];
  /** Rendered at the top of the Payments card (e.g. a "set the amount" notice). */
  notice?: ReactNode;
  /** This week has already been closed (it is in the history). */
  closed?: boolean;
  /** Defaults to the real server actions. Overridden only by the offline design preview. */
  actions?: {
    setPaid: (memberId: number, paid: boolean) => Promise<FormState>;
    closeRound: (formData: FormData) => void | Promise<void>;
  };
};

type PaidUpdate = { id: number; paid: boolean };

const TOAST_MS = 7000;

/**
 * The part of the Round tab that depends on who has paid. All of it (rows, hero ring and total, paid count,
 * banner, WhatsApp text, status image, close-week warning) is derived from one optimistic set of paid ids,
 * so it updates in the same instant a row is tapped and rolls back together if the save fails.
 */
export function RoundLive(props: LiveRoundProps) {
  const save = props.actions?.setPaid ?? setPaid;
  const hydrated = useHydrated();
  const serverPaid = useMemo(
    () => new Set(props.payers.filter((p) => p.paid).map((p) => p.id)),
    [props.payers],
  );
  const [paidIds, applyPaid] = useOptimistic(serverPaid, (current: Set<number>, u: PaidUpdate) => {
    const next = new Set(current);
    if (u.paid) next.add(u.id);
    else next.delete(u.id);
    return next;
  });

  // Members whose save is in flight. A ref gives a synchronous check so a fast double tap can't slip through.
  const inFlight = useRef(new Set<number>());
  const [saving, setSaving] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(undefined), TOAST_MS);
    return () => clearTimeout(id);
  }, [error]);

  const s = summarizeRound(props.payers, paidIds, props.amount);
  const complete = isComplete(s.paid.length, props.payers.length);

  // Row that was just marked paid (drives the light sweep) and the one-off pot-complete celebration.
  const [swept, setSwept] = useState<number | null>(null);
  const [burst, setBurst] = useState<Particle[] | null>(null);
  const wasComplete = useRef(complete);

  useEffect(() => {
    if (swept === null) return;
    const id = setTimeout(() => setSwept(null), 900);
    return () => clearTimeout(id);
  }, [swept]);

  useEffect(() => {
    // Only when the pot *becomes* complete, never just because the page loaded that way.
    if (complete && !wasComplete.current && !prefersReducedMotion()) setBurst(makeConfetti());
    wasComplete.current = complete;
  }, [complete]);

  useEffect(() => {
    if (!burst) return;
    const id = setTimeout(() => setBurst(null), 2200);
    return () => clearTimeout(id);
  }, [burst]);
  const paidNames = s.paid.map((p) => p.name);
  const unpaidNames = s.unpaid.map((p) => p.name);
  const message = buildWhatsAppMessage({
    groupName: props.groupName,
    round: props.round,
    amount: props.amount,
    currency: props.currency,
    recipientName: props.recipientName,
    nextName: props.nextName,
    paid: paidNames,
    unpaid: unpaidNames,
  });

  function toggle(p: Payer) {
    if (!hydrated || inFlight.current.has(p.id)) return;
    const next = !paidIds.has(p.id);
    inFlight.current.add(p.id);
    setSaving([...inFlight.current]);
    setError(undefined);
    buzz(10);
    if (next) setSwept(p.id);

    startTransition(async () => {
      applyPaid({ id: p.id, paid: next });
      try {
        const result = await save(p.id, next);
        // On failure nothing is refreshed from the server, so the optimistic value drops back
        // to the saved one when this transition ends.
        if (result?.error) setError(`Could not save ${p.name}'s payment, so it was put back. ${result.error}`);
      } catch {
        setError(`Could not save ${p.name}'s payment, so it was put back. Check your connection and try again.`);
      } finally {
        inFlight.current.delete(p.id);
        setSaving([...inFlight.current]);
      }
    });
  }

  return (
    <>
      <RoundHeader groupName={props.groupName} round={props.round} />

      <Hero
        recipientName={props.recipientName}
        collected={s.collected}
        expected={s.expected}
        currency={props.currency}
        paidCount={s.paid.length}
        totalCount={props.payers.length}
        nextName={props.nextName}
        nextIsNewCycle={props.nextIsNewCycle}
        celebrate={burst !== null}
        confetti={burst}
      />

      {complete && (
        <div className="banner" role="status">
          <span className="banner-icon">
            <Icon name="check" size={18} />
          </span>
          <span>
            Pot complete. Ready to send to <strong>{props.recipientName}</strong>.
          </span>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Payments</h3>
          <span className="count">
            {s.paid.length} of {props.payers.length} paid
          </span>
        </div>
        {props.notice}
        {props.payers.length === 0 ? (
          <p className="muted">Nobody needs to pay this week.</p>
        ) : (
          <div className="toggles">
            {props.payers.map((p, index) => {
              const isPaid = paidIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`toggle ${isPaid ? "paid" : ""} ${swept === p.id && isPaid ? "swept" : ""}`}
                  style={{ "--i": index + 4 } as CSSProperties}
                  aria-pressed={isPaid}
                  aria-busy={saving.includes(p.id)}
                  disabled={!hydrated}
                  onClick={() => toggle(p)}
                >
                  <Avatar name={p.name} tone={index} />
                  <span className="toggle-body">
                    <span className="toggle-name">{p.name}</span>
                    <span className="toggle-state">
                      {isPaid ? `Paid ${formatMoney(props.amount, props.currency)}` : "Not paid yet"}
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

      <div className="action-row">
        <ShareSheet
          message={message}
          image={{
            groupName: props.groupName,
            week: props.round,
            recipientName: props.recipientName,
            collected: s.collected,
            expected: s.expected,
            currency: props.currency,
            paidCount: s.paid.length,
            totalCount: props.payers.length,
            nextName: props.nextName,
            unpaid: unpaidNames,
          }}
        />
        <CloseRoundForm
          round={props.round}
          recipient={props.recipientName}
          unpaid={unpaidNames}
          disabled={saving.length > 0}
          closed={props.closed}
          action={props.actions?.closeRound}
        />
      </div>
      {props.closed && (
        <p className="note" style={{ textAlign: "center" }}>
          This week is closed and its payments are saved in History. You can still correct them there.
        </p>
      )}

      {error && (
        <button type="button" className="toast" role="alert" onClick={() => setError(undefined)}>
          {error}
        </button>
      )}
    </>
  );
}
