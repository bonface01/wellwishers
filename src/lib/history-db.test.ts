import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { groups, history, historyPayments, members, payments } from "@/db/schema";
import {
  addWeekStatements,
  closeWeekStatements,
  nextHistoryId,
  saveWeekStatements,
  type Statements,
} from "./history-db";

// Real Postgres semantics (in memory), using the real migrations. Never the live database.
let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

const run = async (stmts: Statements) => {
  for (const s of stmts) await s;
};

async function reset() {
  await pg.exec(`truncate history_payments, history, payments, members, "group" restart identity cascade`);
  await db.insert(groups).values({ id: 1, name: "Test", amount: "100", currency: "KSh", recipientPays: false, currentRound: 4 });
  await db.insert(members).values([
    { firstName: "Agnes", secondName: "Wanjira" },
    { firstName: "Bonface", secondName: "Mutie" },
    { firstName: "Brian", secondName: "Kithua" },
  ]);
}

beforeAll(async () => {
  pg = new PGlite();
  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await pg.exec(stmt);
    }
  }
  db = drizzle(pg, { schema });
});
afterAll(() => pg.close());
beforeEach(reset);

const paidFor = async (historyId: number) =>
  (await db.select().from(historyPayments).where(eq(historyPayments.historyId, historyId)))
    .map((r) => r.memberName)
    .sort();

describe("nextHistoryId", () => {
  it("reserves increasing ids that explicit inserts can use without clashing with the serial", async () => {
    const a = await nextHistoryId(db);
    const b = await nextHistoryId(db);
    expect(b).toBe(a + 1);
    await db.insert(history).values({ id: b, round: 1, recipientName: "X Y", amount: "0" });
    const c = await nextHistoryId(db);
    expect(c).toBe(b + 1);
  });
});

describe("closeWeekStatements", () => {
  it("records the week with who paid, the contribution and the recipient setting", async () => {
    const [agnes, bonface, brian] = await db.select().from(members).orderBy(members.id);
    await db.insert(payments).values([
      { round: 4, memberId: bonface.id },
      { round: 4, memberId: brian.id },
    ]);
    const historyId = await nextHistoryId(db);
    await run(
      closeWeekStatements(db, {
        historyId,
        round: 4,
        recipientId: agnes.id,
        recipientName: "Agnes Wanjira",
        contribution: 100,
        recipientPays: false,
        paid: [
          { id: bonface.id, name: "Bonface Mutie" },
          { id: brian.id, name: "Brian Kithua" },
        ],
        cycleEnds: false,
      }),
    );

    const [row] = await db.select().from(history);
    expect(row).toMatchObject({ id: historyId, round: 4, recipientName: "Agnes Wanjira", amount: "200.00", contribution: "100.00", recipientPays: false });
    expect(await paidFor(historyId)).toEqual(["Bonface Mutie", "Brian Kithua"]);

    // The rest of closing a week still happens.
    expect((await db.select().from(members).where(eq(members.id, agnes.id)))[0].receivedThisCycle).toBe(true);
    expect(await db.select().from(payments)).toHaveLength(0);
    expect((await db.select().from(groups))[0].currentRound).toBe(5);
  });

  it("resets the cycle when the last member has been paid out, and handles a week nobody paid", async () => {
    const [agnes] = await db.select().from(members).orderBy(members.id);
    await db.update(members).set({ receivedThisCycle: true });
    const historyId = await nextHistoryId(db);
    await run(
      closeWeekStatements(db, {
        historyId, round: 4, recipientId: agnes.id, recipientName: "Agnes Wanjira",
        contribution: 100, recipientPays: true, paid: [], cycleEnds: true,
      }),
    );
    expect((await db.select().from(history))[0].amount).toBe("0.00");
    expect(await paidFor(historyId)).toEqual([]);
    expect((await db.select().from(members)).every((m) => !m.receivedThisCycle)).toBe(true);
  });
});

