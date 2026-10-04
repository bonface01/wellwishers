CREATE TABLE "group" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'Contribution Circle' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"recipient_pays" boolean DEFAULT true NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history" (
	"id" serial PRIMARY KEY NOT NULL,
	"round" integer NOT NULL,
	"recipient_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"second_name" text NOT NULL,
	"received_this_cycle" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"round" integer NOT NULL,
	"member_id" integer NOT NULL,
	CONSTRAINT "payments_round_member_id_pk" PRIMARY KEY("round","member_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_full_name_unique" ON "members" USING btree (lower("first_name"),lower("second_name"));