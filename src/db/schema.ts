import {
  boolean,
  date,
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
  // The Sunday of week 1. Used to work out the date and recipient of past weeks added by hand. Optional.
  cycleStart: date("cycle_start", { mode: "string" }),
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

export const history = pgTable("history", {
  id: serial("id").primaryKey(),
  round: integer("round").notNull(),
  recipientName: text("recipient_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  // Added later, so null on weeks closed before per-member payments were recorded.
  contribution: numeric("contribution", { precision: 12, scale: 2 }), // amount each member paid that week
  recipientPays: boolean("recipient_pays"), // whether the recipient also contributed that week
});

/** Who paid in a closed week. Names are kept so the record survives a member being removed later. */
export const historyPayments = pgTable(
  "history_payments",
  {
    id: serial("id").primaryKey(),
    historyId: integer("history_id")
      .notNull()
      .references(() => history.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    memberName: text("member_name").notNull(),
  },
  (t) => [uniqueIndex("history_payments_week_member_unique").on(t.historyId, t.memberName)],
);
