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
const collected = () => (q(".hero-collected .num") as HTMLElement).dataset.value;
const ringNow = () => q("[role=progressbar]").getAttribute("aria-valuenow");
const closeDialog = () => q('dialog[aria-label^="Close week"]');
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const tap = (el: HTMLElement) => act(async () => { el.click(); });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function mount(p: LiveRoundProps = props) {
  root = createRoot(container);
  await act(async () => { root!.render(<RoundLive {...p} />); });
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

describe("RoundLive layout", () => {
  it("shows the week, the recipient, the amount and each member's status line", async () => {
    await mount();
    expect(q(".round-head h1").textContent).toBe("Week 3");
    expect(q(".hero-name").textContent).toBe("Agnes Wanjira");
    expect(q(".hero-expected").textContent).toBe("of KSh 300 expected");
    expect(q(".hero-next").textContent).toContain("Next week: Boniface Mutinda");
    expect(q(".ring-label").textContent).toContain("0/3");
    expect(toggles()).toHaveLength(3);
    expect(toggles()[0].textContent).toContain("Not paid yet");
    expect(toggles()[0].querySelector(".avatar")?.textContent).toBe("AW");
    expect(container.querySelector(".banner")).toBeNull();
  });
});

describe("RoundLive optimistic updates", () => {
  it("updates the row, hero total, ring, paid count and message the instant a row is tapped", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise); // server has not answered yet
    await mount();

    expect(collected()).toBe("0");

    await tap(toggles()[0]);

    expect(setPaid).toHaveBeenCalledWith(1, true);
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("true");
    expect(toggles()[0].textContent).toContain("Paid KSh 100");
    expect(collected()).toBe("100");
    expect(q(".hero-expected").textContent).toContain("KSh 300");
    expect(ringNow()).toBe("33");
    expect(q(".ring-label").textContent).toContain("1/3");
    expect(q(".count").textContent).toContain("1 of 3 paid");

    // The share sheet's message is live too.
    expect(q(".wa-preview").textContent).toContain("✅ Paid (1)");
    expect(q(".wa-preview").textContent).toContain("Collected: KSh 100 of KSh 300");

    save.resolve({ ok: true });
    await flush();
  });

  it("rolls everything back and shows a clear toast when the server reports a failure", async () => {
    setPaid.mockResolvedValue({ error: "The server could not save it." });
    await mount();

    await tap(toggles()[0]);
    await flush();

    expect(q(".toast").textContent).toContain("Could not save Agnes Wanjira's payment");
    expect(q(".toast").textContent).toContain("put back");
    expect(q(".toast").getAttribute("role")).toBe("alert");
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("false");
    expect(collected()).toBe("0");
    expect(ringNow()).toBe("0");
    expect(q(".count").textContent).toContain("0 of 3 paid");
    expect(q(".wa-preview").textContent).not.toContain("✅ Paid");
  });

  it("rolls back and explains when the request itself fails (network error)", async () => {
    setPaid.mockRejectedValue(new Error("network down"));
    await mount();

    await tap(toggles()[1]);
    await flush();

    expect(q(".toast").textContent).toContain("Could not save Boniface Mutinda's payment");
    expect(q(".toast").textContent).toContain("connection");
    expect(toggles()[1].getAttribute("aria-pressed")).toBe("false");
    expect(collected()).toBe("0");
  });

  it("dismisses the toast when tapped and clears it when the next tap starts", async () => {
    setPaid.mockResolvedValueOnce({ error: "The server could not save it." });
    await mount();
    await tap(toggles()[0]);
    await flush();
    expect(container.querySelector(".toast")).not.toBeNull();

    await tap(q(".toast") as HTMLElement);
    expect(container.querySelector(".toast")).toBeNull();

    setPaid.mockResolvedValueOnce({ error: "again" });
    await tap(toggles()[0]);
    await flush();
    expect(container.querySelector(".toast")).not.toBeNull();

    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await tap(toggles()[0]);
    expect(container.querySelector(".toast")).toBeNull();
    save.resolve({ ok: true });
    await flush();
  });
});

describe("RoundLive pot complete", () => {
  const allButOne = {
    ...props,
    payers: [
      { id: 1, name: "Agnes Wanjira", paid: true },
      { id: 2, name: "Boniface Mutinda", paid: true },
      { id: 3, name: "Brian Mutinda", paid: false },
    ],
  };

  it("turns the ring amber and slides in the banner when the last member is marked paid", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount(allButOne);
    expect(container.querySelector(".banner")).toBeNull();
    expect(q(".ring").classList.contains("complete")).toBe(false);

    await tap(toggles()[2]);

    expect(q(".ring").classList.contains("complete")).toBe(true);
    expect(q(".hero").classList.contains("is-complete")).toBe(true);
    expect(q(".banner").textContent).toBe("Pot complete. Ready to send to Agnes Wanjira.");
    expect(q(".banner").getAttribute("role")).toBe("status");
    expect(q(".wa-preview").textContent).toContain("🎉 Everyone has paid!");

    // Finish the save so no pending action leaks into the next test.
    save.resolve({ ok: true });
    await flush();
  });

  it("takes the banner away again if the save fails and the tap is rolled back", async () => {
    setPaid.mockResolvedValue({ error: "nope" });
    await mount(allButOne);
    await tap(toggles()[2]);
    await flush();
    expect(container.querySelector(".banner")).toBeNull();
    expect(q(".ring").classList.contains("complete")).toBe(false);
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
    expect(collected()).toBe("200");

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

  it("disables Close week while any save is in flight", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();

    const closeButton = () => q("[data-action=close-week]") as HTMLButtonElement;
    expect(closeButton().disabled).toBe(false);

    await tap(toggles()[0]);
    expect(closeButton().disabled).toBe(true);

    save.resolve({ ok: true });
    await flush();
    expect(closeButton().disabled).toBe(false);
  });

  it("lists the live unpaid members in the close-week confirmation", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();
    await tap(toggles()[1]);

    const dialogText = closeDialog().textContent ?? "";
    expect(dialogText).toContain("2 member(s) have not paid");
    expect(dialogText).toContain("Agnes Wanjira");
    expect(dialogText).toContain("Brian Mutinda");
    expect(dialogText).not.toContain("Boniface Mutinda have not");

    save.resolve({ ok: true });
    await flush();
  });
});

