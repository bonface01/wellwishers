// @vitest-environment jsdom
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setPaid } = vi.hoisted(() => ({ setPaid: vi.fn() }));
vi.mock("@/app/actions", () => ({
  setPaid,
  closeRound: vi.fn(),
  startNewCycle: vi.fn(),
  addMember: vi.fn(),
  login: vi.fn(),
  removeMember: vi.fn(),
  saveSettings: vi.fn(),
  setReceived: vi.fn(),
}));

import { RoundLive, type LiveRoundProps } from "./RoundLive";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const props: LiveRoundProps = {
  groupName: "Test Group",
  round: 3,
  amount: 100,
  currency: "KSh",
  recipientName: "Agnes Wanjira",
  nextName: "Boniface Mutinda",
  nextIsNewCycle: false,
  payers: [
    { id: 1, name: "Agnes Wanjira", paid: false },
    { id: 2, name: "Boniface Mutinda", paid: false },
    { id: 3, name: "Brian Mutinda", paid: false },
  ],
};

let container: HTMLDivElement;
let root: Root | undefined;

const toggles = () => [...container.querySelectorAll<HTMLButtonElement>(".toggle")];
const q = (sel: string) => container.querySelector(sel)!;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const tap = (el: HTMLElement) => act(async () => { el.click(); });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(<RoundLive {...props} />); });
}

beforeEach(() => {
  setPaid.mockReset();
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  container.remove();
});

describe("RoundLive optimistic updates", () => {
  it("updates the toggle, total, paid count, progress bar and message the instant a toggle is tapped", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise); // server has not answered yet
    await mount();

    expect(q(".pot-collected").textContent).toContain("KSh 0");

    await tap(toggles()[0]);

    expect(setPaid).toHaveBeenCalledWith(1, true);
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("true");
    expect(toggles()[0].textContent).toContain("Paid");
    expect(q(".pot-collected").textContent).toContain("KSh 100");
    expect(q(".pot-collected").textContent).toContain("of KSh 300");
    expect(q(".bar").getAttribute("aria-valuenow")).toBe("33");
    expect(q(".count").textContent).toContain("1 of 3 paid");
    expect(q(".wa-preview").textContent).toContain("✅ Paid (1)");
    expect(q(".wa-preview").textContent).toContain("Collected: KSh 100 of KSh 300");

    save.resolve({ ok: true });
    await flush();
  });

  it("rolls everything back and shows a clear error when the server reports a failure", async () => {
    setPaid.mockResolvedValue({ error: "The server could not save it." });
    await mount();

    await tap(toggles()[0]);
    await flush();

    expect(q("[role=alert]").textContent).toContain("Could not save Agnes Wanjira's payment");
    expect(q("[role=alert]").textContent).toContain("put back");
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("false");
    expect(q(".pot-collected").textContent).toContain("KSh 0");
    expect(q(".bar").getAttribute("aria-valuenow")).toBe("0");
    expect(q(".count").textContent).toContain("0 of 3 paid");
    expect(q(".wa-preview").textContent).not.toContain("✅ Paid");
  });

  it("rolls back and explains when the request itself fails (network error)", async () => {
    setPaid.mockRejectedValue(new Error("network down"));
    await mount();

    await tap(toggles()[1]);
    await flush();

    expect(q("[role=alert]").textContent).toContain("Could not save Boniface Mutinda's payment");
    expect(q("[role=alert]").textContent).toContain("connection");
    expect(toggles()[1].getAttribute("aria-pressed")).toBe("false");
    expect(q(".pot-collected").textContent).toContain("KSh 0");
  });

  it("clears an old error when the next tap starts", async () => {
    setPaid.mockResolvedValueOnce({ error: "The server could not save it." });
    await mount();
    await tap(toggles()[0]);
    await flush();
    expect(container.querySelector(".msg.error")).not.toBeNull();

    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await tap(toggles()[0]);
    expect(container.querySelector(".msg.error")).toBeNull();
    save.resolve({ ok: true });
    await flush();
  });
});

describe("RoundLive double taps", () => {
  it("ignores further taps on a member while that member's save is in progress", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();

    await act(async () => {
      toggles()[0].click();
      toggles()[0].click(); // quick double tap in the same tick
    });
    await tap(toggles()[0]); // and a third, later, while still saving

    expect(setPaid).toHaveBeenCalledTimes(1);
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("true"); // not flipped back
    expect(toggles()[0].getAttribute("aria-busy")).toBe("true");

    save.resolve({ ok: true });
    await flush();
    expect(toggles()[0].getAttribute("aria-busy")).toBe("false");
  });

  it("still lets other members be tapped while one save is in progress", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();

    await tap(toggles()[0]);
    await tap(toggles()[1]);

    expect(setPaid).toHaveBeenCalledTimes(2);
    expect(setPaid).toHaveBeenNthCalledWith(1, 1, true);
    expect(setPaid).toHaveBeenNthCalledWith(2, 2, true);
    expect(q(".pot-collected").textContent).toContain("KSh 200");

    save.resolve({ ok: true });
    await flush();
  });

  it("accepts a new tap on the same member once the save has finished", async () => {
    setPaid.mockResolvedValue({ ok: true });
    await mount();

    await tap(toggles()[0]);
    await flush();
    await tap(toggles()[0]);
    await flush();

    expect(setPaid).toHaveBeenCalledTimes(2);
  });

  it("disables Close round while any save is in flight", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();

    const closeButton = () => q("button.big") as HTMLButtonElement;
    expect(closeButton().disabled).toBe(false);

    await tap(toggles()[0]);
    expect(closeButton().disabled).toBe(true);

    save.resolve({ ok: true });
    await flush();
    expect(closeButton().disabled).toBe(false);
  });

  it("lists the live unpaid members in the close-round confirmation", async () => {
    setPaid.mockReturnValue(new Promise(() => {}));
    await mount();
    await tap(toggles()[1]);

    const dialogText = q("dialog").textContent ?? "";
    expect(dialogText).toContain("2 member(s) have not paid");
    expect(dialogText).toContain("Agnes Wanjira");
    expect(dialogText).toContain("Brian Mutinda");
    expect(dialogText).not.toContain("Boniface Mutinda have not");
  });
});

describe("RoundLive before the page is ready", () => {
  it("server-renders toggles and buttons as disabled, then enables them once hydrated", async () => {
    setPaid.mockResolvedValue({ ok: true });
    container.innerHTML = renderToString(<RoundLive {...props} />);

    // Buttons on the page itself: toggles, Close round, Copy. (The dialog's own buttons only appear after
    // the Close round button is used.)
    const interactive = () => [...container.querySelectorAll<HTMLButtonElement>(".toggle, button.big, button.grow")];
    expect(toggles()).toHaveLength(3);
    expect(interactive()).toHaveLength(5);
    expect(interactive().every((b) => b.disabled)).toBe(true);

    // A tap before hydration does nothing.
    toggles()[0].click();
    expect(setPaid).not.toHaveBeenCalled();

    await act(async () => {
      root = hydrateRoot(container, <RoundLive {...props} />);
    });
    await flush();

    expect(interactive().every((b) => !b.disabled)).toBe(true);

    await tap(toggles()[0]);
    expect(setPaid).toHaveBeenCalledTimes(1);
  });
});
