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
  members: [
    { id: 1, name: "Agnes Wanjira" },
    { id: 2, name: "Bonface Mutie" },
    { id: 3, name: "Brian Kithua" },
  ],
  currentRound: 4,
  existingRounds: [3],
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
  const fill = async (week: string, date: string, recipient: string) => {
    await type(container.querySelector("input[type=number]") as HTMLInputElement, week);
    await type(container.querySelector("input[type=date]") as HTMLInputElement, date);
    await type(container.querySelector("select") as HTMLSelectElement, recipient);
  };

  it("starts empty with Save off", async () => {
    await render(<WeekEditor {...add()} />);
    expect(saveButton().disabled).toBe(true);
    expect(total()).toBe("0");
    expect(q(".week-summary .hero-name").textContent).toBe("Choose a recipient");
  });

  it("leaves the recipient off the checklist when recipients do not contribute", async () => {
    await render(<WeekEditor {...add()} />);
    await fill("2", "2026-09-13", "Agnes Wanjira");
    expect(rows().map((r) => r.querySelector(".toggle-name")!.textContent)).toEqual(["Bonface Mutie", "Brian Kithua"]);
    await type(container.querySelector("select") as HTMLSelectElement, "Bonface Mutie");
    expect(rows().map((r) => r.querySelector(".toggle-name")!.textContent)).toEqual(["Agnes Wanjira", "Brian Kithua"]);
  });

  it("includes the recipient when recipients do contribute", async () => {
    await render(<WeekEditor {...add({ recipientPays: true })} />);
    await fill("2", "2026-09-13", "Agnes Wanjira");
    expect(rows()).toHaveLength(3);
  });

  it.each([
    ["4", "2026-09-13", /not in the past/],
    ["3", "2026-09-13", /already in the history/],
    ["2", "2026-09-14", /Sunday/],
    ["0", "2026-09-13", /whole number/],
  ])("explains why week %s on %s cannot be added and keeps Save off", async (week, date, message) => {
    await render(<WeekEditor {...add()} />);
    await fill(week, date, "Agnes Wanjira");
    expect(q(".card .msg.error").textContent).toMatch(message);
    expect(saveButton().disabled).toBe(true);
  });

  it("confirms, then submits the week, Sunday, recipient and ticked members", async () => {
    await render(<WeekEditor {...add()} />);
    await fill("2", "2026-09-13", "Agnes Wanjira");
    await tap(rows()[0]);
    await tap(rows()[1]);
    expect(total()).toBe("200");
    expect(saveButton().disabled).toBe(false);

    await tap(saveButton());
    expect(dialog().getAttribute("aria-label")).toBe("Add week 2?");
    expect(dialog().textContent).toContain("Agnes Wanjira");
    expect(dialog().textContent).toContain("KSh 200");
    expect(action).not.toHaveBeenCalled();

    await tap([...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0]);
    await flush();
    const fd = submitted[0];
    expect(fd.get("week")).toBe("2");
    expect(fd.get("date")).toBe("2026-09-13");
    expect(fd.get("recipient")).toBe("Agnes Wanjira");
    expect(fd.getAll("paid").sort()).toEqual(["Bonface Mutie", "Brian Kithua"]);
  });

  it("does not send someone who stopped being eligible after the recipient changed", async () => {
    await render(<WeekEditor {...add()} />);
    await fill("2", "2026-09-13", "Agnes Wanjira");
    await tap(rows()[0]); // Bonface
    await tap(rows()[1]); // Brian
    await type(container.querySelector("select") as HTMLSelectElement, "Bonface Mutie"); // Bonface becomes the recipient
    expect(total()).toBe("100"); // only Brian still counts
    await tap(saveButton());
    await tap([...dialog().querySelectorAll<HTMLButtonElement>("button[type=submit]")][0]);
    await flush();
    expect(submitted[0].getAll("paid")).toEqual(["Brian Kithua"]);
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
