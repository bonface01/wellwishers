CREATE TABLE "history_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"history_id" integer NOT NULL,
	"member_id" integer,
	"member_name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "history" ADD COLUMN "contribution" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "history" ADD COLUMN "recipient_pays" boolean;--> statement-breakpoint
ALTER TABLE "history_payments" ADD CONSTRAINT "history_payments_history_id_history_id_fk" FOREIGN KEY ("history_id") REFERENCES "public"."history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_payments" ADD CONSTRAINT "history_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "history_payments_week_member_unique" ON "history_payments" USING btree ("history_id","member_name");