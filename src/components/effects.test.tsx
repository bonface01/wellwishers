// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { usePathname } from "next/navigation";
import { makeConfetti } from "@/lib/confetti";
import { AdminNav } from "./AdminNav";
import { Backdrop } from "./Backdrop";
import { Confetti, Tilt } from "./effects";
import { RollingNumber } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** Pretend to be a desktop browser, optionally one that asks for reduced motion. */
function stubMedia({ reduced = false, finePointer = true } = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion")
        ? reduced
        : query.includes("hover: hover") || query.includes("pointer: fine")
          ? finePointer
          : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
}

async function render(ui: React.ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container.remove();
  delete (window as { matchMedia?: unknown }).matchMedia;
  document.documentElement.removeAttribute("data-tab-hidden");
});

describe("RollingNumber", () => {
  const columns = () => [...container.querySelectorAll<HTMLElement>(".digit .strip")];
  const digits = () => columns().map((c) => c.style.getPropertyValue("--d"));

  it("shows each digit as a column that holds 0–9, positioned on the right digit", async () => {
    await render(<RollingNumber value={1250} />);
    expect(digits()).toEqual(["1", "2", "5", "0"]);
    expect(columns()[0].children).toHaveLength(10);
    expect(container.querySelector(".sep")?.textContent).toBe(",");
    const num = container.querySelector(".num") as HTMLElement;
    expect(num.getAttribute("aria-label")).toBe("1,250");
    expect(num.dataset.value).toBe("1250");
  });

  it("rolls by moving the same columns when the value changes", async () => {
    await render(<RollingNumber value={700} />);
    const before = columns();
    root.render(<RollingNumber value={900} />);
    await act(async () => {});
    expect(columns()[0]).toBe(before[0]); // the hundreds column is reused, so CSS can animate it
    expect(digits()).toEqual(["9", "0", "0"]);
  });

  it("keeps units, tens and hundreds in place when the number gains a digit", async () => {
    await render(<RollingNumber value={999} />);
    const units = columns()[2];
    root.render(<RollingNumber value={1000} />);
    await act(async () => {});
    expect(columns()[3]).toBe(units);
    expect(digits()).toEqual(["1", "0", "0", "0"]);
  });

  it("handles decimals", async () => {
    await render(<RollingNumber value={12.5} />);
    expect(digits()).toEqual(["1", "2", "5"]);
    expect(container.querySelector(".sep")?.textContent).toBe(".");
  });
});

describe("Tilt", () => {
  const tilt = () => container.querySelector(".tilt") as HTMLElement;
  const pointer = (type: string, pointerType: string, x = 80, y = 20) => {
    const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(e, "pointerType", { value: pointerType });
    tilt().dispatchEvent(e);
  };
  const frame = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

  beforeEach(() => {
    tilt; // (lazy)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON() {},
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("follows a mouse on desktop", async () => {
    stubMedia();
    await render(<Tilt>hi</Tilt>);
    pointer("pointermove", "mouse", 90, 10);
    await frame();
    expect(tilt().style.getPropertyValue("--ry")).not.toBe("");
    expect(parseFloat(tilt().style.getPropertyValue("--ry"))).toBeGreaterThan(0); // pointer right of centre
    expect(parseFloat(tilt().style.getPropertyValue("--rx"))).toBeGreaterThan(0); // pointer above centre
    pointer("pointerleave", "mouse");
    expect(tilt().style.getPropertyValue("--ry")).toBe("0deg");
  });

  it("ignores touch and pen input", async () => {
    stubMedia();
    await render(<Tilt>hi</Tilt>);
    pointer("pointermove", "touch");
    pointer("pointermove", "pen");
    await frame();
    expect(tilt().style.getPropertyValue("--ry")).toBe("");
  });

  it("does nothing on devices without a fine hover pointer", async () => {
    stubMedia({ finePointer: false });
    await render(<Tilt>hi</Tilt>);
    pointer("pointermove", "mouse");
    await frame();
    expect(tilt().style.getPropertyValue("--ry")).toBe("");
  });

  it("does nothing when the user prefers reduced motion", async () => {
    stubMedia({ reduced: true });
    await render(<Tilt>hi</Tilt>);
    pointer("pointermove", "mouse");
    await frame();
    expect(tilt().style.getPropertyValue("--ry")).toBe("");
  });
});

describe("Confetti", () => {
  it("renders one piece per particle with its motion variables", async () => {
    const particles = makeConfetti(12, () => 0.5);
    await render(<Confetti particles={particles} />);
    const pieces = container.querySelectorAll<HTMLElement>(".confetti i");
    expect(pieces).toHaveLength(12);
    expect(pieces[0].style.getPropertyValue("--dx")).toBe(`${particles[0].dx}px`);
    expect(pieces[0].style.getPropertyValue("--c")).toBe(particles[0].color);
    expect(container.querySelector(".confetti")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("AdminNav sliding highlight", () => {
  const pill = () => container.querySelector(".tab-pill") as HTMLElement;
  const at = async (path: string) => {
    vi.mocked(usePathname).mockReturnValue(path);
    await render(<AdminNav />);
  };

  it("puts the highlight under the active tab", async () => {
    await at("/admin");
    expect(pill().style.getPropertyValue("--i")).toBe("0");
    expect(container.querySelector("a.active")?.textContent).toBe("Week");
  });

  it("moves with the route", async () => {
    await at("/admin/members");
    expect(pill().style.getPropertyValue("--i")).toBe("1");
    await act(async () => { root.unmount(); });
    await at("/admin/history");
    expect(pill().style.getPropertyValue("--i")).toBe("2");
    expect(container.querySelector("a.active")?.textContent).toBe("History");
    await act(async () => { root.unmount(); });
    await at("/admin/settings");
    expect(pill().style.getPropertyValue("--i")).toBe("3");
    expect(container.querySelector("a.active")?.textContent).toBe("Settings");
  });

  it("keeps History highlighted while a week is open", async () => {
    await at("/admin/history/3");
    expect(container.querySelector("a.active")?.textContent).toBe("History");
    expect(container.querySelectorAll(".tabbar a")).toHaveLength(4);
  });

  it("hides the highlight on routes outside the three tabs", async () => {
    await at("/somewhere-else");
    expect(pill().dataset.none).toBe("true");
  });
});

describe("Backdrop", () => {
  it("renders four orbs and the grain, and pauses them while the tab is hidden", async () => {
    await render(<Backdrop />);
    expect(container.querySelectorAll(".orb")).toHaveLength(4);
    expect(container.querySelector(".grain")).not.toBeNull();
    expect(document.documentElement.getAttribute("data-tab-hidden")).toBe("false");

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(document.documentElement.getAttribute("data-tab-hidden")).toBe("true");

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(document.documentElement.getAttribute("data-tab-hidden")).toBe("false");
  });
});
