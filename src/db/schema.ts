import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const groups = pgTable("group", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("Contribution Circle"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("KSh"),
  recipientPays: boolean("recipient_pays").notNull().default(true),
  currentRound: integer("current_round").notNull().default(1),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull(),
    secondName: text("second_name").notNull(),
    receivedThisCycle: boolean("received_this_cycle").notNull().default(false),
  },
  (t) => [
    uniqueIndex("members_full_name_unique").on(
      sql`lower(${t.firstName})`,
      sql`lower(${t.secondName})`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    round: integer("round").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.round, t.memberId] })],
);

export const loginAttempts = pgTable("login_attempts", {
  ip: text("ip").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const history =pgTable("history", {
  id: serial("id").primaryKey(),
  round: integer("round").notNull(),
  recipientName: text("recipient_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
});
