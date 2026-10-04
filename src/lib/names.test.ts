import { describe, expect, it } from "vitest";
import { capitalizeName, comparePayoutOrder, fullName } from "./names";

const member = (full: string) => {
  const [firstName, ...rest] = full.split(" ");
  return { firstName, secondName: rest.join(" ") };
};

const EXPECTED = [
  "Agnes Wanjira",
  "Bonface Mutie",
  "Brian Kithua",
  "Brian Mutisya",
  "Daniel Muuo",
  "Jacob Muoki",
  "Jennifer Musyoki",
  "Josphat Karanja",
];

const sorted = (names: string[]) => names.map(member).sort(comparePayoutOrder).map(fullName);

describe("comparePayoutOrder", () => {
  it("sorts by full first name, then second name only for identical first names", () => {
    expect(sorted(EXPECTED)).toEqual(EXPECTED);
  });

  it("gives the same result regardless of input order", () => {
    expect(sorted([...EXPECTED].reverse())).toEqual(EXPECTED);
    const shuffled = [3, 7, 0, 5, 1, 6, 2, 4].map((i) => EXPECTED[i]);
    expect(sorted(shuffled)).toEqual(EXPECTED);
  });

  it("is case-insensitive", () => {
    expect(sorted(EXPECTED.map((n) => n.toLowerCase()))).toEqual(EXPECTED.map((n) => n.toLowerCase()));
    expect(sorted(["brian Mutisya", "Brian kithua", "BONFACE mutie"])).toEqual([
      "BONFACE mutie",
      "Brian kithua",
      "brian Mutisya",
    ]);
  });

  it("orders by the whole first name, not just the initial", () => {
    // Same initial and same second-name initial: full first name decides.
    expect(sorted(["Jennifer Musyoki", "Jacob Muoki"])).toEqual(["Jacob Muoki", "Jennifer Musyoki"]);
    // A shorter name that is a prefix sorts first.
    expect(sorted(["Brianna Z", "Brian A"])).toEqual(["Brian A", "Brianna Z"]);
  });

  it("does not let the second name outrank the first name", () => {
    expect(sorted(["Zack Adams", "Aaron Zulu"])).toEqual(["Aaron Zulu", "Zack Adams"]);
  });
});

describe("capitalizeName", () => {
  it("capitalises each word and keeps hyphens and apostrophes tidy", () => {
    expect(capitalizeName("  aMINA  ")).toBe("Amina");
    expect(capitalizeName("mary-jane")).toBe("Mary-Jane");
    expect(capitalizeName("o'brien")).toBe("O'Brien");
  });
});
