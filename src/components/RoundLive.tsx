"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { setPaid } from "@/app/actions";
import { summarizeRound, type Payer } from "@/lib/round";
import { useHydrated } from "@/lib/use-hydrated";
import { buildWhatsAppMessage } from "@/lib/whatsapp";
import { CloseRoundForm, WhatsAppShare } from "./forms";
import { PotCardView } from "./PotCard";

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
};

type PaidUpdate = { id: number; paid: boolean };

/**
 * The part of the Round tab that depends on who has paid. All of it (toggle, total, progress bar,
 * paid count, WhatsApp text, close-round warning) is derived from one optimistic set of paid ids, so it
 * updates in the same instant a toggle is tapped and rolls back together if the save fails.
 */
export function RoundLive(props: LiveRoundProps) {
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

  const s = summarizeRound(props.payers, paidIds, props.amount);
  const message = buildWhatsAppMessage({
    groupName: props.groupName,
    round: props.round,
    amount: props.amount,
    currency: props.currency,
    recipientName: props.recipientName,
    nextName: props.nextName,
    paid: s.paid.map((p) => p.name),
    unpaid: s.unpaid.map((p) => p.name),
  });

  function toggle(p: Payer) {
    if (!hydrated || inFlight.current.has(p.id)) return;
    const next = !paidIds.has(p.id);
    inFlight.current.add(p.id);
    setSaving([...inFlight.current]);
    setError(undefined);

    startTransition(async () => {
      applyPaid({ id: p.id, paid: next });
      try {
        const result = await setPaid(p.id, next);
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
      <PotCardView
        round={props.round}
        recipientName={props.recipientName}
        nextName={props.nextName}
        nextIsNewCycle={props.nextIsNewCycle}
        collected={s.collected}
        expected={s.expected}
        currency={props.currency}
      />

      <section className="card">
        <h3>
          Payments{" "}
          <span className="muted count">
            {s.paid.length} of {props.payers.length} paid
          </span>
        </h3>
        {props.notice}
        {error && <p className="msg error" role="alert">{error}</p>}
        {props.payers.length === 0 ? (
          <p className="muted">Nobody needs to pay this round.</p>
        ) : (
          <div className="toggles">
            {props.payers.map((p) => {
              const isPaid = paidIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`toggle ${isPaid ? "paid" : ""}`}
                  aria-pressed={isPaid}
                  aria-busy={saving.includes(p.id)}
                  disabled={!hydrated}
                  onClick={() => toggle(p)}
                >
                  <span className="toggle-name">{p.name}</span>
                  <span className="toggle-state">{isPaid ? "✓ Paid" : "Not paid"}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Close this round</h3>
        <CloseRoundForm
          round={props.round}
          recipient={props.recipientName}
          unpaid={s.unpaid.map((p) => p.name)}
          disabled={saving.length > 0}
        />
      </section>

      <section className="card">
        <h3>WhatsApp update</h3>
        <WhatsAppShare message={message} />
      </section>
    </>
  );
}
