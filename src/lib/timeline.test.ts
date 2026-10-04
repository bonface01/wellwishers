import { describe, expect, it } from "vitest";
import { buildTimeline, initialsOf, weeksLabel } from "./timeline";

describe("buildTimeline", () => {
  const order = [
    { id: 1, name: "Agnes Wanjira", received: true },
    { id: 2, name: "Bonface Mutie", received: false }, // current
    { id: 3, name: "Brian Kithua", received: false },
    { id: 4, name: "Daniel Muuo", received: false },
    { id: 5, name: "Jacob Muoki", received: false },
  ];

  it("marks received, current and upcoming members with weeks ahead", () => {
    expect(buildTimeline(order, 2).map((e) => [e.name, e.status, e.when])).toEqual([
      ["Agnes Wanjira", "received", null],
      ["Bonface Mutie", "current", "this week"],
      ["Brian Kithua", "upcoming", "next week"],
      ["Daniel Muuo", "upcoming", "in 2 weeks"],
      ["Jacob Muoki", "upcoming", "in 3 weeks"],
    ]);
  });

  it("counts weeks only across members who have not received yet", () => {
    const mid = [
      { id: 1, name: "A A", received: false }, // current
      { id: 2, name: "B B", received: true },
      { id: 3, name: "C C", received: false },
    ];
    expect(buildTimeline(mid, 1).map((e) => e.when)).toEqual(["this week", null, "next week"]);
  });

  it("copes with no current recipient", () => {
    expect(buildTimeline([], null)).toEqual([]);
  });
});

describe("weeksLabel / initialsOf", () => {
  it("labels weeks", () => {
    expect(weeksLabel(1)).toBe("next week");
    expect(weeksLabel(2)).toBe("in 2 weeks");
  });

  it("takes first and last initials", () => {
    expect(initialsOf("Agnes Wanjira")).toBe("AW");
    expect(initialsOf("  brian   kay mutisya ")).toBe("BM");
    expect(initialsOf("Cher")).toBe("C");
    expect(initialsOf("")).toBe("?");
  });
});