/** Pretend to be a browser with motion enabled (or reduced). jsdom has no matchMedia, which counts as "reduced". */
function stubMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reduced : false, media: query }),
  });
}

describe("RoundLive celebration and row sweep", () => {
  const allButOne = {
    ...props,
    payers: [
      { id: 1, name: "Agnes Wanjira", paid: true },
      { id: 2, name: "Boniface Mutinda", paid: true },
      { id: 3, name: "Brian Mutinda", paid: false },
    ],
  };
  const allPaid = { ...props, payers: props.payers.map((p) => ({ ...p, paid: true })) };

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("glows, pulses and bursts confetti once when the pot becomes complete", async () => {
    stubMotion(false);
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount(allButOne);
    expect(container.querySelector(".confetti")).toBeNull();
    expect(q(".ring").classList.contains("celebrate")).toBe(false);

    await tap(toggles()[2]);

    expect(container.querySelectorAll(".confetti i")).toHaveLength(28);
    expect(q(".ring").classList.contains("celebrate")).toBe(true);
    expect(q(".ring").classList.contains("complete")).toBe(true);

    save.resolve({ ok: true });
    await flush();
  });

  it("does not celebrate just because the page loaded with the pot already complete", async () => {
    stubMotion(false);
    await mount(allPaid);
    expect(q(".ring").classList.contains("complete")).toBe(true);
    expect(container.querySelector(".confetti")).toBeNull();
    expect(q(".ring").classList.contains("celebrate")).toBe(false);
  });

  it("skips the confetti entirely for users who prefer reduced motion", async () => {
    stubMotion(true);
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount(allButOne);
    await tap(toggles()[2]);
    expect(q(".banner")).not.toBeNull(); // the information still appears
    expect(container.querySelector(".confetti")).toBeNull();
    expect(q(".ring").classList.contains("celebrate")).toBe(false);
    save.resolve({ ok: true });
    await flush();
  });

  it("sweeps light across a row when it is marked paid, and not when it is unmarked", async () => {
    const save = deferred<{ ok: true }>();
    setPaid.mockReturnValue(save.promise);
    await mount();

    await tap(toggles()[0]);
    expect(toggles()[0].classList.contains("swept")).toBe(true);
    save.resolve({ ok: true });
    await flush();

    // Start again with Agnes already paid: unmarking her must not sweep.
    await act(async () => { root?.unmount(); });
    root = undefined;
    const unmark = deferred<{ ok: true }>();
    setPaid.mockReturnValue(unmark.promise);
    await mount({ ...props, payers: [{ id: 1, name: "Agnes Wanjira", paid: true }, props.payers[1], props.payers[2]] });
    await tap(toggles()[0]);
    expect(toggles()[0].classList.contains("swept")).toBe(false);
    unmark.resolve({ ok: true });
    await flush();
  });

  it("gives each row its place in the entrance cascade", async () => {
    await mount();
    expect(toggles().map((t) => t.style.getPropertyValue("--i"))).toEqual(["4", "5", "6"]);
  });
});

describe("RoundLive: a week that is already closed", () => {
  it("shows the close button as done and disabled, and says where the payments went", async () => {
    await act(async () => { root = createRoot(container); root.render(<RoundLive {...props} closed />); });
    const button = container.querySelector("[data-action=close-week]") as HTMLButtonElement;
    expect(button.textContent).toBe("Week closed ✓");
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain("saved in History");
  });

  it("offers Close week as normal while the week is open", async () => {
    await act(async () => { root = createRoot(container); root.render(<RoundLive {...props} />); });
    const button = container.querySelector("[data-action=close-week]") as HTMLButtonElement;
    expect(button.textContent).toBe("Close week");
    expect(button.disabled).toBe(false);
    expect(container.textContent).not.toContain("saved in History");
  });
});

describe("RoundLive before the page is ready", () => {
  it("server-renders toggles and buttons as disabled, then enables them once hydrated", async () => {
    setPaid.mockResolvedValue({ ok: true });
    container.innerHTML = renderToString(<RoundLive {...props} />);

    // Rows plus Share, Close week, Copy and Download image.
    const interactive = () => [...container.querySelectorAll<HTMLButtonElement>(".toggle, [data-action]")];
    expect(toggles()).toHaveLength(3);
    expect(interactive()).toHaveLength(7);
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
