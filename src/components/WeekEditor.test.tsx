// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  saveWeek: vi.fn(),
  addPastWeek: vi.fn(),
  closeRound: vi.fn(),
  startNewCycle: vi.fn(),
  addMember: vi.fn(),
  login: vi.fn(),
  removeMember: vi.fn(),
  saveSettings: vi.fn(),
  setReceived: vi.fn(),
  setPaid: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { FormState } from "@/app/actions";
import { HistoryList } from "./HistoryList";
import { WeekEditor, type AddWeekProps, type EditWeekProps } from "./WeekEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const submitted: FormData[] = [];
const action = vi.fn(async (_prev: FormState, fd: FormData): Promise<FormState> => {
  submitted.push(fd);
  return undefined;
});

const q = (sel: string) => container.querySelector(sel) as HTMLElement;
const rows = () => [...container.querySelectorAll<HTMLButtonElement>(".toggle")];
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const tap = (el: HTMLElement) => act(async () => { el.click(); });
const total = () => (q(".week-summary .num") as HTMLElement).dataset.value;
const saveButton = () => q("[data-action=save-week]") as HTMLButtonElement;
const dialog = () => q("dialog");

async function render(ui: React.ReactNode) {
  root = createRoot(container);
  await act(async () => { root.render(ui); });
}

