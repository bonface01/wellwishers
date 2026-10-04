"use client";

import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import {
  addMember,
  closeRound,
  login,
  removeMember,
  saveSettings,
  setPaid,
  startNewCycle,
  type FormState,
} from "@/app/actions";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="msg error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="msg ok">Saved.</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      <Msg state={state} />
      <button className="btn primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SettingsForm(props: {
  name: string;
  amount: number;
  currency: string;
  recipientPays: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Group name
        <input name="name" defaultValue={props.name} required />
      </label>
      <div className="row">
        <label className="grow">
          Contribution amount
          <input name="amount" type="number" inputMode="decimal" min="0" step="any" defaultValue={props.amount} required />
        </label>
        <label className="currency">
          Currency
          <input name="currency" defaultValue={props.currency} placeholder="e.g. QAR" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="recipientPays" defaultChecked={props.recipientPays} />
        <span>Recipient also contributes that round</span>
      </label>
      <Msg state={state} />
      <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function AddMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await addMember(prev, fd);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, undefined);
  return (
    <form ref={formRef} action={action} className="stack">
      <div className="row">
        <label className="grow">
          First name
          <input name="firstName" autoCapitalize="words" required />
        </label>
        <label className="grow">
          Second name
          <input name="secondName" autoCapitalize="words" required />
        </label>
      </div>
      {state?.error && <Msg state={state} />}
      <button className="btn primary" disabled={pending}>{pending ? "Adding…" : "Add member"}</button>
    </form>
  );
}

export function RemoveMemberButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={removeMember}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name} from the group? Their payment for this round will be cleared.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn danger small" aria-label={`Remove ${name}`}>Remove</button>
    </form>
  );
}

export function PaymentToggle({ memberId, name, paid }: { memberId: number; name: string; paid: boolean }) {
  const [optimisticPaid, setOptimisticPaid] = useOptimistic(paid);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={`toggle ${optimisticPaid ? "paid" : ""}`}
      aria-pressed={optimisticPaid}
      onClick={() =>
        startTransition(async () => {
          setOptimisticPaid(!optimisticPaid);
          await setPaid(memberId, !optimisticPaid);
        })
      }
    >
      <span className="toggle-name">{name}</span>
      <span className="toggle-state">{optimisticPaid ? "✓ Paid" : "Not paid"}</span>
    </button>
  );
}

export function CloseRoundForm(props: { round: number; recipient: string; unpaid: string[] }) {
  return (
    <form
      action={closeRound}
      onSubmit={(e) => {
        const warning = props.unpaid.length
          ? `\n\nWarning: ${props.unpaid.length} member(s) have not paid:\n${props.unpaid.map((n) => `• ${n}`).join("\n")}`
          : "";
        if (!confirm(`Close round ${props.round} and pay out to ${props.recipient}?${warning}`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="round" value={props.round} />
      <button className="btn primary big">Close round and pay out</button>
    </form>
  );
}

export function NewCycleButton() {
  return (
    <form
      action={startNewCycle}
      onSubmit={(e) => {
        if (!confirm("Start a new cycle? Everyone will be marked as not yet received. Members and history are kept.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="btn">Start new cycle</button>
    </form>
  );
}

export function WhatsAppShare({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Could not copy. Select the text and copy it manually.");
    }
  }
  return (
    <div className="stack">
      <pre className="wa-preview">{message}</pre>
      <div className="row">
        <button type="button" className="btn grow" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
        <a
          className="btn primary grow"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in WhatsApp
        </a>
      </div>
    </div>
  );
}
