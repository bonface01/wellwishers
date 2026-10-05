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

  it("is the newest migration and only adds things", () => {
    expect(files[files.length - 1]).toBe(NEW_MIGRATION);
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