describe("saveWeekStatements", () => {
  async function seedWeek(paid: string[]) {
    const id = await nextHistoryId(db);
    await run(addWeekStatements(db, {
      historyId: id, round: 2, date: new Date("2026-09-13T15:00:00Z"), recipientName: "Agnes Wanjira",
      contribution: 100, recipientPays: false, paid: paid.map((name) => ({ id: null, name })),
    }));
    return id;
  }

  it("replaces who paid and recalculates the total", async () => {
    const id = await seedWeek(["Bonface Mutie"]);
    expect((await db.select().from(history))[0].amount).toBe("100.00");

    await run(saveWeekStatements(db, {
      historyId: id, contribution: 100, recipientPays: false,
      paid: [{ id: 3, name: "Brian Kithua" }, { id: 2, name: "Bonface Mutie" }],
    }));
    expect(await paidFor(id)).toEqual(["Bonface Mutie", "Brian Kithua"]);
    expect((await db.select().from(history))[0].amount).toBe("200.00");
  });

  it("can untick everyone, leaving a zero total", async () => {
    const id = await seedWeek(["Bonface Mutie", "Brian Kithua"]);
    await run(saveWeekStatements(db, { historyId: id, contribution: 100, recipientPays: false, paid: [] }));
    expect(await paidFor(id)).toEqual([]);
    expect((await db.select().from(history))[0].amount).toBe("0.00");
  });

  it("fills in the contribution on a week recorded before it was tracked, and leaves other weeks alone", async () => {
    await pg.exec(`insert into history (id, round, recipient_name, amount, date) values (900, 1, 'Old Week', 350.00, '2026-09-06T15:00:00Z'), (901, 2, 'Other Week', 50.00, '2026-09-13T15:00:00Z')`);
    await run(saveWeekStatements(db, {
      historyId: 900, contribution: 100, recipientPays: true,
      paid: [{ id: 1, name: "Agnes Wanjira" }, { id: 2, name: "Bonface Mutie" }],
    }));
    const rows = await db.select().from(history).orderBy(history.id);
    expect(rows[0]).toMatchObject({ id: 900, amount: "200.00", contribution: "100.00", recipientPays: true });
    expect(rows[0].date.toISOString()).toBe("2026-09-06T15:00:00.000Z"); // date untouched
    expect(rows[1]).toMatchObject({ id: 901, amount: "50.00", contribution: null }); // untouched
  });

  it("keeps a former member's payment when it is resubmitted", async () => {
    const id = await seedWeek(["Zed Gone"]);
    await run(saveWeekStatements(db, {
      historyId: id, contribution: 100, recipientPays: false,
      paid: [{ id: null, name: "Zed Gone" }, { id: 2, name: "Bonface Mutie" }],
    }));
    expect(await paidFor(id)).toEqual(["Bonface Mutie", "Zed Gone"]);
  });
});

describe("addWeekStatements", () => {
  it("adds a past week with its Sunday, recipient, payers and total, without touching the current cycle", async () => {
    const before = await db.select().from(members).orderBy(members.id);
    const id = await nextHistoryId(db);
    await run(addWeekStatements(db, {
      historyId: id, round: 1, date: new Date("2026-09-06T15:00:00Z"), recipientName: "Agnes Wanjira",
      contribution: 100, recipientPays: false,
      paid: [{ id: 2, name: "Bonface Mutie" }, { id: 3, name: "Brian Kithua" }],
    }));
    const [row] = await db.select().from(history);
    expect(row).toMatchObject({ round: 1, recipientName: "Agnes Wanjira", amount: "200.00", contribution: "100.00" });
    expect(row.date.toISOString()).toBe("2026-09-06T15:00:00.000Z");
    expect(await paidFor(id)).toEqual(["Bonface Mutie", "Brian Kithua"]);
    expect(await db.select().from(members).orderBy(members.id)).toEqual(before); // nobody marked received
    expect((await db.select().from(groups))[0].currentRound).toBe(4);
  });

  it("never records the same member twice for a week", async () => {
    const id = await nextHistoryId(db);
    await expect(
      run(addWeekStatements(db, {
        historyId: id, round: 1, date: new Date(), recipientName: "Agnes Wanjira", contribution: 100, recipientPays: false,
        paid: [{ id: 2, name: "Bonface Mutie" }, { id: 2, name: "Bonface Mutie" }],
      })),
    ).rejects.toThrow();
  });
});
