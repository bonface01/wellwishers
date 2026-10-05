"use client";

import { useRef, useState } from "react";
import { renderStatusImage, statusImageFilename, type StatusImageInput } from "@/lib/status-image";
import { useHydrated } from "@/lib/use-hydrated";
import { Icon, SheetDialog } from "./ui";

/** "Share update": opens a sheet with the WhatsApp text (copy / open) and the downloadable status image. */
export function ShareSheet({ message, image }: { message: string; image: Omit<StatusImageInput, "fontFamily"> }) {
  const hydrated = useHydrated();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [img, setImg] = useState<"idle" | "working" | "error">("idle");

  function selectMessage() {
    const pre = preRef.current;
    const selection = window.getSelection();
    if (!pre || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(pre);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyMessage() {
    try {
      // Some browsers leave the promise pending when clipboard access is blocked, so don't wait forever.
      await Promise.race([
        navigator.clipboard.writeText(message),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      setCopy("copied");
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      selectMessage();
      setCopy("manual");
    }
  }

  async function downloadImage() {
    setImg("working");
    try {
      const blob = await renderStatusImage({ ...image, fontFamily: getComputedStyle(document.body).fontFamily });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = statusImageFilename(image.groupName, image.week);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setImg("idle");
    } catch {
      setImg("error");
    }
  }

  return (
    <div className="action-cell">
      <button
        type="button"
        className="btn green"
        data-action="share"
        disabled={!hydrated}
        onClick={() => {
          dialogRef.current?.showModal();
          // Start on Copy, not on the (scrollable) message box, which would show a focus ring on open.
          dialogRef.current?.querySelector<HTMLElement>("[data-action=copy]")?.focus({ preventScroll: true });
        }}
      >
        <Icon name="share" size={20} />
        Share update
      </button>

      <SheetDialog dialogRef={dialogRef} title="Share update">
        <div className="sheet-body">
          <pre ref={preRef} className="wa-preview">{message}</pre>
          {copy === "manual" && <p className="msg" role="status">Press and hold to copy</p>}
          {img === "error" && (
            <p className="msg error" role="alert">Could not create the image on this device.</p>
          )}
        </div>
        <div className="share-actions">
          <button type="button" className="btn" data-action="copy" disabled={!hydrated} onClick={copyMessage}>
            {copy === "copied" ? "Copied ✓" : "Copy"}
          </button>
          <a
            className="btn green"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="whatsapp" size={20} />
            Open in WhatsApp
          </a>
          <button
            type="button"
            className="btn wide"
            data-action="download-image"
            disabled={!hydrated || img === "working"}
            onClick={downloadImage}
          >
            <Icon name="download" size={20} />
            {img === "working" ? "Creating image…" : "Download status image"}
          </button>
          <button type="button" className="btn wide ghost" onClick={() => dialogRef.current?.close()}>
            Done
          </button>
        </div>
      </SheetDialog>
    </div>
  );
}