/** Set a controlled input/select the way a user would (React listens to the native value setter). */
async function type(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  await act(async () => { el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  submitted.length = 0;
  action.mockClear();
  // jsdom has no <dialog> behaviour; mimic open/close so the confirmation sheet can be exercised.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
});

const edit = (over: Partial<EditWeekProps> = {}): EditWeekProps => ({
  mode: "edit",
  week: 3,
  recipientName: "Agnes Wanjira",
  dateLabel: "20 Sept 2026",
  amount: 100,
  currency: "KSh",
  recipientPays: false,
  savedTotal: 200,
  tracked: true,
  action,
  rows: [
    { name: "Bonface Mutie", memberId: 2, former: false, paid: true },
    { name: "Brian Kithua", memberId: 3, former: false, paid: true },
    { name: "Daniel Muuo", memberId: 4, former: false, paid: false },
    { name: "Zed Gone", memberId: null, former: true, paid: true },
  ],
  ...over,
});

const add = (over: Partial<AddWeekProps> = {}): AddWeekProps => ({
  mode: "add",
  // In payout order. With the cycle starting Sunday 6 Sept: week 1 = Agnes, 2 = Bonface, 3 = Brian, 4 = Agnes again.
  members: [
    { id: 1, name: "Agnes Wanjira" },
    { id: 2, name: "Bonface Mutie" },
    { id: 3, name: "Brian Kithua" },
  ],
  currentRound: 5,
  existingRounds: [3, 4],
  cycleStart: "2026-09-06",
  amount: 100,
  currency: "KSh",
  recipientPays: false,
  action,
  ...over,
});

describe("WeekEditor: correcting a past week", () => {
  it("starts with the saved ticks and total, including former members", async () => {
    await render(<WeekEditor {...edit()} />);
    expect(rows().map((r) => [r.querySelector(".toggle-name")!.textContent, r.getAttribute("aria-pressed")])).toEqual([
      ["Bonface Mutie", "true"],
      ["Brian Kithua", "true"],
      ["Daniel Muuo", "false"],
      ["Zed GoneFormer member", "true"],
    ]);
    expect(total()).toBe("300"); // three tick marks at KSh 100 (Zed Gone's saved payment is kept)
    expect(q(".week-summary .hero-name").textContent).toBe("Agnes Wanjira");
    expect(q(".week-summary .hero-label").textContent).toContain("Week 3");
  });

  it("recalculates the total and shows what it used to be as members are ticked and unticked", async () => {
    await render(<WeekEditor {...edit({ savedTotal: 300 })} />);
    await tap(rows()[2]); // Daniel paid
    expect(total()).toBe("400");
    expect(q(".week-summary .hero-expected").textContent).toContain("4 of 4 paid");
    expect(q(".week-summary .hero-expected").textContent).toContain("was KSh 300");
    await tap(rows()[0]); // Bonface did not pay
    await tap(rows()[1]); // Brian did not pay
    expect(total()).toBe("200");
  });

  it("keeps Save off until something changes, and does not save by itself", async () => {
    await render(<WeekEditor {...edit()} />);
    expect(saveButton().disabled).toBe(true);
    await tap(rows()[2]);
    expect(saveButton().disabled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("asks for confirmation, listing exactly what changes, before anything is saved", async () => {
    await render(<WeekEditor {...edit({ savedTotal: 300 })} />);
    await tap(rows()[2]); // + Daniel
    await tap(rows()[0]); // − Bonface
    await tap(saveButton());

    const d = dialog();
    expect((d as HTMLDialogElement).open).toBe(true);
    expect(d.getAttribute("aria-label")).toBe("Save changes to week 3?");
    const text = d.textContent ?? "";
    expect(text).toContain("Daniel Muuo marked as paid");
    expect(text).toContain("Bonface Mutie marked as not paid");
    expect(text).toContain("3 of 4");
    expect(action).not.toHaveBeenCalled(); // still just asking
  });

  it("submits the week and exactly the ticked names once confirmed", async () => {
    await render(<WeekEditor {...edit()} />);
    await tap(rows()[2]); // + Daniel
    await tap(rows()[0]); // − Bonface
    await tap(saveButton());
    const confirm = [...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0];
    await tap(confirm);
    await flush();

    expect(action).toHaveBeenCalledTimes(1);
    const fd = submitted[0];
    expect(fd.get("round")).toBe("3");
    expect(fd.getAll("paid").sort()).toEqual(["Brian Kithua", "Daniel Muuo", "Zed Gone"]);
  });

  it("cancelling the confirmation saves nothing", async () => {
    await render(<WeekEditor {...edit()} />);
    await tap(rows()[2]);
    await tap(saveButton());
    const cancel = [...dialog().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Cancel")!;
    await tap(cancel);
    expect((dialog() as HTMLDialogElement).open).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("lets a week saved before payments were tracked be recorded, and explains the recalculation", async () => {
    const legacy = edit({
      tracked: false,
      savedTotal: 350,
      rows: edit().rows.filter((r) => !r.former).map((r) => ({ ...r, paid: false })),
    });
    await render(<WeekEditor {...legacy} />);
    expect(q(".note")?.textContent).toContain("saved before payments were recorded per member");
    expect(saveButton().disabled).toBe(false); // a first save is allowed even before any tick
    await tap(rows()[0]);
    await tap(rows()[1]);
    expect(total()).toBe("200");
    await tap(saveButton());
    expect(dialog().textContent).toContain("KSh 350 → KSh 200");
    expect(dialog().textContent).toContain("recalculated");
  });

  it("shows a save error without losing the ticks", async () => {
    const failing = vi.fn(async (): Promise<FormState> => ({ error: "Could not save, so nothing was changed." }));
    await render(<WeekEditor {...edit({ action: failing })} />);
    await tap(rows()[2]);
    await tap(saveButton());
    await tap([...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0]);
    await flush();
    expect(q(".save-bar .msg.error").textContent).toContain("nothing was changed");
    expect(rows()[2].getAttribute("aria-pressed")).toBe("true");
  });
});

describe("WeekEditor: adding a missing past week", () => {
  const pick = (value: string) => type(container.querySelector("select") as HTMLSelectElement, value);
  const names = () => rows().map((r) => r.querySelector(".toggle-name")!.textContent);
  const derived = () => (container.querySelector(".derived")?.textContent ?? "").replace(/\s+/g, " ");

  it("only asks for the week number: there is no date or recipient field to fill in", async () => {
    await render(<WeekEditor {...add()} />);
    expect(container.querySelectorAll("select")).toHaveLength(1);
    expect(container.querySelector("input[type=date]")).toBeNull();
    expect(container.querySelector("input[type=number]")).toBeNull();
    expect(container.textContent).toContain("fill in automatically");
    expect(saveButton().disabled).toBe(true);
    expect(total()).toBe("0");
    expect(q(".week-summary .hero-name").textContent).toBe("Pick a week");
  });

  it("offers only the earlier weeks that are still missing", async () => {
    await render(<WeekEditor {...add()} />);
    const options = [...container.querySelectorAll("select option")].map((o) => o.textContent);
    expect(options).toEqual(["Choose a week…", "Week 1", "Week 2"]); // 3 and 4 are already recorded, 5 is current
  });

  it("fills in the Sunday and the recipient from the cycle start and the order", async () => {
    await render(<WeekEditor {...add()} />);
    await pick("2");
    expect(derived()).toContain("Sunday13 Sept 2026"); // 6 Sept + 1 week
    expect(derived()).toContain("RecipientBonface Mutie"); // 2nd in the order
    expect(q(".week-summary .hero-name").textContent).toBe("Bonface Mutie");
    expect(q(".week-summary .hero-label").textContent).toContain("Week 2 · 13 Sept 2026");
    expect(container.textContent).toContain("cycle start date (6 Sept 2026)");

    await pick("1");
    expect(derived()).toContain("Sunday6 Sept 2026");
    expect(derived()).toContain("RecipientAgnes Wanjira");
  });

  it("wraps back to the top of the order once everyone has received, while the dates keep counting", async () => {
    await render(<WeekEditor {...add({ currentRound: 6, existingRounds: [] })} />);
    await pick("4"); // 4th week with 3 members: Agnes again, three weeks after the start
    expect(derived()).toContain("Sunday27 Sept 2026");
    expect(derived()).toContain("RecipientAgnes Wanjira");
  });

  it("leaves the recipient off the checklist when recipients do not contribute", async () => {
    await render(<WeekEditor {...add()} />);
    await pick("2"); // Bonface
    expect(names()).toEqual(["Agnes Wanjira", "Brian Kithua"]);
    await pick("1"); // Agnes
    expect(names()).toEqual(["Bonface Mutie", "Brian Kithua"]);
  });

  it("includes the recipient when recipients do contribute", async () => {
    await render(<WeekEditor {...add({ recipientPays: true })} />);
    await pick("2");
    expect(rows()).toHaveLength(3);
  });

  it("keeps Save off until a week is chosen", async () => {
    await render(<WeekEditor {...add()} />);
    expect(saveButton().disabled).toBe(true);
    await pick("2");
    expect(saveButton().disabled).toBe(false);
    await pick("");
    expect(saveButton().disabled).toBe(true);
  });

  it("confirms, then submits only the week and who paid", async () => {
    await render(<WeekEditor {...add()} />);
    await pick("2");
    await tap(rows()[0]); // Agnes
    await tap(rows()[1]); // Brian
    expect(total()).toBe("200");

    await tap(saveButton());
    expect(dialog().getAttribute("aria-label")).toBe("Add week 2?");
    expect(dialog().textContent).toContain("13 Sept 2026");
    expect(dialog().textContent).toContain("Bonface Mutie");
    expect(dialog().textContent).toContain("KSh 200");
    expect(action).not.toHaveBeenCalled();

    await tap([...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0]);
    await flush();
    const fd = submitted[0];
    expect(fd.get("week")).toBe("2");
    expect(fd.getAll("paid").sort()).toEqual(["Agnes Wanjira", "Brian Kithua"]);
    // The server works the date and recipient out itself, so none is sent from the browser.
    expect(fd.has("date")).toBe(false);
    expect(fd.has("recipient")).toBe(false);
  });

  it("does not send someone who stopped being eligible after the week changed", async () => {
    await render(<WeekEditor {...add()} />);
    await pick("1"); // Agnes receives, so Bonface and Brian can be ticked
    await tap(rows()[0]); // Bonface
    await tap(rows()[1]); // Brian
    expect(total()).toBe("200");
    await pick("2"); // now Bonface receives and drops off the checklist
    expect(names()).toEqual(["Agnes Wanjira", "Brian Kithua"]);
    expect(total()).toBe("100"); // only Brian, who is still on the list and was ticked, counts

    await tap(saveButton());
    await tap([...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0]);
    await flush();
    expect(submitted[0].getAll("paid")).toEqual(["Brian Kithua"]);
  });

  it("asks for the cycle start date first when it has not been set", async () => {
    await render(<WeekEditor {...add({ cycleStart: null })} />);
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toContain("Set the cycle start date in Settings first");
    expect(q("a[href='/admin/settings']")).not.toBeNull();
    expect(container.querySelector("[data-action=save-week]")).toBeNull();
  });

  it("asks for members first when there are none", async () => {
    await render(<WeekEditor {...add({ members: [] })} />);
    expect(container.textContent).toContain("Add the members first");
    expect(container.querySelector("a[href='/admin/settings']")).toBeNull();
  });

  it("says so when every earlier week is already recorded", async () => {
    await render(<WeekEditor {...add({ existingRounds: [1, 2, 3, 4] })} />);
    expect(container.textContent).toContain("Every earlier week is already in the history");
    expect(container.querySelector("select")).toBeNull();
  });
});

describe("HistoryList", () => {
  const rowsData = [
    { round: 3, recipientName: "Bonface Mutie", date: new Date("2026-09-27T15:00:00Z"), amount: 800, paidCount: 8 },
    { round: 2, recipientName: "Agnes Wanjira", date: new Date("2026-09-20T15:00:00Z"), amount: 350, paidCount: null },
  ];

  it("makes each week a link to its editor and shows the total, date and who-paid status", async () => {
    await render(<HistoryList rows={rowsData} currency="KSh" />);
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a.link-row")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/admin/history/3", "/admin/history/2"]);
    expect(links[0].querySelector(".lr-title")?.textContent).toBe("Bonface Mutie");
    expect(links[0].textContent).toContain("Week 3 · 27 Sept 2026");
    expect(links[0].textContent).toContain("8 paid");
    expect(links[0].textContent).toContain("KSh 800");
    expect(links[1].textContent).toContain("Tap to record who paid");
    expect(links[1].textContent).toContain("KSh 350");
  });

  it("says what to do when there is no history yet", async () => {
    await render(<HistoryList rows={[]} currency="KSh" />);
    expect(container.textContent).toContain("Add a missing week");
  });
});
