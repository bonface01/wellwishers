// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  saveSettings: vi.fn(), addMember: vi.fn(), login: vi.fn(), removeMember: vi.fn(), setReceived: vi.fn(),
  closeRound: vi.fn(), startNewCycle: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { SettingsForm } from "./forms";
import { PublicView } from "./PublicView";
import { ScheduleCard } from "./ScheduleList";
import { buildSchedule, type SMember } from "@/lib/schedule";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const render = async (ui: React.ReactNode) => {
  root = createRoot(container);
  await act(async () => { root.render(ui); });
};
beforeEach(() => { container = document.createElement("div"); document.body.append(container); });
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

const m = (id: number, name: string, joinedCycle = 1): SMember => ({ id, name, joinedCycle });
const MEMBERS = [m(1, "Agnes Wanjira"), m(2, "Bonface Mutie"), m(3, "Brian Kithua"), m(4, "Brian Mutisya"), m(5, "Daniel Muuo")];
// Cycle start Sunday 6 Sept: week 5 is Sunday 4 Oct.
const schedule = (currentWeek: number, members = MEMBERS) => buildSchedule({ cycleStart: "2026-09-06", members, currentWeek })!;

describe("ScheduleCard", () => {
  it("shows every member with their week number and Sunday, marked received, this week or upcoming", async () => {
    await render(<ScheduleCard schedule={schedule(5)} />);
    const items = [...container.querySelectorAll<HTMLElement>(".schedule li")];
    expect(items.map((li) => li.className)).toEqual(["received", "received", "received", "received", "current"]);
    expect(items[4].getAttribute("aria-label")).toBe("Week 5 · Daniel Muuo · Sun 4 Oct");
    expect(items[4].textContent).toContain("This week");
    expect(items[0].getAttribute("aria-label")).toBe("Week 1 · Agnes Wanjira · Sun 6 Sept");
    expect(items[0].textContent).toContain("Received");
    expect(container.querySelector(".card-head")?.textContent).toContain("Cycle 1 · weeks 1–5");
  });

  it("marks later weeks as upcoming", async () => {
    await render(<ScheduleCard schedule={schedule(2)} />);
    const items = [...container.querySelectorAll<HTMLElement>(".schedule li")];
    expect(items.map((li) => li.className)).toEqual(["received", "current", "upcoming", "upcoming", "upcoming"]);
    expect(items[2].textContent).toContain("Upcoming");
    expect(items[2].textContent).toContain("Week 3 · Sun 20 Sept");
  });

  it("says when the next cycle starts and who joins it", async () => {
    const withJoiner = [...MEMBERS, m(6, "Zed Newcomer", 2)];
    await render(<ScheduleCard schedule={schedule(3, withJoiner)} />);
    const note = container.querySelector(".note")!.textContent!;
    expect(note).toContain("next cycle starts Sun 11 Oct (week 6)");
    expect(note).toContain("Joining from then: Zed Newcomer");
    expect(container.querySelectorAll(".schedule li")).toHaveLength(5); // the locked cycle, without the newcomer
  });
});

describe("PublicView: schedule or the old order", () => {
  const base = {
    groupName: "Test", round: 5, amount: 100, currency: "KSh", recipientName: "Daniel Muuo", nextName: "Agnes Wanjira",
    nextIsNewCycle: true, collected: 0, expected: 400, payers: [{ id: 1, name: "Agnes Wanjira", paid: false }],
    timeline: [{ id: 5, name: "Daniel Muuo", status: "current" as const, when: "this week" }],
    history: [],
  };

  it("shows the dated schedule once a cycle start date is set", async () => {
    await render(<PublicView {...base} schedule={schedule(5)} />);
    expect(container.querySelector(".schedule")).not.toBeNull();
    expect(container.textContent).toContain("Week 5 · Sun 4 Oct");
    expect(container.textContent).not.toContain("Payout order");
    expect(container.querySelectorAll("button").length).toBe(0); // still read-only
  });

  it("keeps the old payout order until then", async () => {
    await render(<PublicView {...base} schedule={null} />);
    expect(container.querySelector(".schedule")).toBeNull();
    expect(container.textContent).toContain("Payout order");
  });
});

describe("SettingsForm: manual week only until the schedule is on", () => {
  const props = { name: "G", amount: 100, currency: "KSh", recipientPays: false, currentRound: 4 };

  it("without a cycle start date it keeps the manual week number and says the schedule is off", async () => {
    await render(<SettingsForm {...props} cycleStart={null} derivedWeek={null} derivedDate={null} />);
    expect(container.querySelector("input[name=currentRound]")).not.toBeNull();
    expect(container.querySelector("input[name=cycleStart]")).not.toBeNull();
    expect(container.textContent).toContain("schedule is off until you set the cycle start date");
  });

  it("with a cycle start date it drops the manual week number and shows the week worked out from today", async () => {
    await render(<SettingsForm {...props} cycleStart="2026-09-06" derivedWeek={5} derivedDate="2026-10-04" />);
    expect(container.querySelector("input[name=currentRound]")).toBeNull();
    expect((container.querySelector("input[name=cycleStart]") as HTMLInputElement).value).toBe("2026-09-06");
    expect(container.querySelector("[role=status]")?.textContent).toContain("week 5");
    expect(container.querySelector("[role=status]")?.textContent).toContain("Sun 4 Oct");
    expect(container.textContent).not.toContain("schedule is off");
  });
});
