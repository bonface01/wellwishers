"use client";

import {
  useActionState,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  addMember,
  closeRound,
  login,
  removeMember,
  saveSettings,
  setReceived,
  startNewCycle,
  type FormState,
} from "@/app/actions";
import { useHydrated } from "@/lib/use-hydrated";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="msg error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="msg ok">Saved.</p>;
  return null;
}

/**
 * A form whose submit is guarded by an in-page confirmation sheet (native <dialog>),
 * replacing window.confirm(). Large buttons, bottom sheet on phones.
 */
function ConfirmForm(props: {
  action: (formData: FormData) => void | Promise<void>;
  trigger: ReactNode;
  triggerClassName: string;
  triggerLabel?: string;
  title: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  hidden?: ReactNode;
  children: ReactNode;
}) {
  const hydrated = useHydrated();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();
  return (
    <form action={props.action}>
      {props.hidden}
      <button
        type="button"
        className={props.triggerClassName}
        aria-label={props.triggerLabel}
        disabled={!hydrated || props.disabled}
        onClick={() => dialogRef.current?.showModal()}
      >
        {props.trigger}
      </button>
      <dialog
        ref={dialogRef}
        className="sheet"
        aria-label={props.title}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) dismisses it.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="sheet-inner">
          <h3>{props.title}</h3>
          <div className="sheet-body">{props.children}</div>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={close}>Cancel</button>
            <button type="submit" className={`btn ${props.danger ? "danger-solid" : "primary"}`} onClick={close}>
              {props.confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}

export function LoginForm() {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      <Msg state={state} />
      <button className="btn primary" disabled={pending || !hydrated}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SettingsForm(props: {
  name: string;
  amount: number;
  currency: string;
  recipientPays: boolean;
  currentRound: number;
}) {
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="stack">
      <label>
        Group name
        <input name="name" defaultValue={props.name} required />
      </label>
      <div className="row">
        <label className="currency">
          Currency
          <input name="currency" defaultValue={props.currency} placeholder="e.g. KSh" />
        </label>
        <label className="grow">
          Contribution amount
          <input name="amount" type="number" inputMode="decimal" min="0" step="any" defaultValue={props.amount} required />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="recipientPays" defaultChecked={props.recipientPays} />
        <span>Recipient also contributes that round</span>
      </label>
      <label>
        Current round number
        <input name="currentRound" type="number" inputMode="numeric" min="1" step="1" defaultValue={props.currentRound} required />
        <small className="muted">
          Joining a group that is already running? Set the round you are on. Changing this clears the
          payment checklist. Then mark who has already received on the Members tab.
        </small>
      </label>
      <Msg state={state} />
      <button className="btn primary" disabled={pending || !hydrated}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function AddMemberForm() {
  const hydrated = useHydrated();
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
      <button className="btn primary" disabled={pending || !hydrated}>{pending ? "Adding…" : "Add member"}</button>
    </form>
  );
}

export function RemoveMemberButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmForm
      action={removeMember}
      trigger="Remove"
      triggerClassName="btn danger small"
      triggerLabel={`Remove ${name}`}
      title={`Remove ${name}?`}
      confirmLabel="Remove"
      danger
      hidden={<input type="hidden" name="id" value={id} />}
    >
      <p>
        {name} will be taken out of the payout order and their payment for this round will be cleared. Past
        history is kept.
      </p>
    </ConfirmForm>
  );
}

export function ReceivedToggle({ memberId, name, received }: { memberId: number; name: string; received: boolean }) {
  const hydrated = useHydrated();
  const [optimistic, setOptimistic] = useOptimistic(received);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const [, startTransition] = useTransition();
  return (
    <div className="received">
      <button
        type="button"
        className={`btn small ${optimistic ? "is-on" : ""}`}
        aria-pressed={optimistic}
        aria-label={`${name}: ${optimistic ? "already received this cycle" : "not received yet"}`}
        disabled={!hydrated}
        onClick={() => {
          if (busy.current) return; // ignore taps while this member's save is in progress
          busy.current = true;
          startTransition(async () => {
            setError(undefined);
            setOptimistic(!optimistic);
            try {
              const result = await setReceived(memberId, !optimistic);
              if (result?.error) setError(result.error);
            } catch {
              setError("Could not save. Please try again.");
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {optimistic ? "✓ Received" : "Not received"}
      </button>
      {error && <p className="msg error" role="alert">{error}</p>}
    </div>
  );
}

export function CloseRoundForm(props: { round: number; recipient: string; unpaid: string[]; disabled?: boolean }) {
  return (
    <ConfirmForm
      action={closeRound}
      trigger="Close round and pay out"
      triggerClassName="btn primary big"
      disabled={props.disabled}
      title={`Close round ${props.round}?`}
      confirmLabel="Close and pay out"
      hidden={<input type="hidden" name="round" value={props.round} />}
    >
      <p>
        This records the round in history and pays out to <strong>{props.recipient}</strong>.
      </p>
      {props.unpaid.length > 0 && (
        <div className="warn" role="alert">
          <strong>{props.unpaid.length} member(s) have not paid:</strong>
          <ul>
            {props.unpaid.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </ConfirmForm>
  );
}

export function NewCycleButton() {
  return (
    <ConfirmForm
      action={startNewCycle}
      trigger="Start new cycle"
      triggerClassName="btn"
      title="Start a new cycle?"
      confirmLabel="Start new cycle"
    >
      <p>Everyone will be marked as not yet received. Members and history are kept.</p>
    </ConfirmForm>
  );
}

export function WhatsAppShare({ message }: { message: string }) {
  const hydrated = useHydrated();
  const preRef = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  function selectMessage() {
    const pre = preRef.current;
    const selection = window.getSelection();
    if (!pre || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(pre);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    try {
      // Some browsers leave the promise pending when clipboard access is blocked, so don't wait forever.
      await Promise.race([
        navigator.clipboard.writeText(message),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      selectMessage();
      setStatus("manual");
    }
  }

  return (
    <div className="stack">
      <pre ref={preRef} className="wa-preview">{message}</pre>
      {status === "manual" && <p className="msg" role="status">Press and hold to copy</p>}
      <div className="row">
        <button type="button" className="btn grow" disabled={!hydrated} onClick={copy}>{status === "copied" ? "Copied ✓" : "Copy"}</button>
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
