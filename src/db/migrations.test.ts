import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "drizzle");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const NEW_MIGRATION = files.find((f) => f.startsWith("0003_"))!;

async function apply(pg: PGlite, file: string) {
  const sql = readFileSync(join(DIR, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) await pg.exec(statement);
  }
}

describe("migration 0003: per-member payments for closed weeks", () => {
  let pg: PGlite;
  let before: { history: unknown[]; members: unknown[]; group: unknown[]; payments: unknown[] };

  const snapshot = async () => ({
    history: (await pg.query("select id, round, recipient_name, amount, date from history order by id")).rows,
    members: (await pg.query("select * from members order by id")).rows,
    group: (await pg.query('select * from "group"')).rows,
    payments: (await pg.query("select * from payments order by round, member_id")).rows,
  });

  beforeAll(async () => {
    pg = new PGlite();
    // The database as it is today: every migration before the new one.
    for (const f of files.filter((f) => f < NEW_MIGRATION)) await apply(pg, f);

    await pg.exec(`
      insert into "group" (id, name, amount, currency, recipient_pays, current_round) values (1, 'Real Group', 100, 'KSh', false, 4);
      insert into members (first_name, second_name, received_this_cycle) values ('Agnes','Wanjira',true), ('Bonface','Mutie',false), ('Brian','Kithua',false);
      insert into payments (round, member_id) values (4, 2), (4, 3);
      insert into history (round, recipient_name, amount, date) values
        (1, 'Agnes Wanjira', 200.00, '2026-09-13T15:00:00Z'),
        (2, 'Agnes Wanjira', 100.50, '2026-09-20T15:00:00Z'),
        (3, 'Bonface Mutie', 0.00, '2026-09-27T15:00:00Z');
    `);
    before = await snapshot();
    await apply(pg, NEW_MIGRATION);
  });

  afterAll(async () => {
    await pg.close();
  });

  it("only adds things", () => {
    const sql = readFileSync(join(DIR, NEW_MIGRATION), "utf8").toUpperCase();
    // No dropping, renaming, rewriting or deleting existing data ("ON DELETE CASCADE" on a new foreign key is fine).
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b|ALTER COLUMN|RENAME|(^|;)\s*(DELETE\s+FROM|UPDATE)\b/);
    expect(sql).toMatch(/CREATE TABLE "HISTORY_PAYMENTS"/);
  });

  it("leaves every existing row exactly as it was", async () => {
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(after.history).toHaveLength(3);
  });

  it("gives existing weeks empty (null) new columns and no per-member payments yet", async () => {
    const rows = (await pg.query("select contribution, recipient_pays from history")).rows;
    expect(rows).toHaveLength(3);
    for (const r of rows as { contribution: unknown; recipient_pays: unknown }[]) {
      expect(r.contribution).toBeNull();
      expect(r.recipient_pays).toBeNull();
    }
    expect((await pg.query("select count(*)::int as n from history_payments")).rows[0]).toEqual({ n: 0 });
  });

  it("still lets old-style rows be written, since the new columns are optional", async () => {
    await pg.exec(`insert into history (round, recipient_name, amount) values (9, 'Someone Else', 50)`);
    const r = (await pg.query("select contribution, recipient_pays from history where round = 9")).rows[0];
    expect(r).toEqual({ contribution: null, recipient_pays: null });
    await pg.exec("delete from history where round = 9");
  });

  it("records who paid per week, once per member", async () => {
    const week = (await pg.query("select id from history where round = 2")).rows[0] as { id: number };
    await pg.exec(`insert into history_payments (history_id, member_id, member_name) values (${week.id}, 2, 'Bonface Mutie'), (${week.id}, 3, 'Brian Kithua')`);
    await expect(
      pg.exec(`insert into history_payments (history_id, member_id, member_name) values (${week.id}, 2, 'Bonface Mutie')`),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("keeps the payment record, with the name, when a member is removed later", async () => {
    await pg.exec("delete from members where id = 3");
    const r = (await pg.query("select member_id, member_name from history_payments where member_name = 'Brian Kithua'")).rows[0];
    expect(r).toEqual({ member_id: null, member_name: "Brian Kithua" });
  });

  it("deletes a week's payments together with the week", async () => {
    const week = (await pg.query("select id from history where round = 2")).rows[0] as { id: number };
    await pg.exec(`delete from history where id = ${week.id}`);
    expect((await pg.query("select count(*)::int as n from history_payments")).rows[0]).toEqual({ n: 0 });
  });
});

describe("migration 0004: optional cycle start date", () => {
  const CYCLE_MIGRATION = files.find((f) => f.startsWith("0004_"))!;
  let pg: PGlite;
  let before: unknown;

  const snapshot = async () => ({
    group: (await pg.query('select id, name, amount, currency, recipient_pays, current_round from "group"')).rows,
    members: (await pg.query("select * from members order by id")).rows,
    history: (await pg.query("select * from history order by id")).rows,
    historyPayments: (await pg.query("select * from history_payments order by id")).rows,
  });

  beforeAll(async () => {
    pg = new PGlite();
    for (const f of files.filter((f) => f < CYCLE_MIGRATION)) await apply(pg, f);
    await pg.exec(`
      insert into "group" (id, name, amount, currency, recipient_pays, current_round) values (1, 'Real Group', 100, 'KSh', false, 4);
      insert into members (first_name, second_name, received_this_cycle) values ('Agnes','Wanjira',true), ('Bonface','Mutie',false);
      insert into history (id, round, recipient_name, amount, date, contribution, recipient_pays) values (1, 3, 'Agnes Wanjira', 100.00, '2026-10-04T15:00:00Z', 100.00, false);
      insert into history_payments (history_id, member_id, member_name) values (1, 2, 'Bonface Mutie');
    `);
    before = await snapshot();
    await apply(pg, CYCLE_MIGRATION);
  });

  afterAll(async () => {
    await pg.close();
  });

  it("only adds a nullable column", () => {
    const sql = readFileSync(join(DIR, CYCLE_MIGRATION), "utf8").toUpperCase();
    expect(sql).toMatch(/ALTER TABLE "GROUP" ADD COLUMN "CYCLE_START" DATE;?\s*$/);
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b|ALTER COLUMN|RENAME|NOT NULL|(^|;)\s*(DELETE\s+FROM|UPDATE)\b/);
  });

  it("leaves every existing row exactly as it was, with the new setting empty", async () => {
    expect(await snapshot()).toEqual(before);
    expect((await pg.query('select cycle_start from "group"')).rows).toEqual([{ cycle_start: null }]);
  });

  it("stores a plain date that reads back unchanged", async () => {
    await pg.exec(`update "group" set cycle_start = '2026-09-13'`);
    const r = (await pg.query(`select to_char(cycle_start, 'YYYY-MM-DD') as d from "group"`)).rows[0];
    expect(r).toEqual({ d: "2026-09-13" });
  });
});

describe("migration 0005: locked order (joined cycle)", () => {
  const MIGRATION = files.find((f) => f.startsWith("0005_"))!;
  let pg: PGlite;
  let before: unknown;

  const snapshot = async () => ({
    group: (await pg.query('select * from "group"')).rows,
    members: (await pg.query("select id, first_name, second_name, received_this_cycle from members order by id")).rows,
    history: (await pg.query("select * from history order by id")).rows,
    payments: (await pg.query("select * from payments order by round, member_id")).rows,
    historyPayments: (await pg.query("select * from history_payments order by id")).rows,
  });

  beforeAll(async () => {
    pg = new PGlite();
    for (const f of files.filter((f) => f < MIGRATION)) await apply(pg, f);
    await pg.exec(`
      insert into "group" (id, name, amount, currency, recipient_pays, current_round, cycle_start) values (1, 'Real Group', 100, 'KSh', false, 4, '2026-09-06');
      insert into members (first_name, second_name, received_this_cycle) values ('Agnes','Wanjira',true), ('Bonface','Mutie',true), ('Brian','Kithua',false);
      insert into payments (round, member_id) values (4, 3);
      insert into history (id, round, recipient_name, amount, date, contribution, recipient_pays) values (1, 3, 'Agnes Wanjira', 100.00, '2026-09-20T15:00:00Z', 100.00, false);
      insert into history_payments (history_id, member_id, member_name) values (1, 2, 'Bonface Mutie');
    `);
    before = await snapshot();
    await apply(pg, MIGRATION);
  });

  afterAll(async () => {
    await pg.close();
  });

  it("only adds a column that already has a value for every existing row", () => {
    const sql = readFileSync(join(DIR, MIGRATION), "utf8").toUpperCase();
    expect(sql).toMatch(/ALTER TABLE "MEMBERS" ADD COLUMN "JOINED_CYCLE" INTEGER DEFAULT 1 NOT NULL;?\s*$/);
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b|ALTER COLUMN|RENAME|(^|;)\s*(DELETE\s+FROM|UPDATE)\b/);
  });

  it("leaves every existing row exactly as it was", async () => {
    expect(await snapshot()).toEqual(before);
  });

  it("puts every existing member in cycle 1, so nobody's place changes", async () => {
    const rows = (await pg.query("select first_name, joined_cycle from members order by id")).rows;
    expect(rows).toEqual([
      { first_name: "Agnes", joined_cycle: 1 },
      { first_name: "Bonface", joined_cycle: 1 },
      { first_name: "Brian", joined_cycle: 1 },
    ]);
  });

  it("still accepts members written the old way, and lets a later joiner be set", async () => {
    await pg.exec(`insert into members (first_name, second_name) values ('Old','Style')`);
    await pg.exec(`insert into members (first_name, second_name, joined_cycle) values ('New','Joiner', 2)`);
    const rows = (await pg.query("select first_name, joined_cycle from members where first_name in ('Old','New') order by id")).rows;
    expect(rows).toEqual([
      { first_name: "Old", joined_cycle: 1 },
      { first_name: "New", joined_cycle: 2 },
    ]);
  });
});
