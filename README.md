# Contribution Circle

A small web app for a WhatsApp savings group. Members each contribute a fixed amount per week to a finance person, who pays the whole pot to one member each week.

- **Public page (`/`)** – read-only: this week's recipient, who has paid, payout order, past weeks. No login.
- **Admin (`/admin`)** – for the finance person: settings, members, payment checklist, close week, WhatsApp update.

**Payout order:** full first name A–Z (case-insensitive). Only members with exactly the same first name are ordered by second name. When everyone has received, a new cycle starts from the top.

**Currency:** defaults to `KSh` and is shown before the amount everywhere, e.g. `KSh 1,000`.

**The weekly schedule:** contributions happen every Sunday. Set the **Cycle start date** (the Sunday of week 1) in Settings and everything follows from it:
- The current week is worked out from today's date in Nairobi (a week stays current through its own Sunday, and the next one begins on the Monday). There is no week number to set by hand and no "received" toggles.
- Week N's recipient is the N-th member in the payout order. When the last member's week is done, the next cycle starts the following Sunday, back at the top.
- The order is locked for the running cycle. A member added mid-cycle joins from the next cycle, so nobody already in the order moves.
- The full schedule (each member with their week number and Sunday, marked received, this week or upcoming) is shown on both the admin Week tab and the public page.
- **Close week** confirms the payout and saves that week's payments in History.

**Until the cycle start date is set**, the app keeps working exactly as before (manual week number and "received" toggles, **Close week** moves on to the next week) and the Week tab shows a prompt to set it in Settings.

Stack: Next.js (App Router) + TypeScript, Neon Postgres, Drizzle ORM, deployed on Vercel.

## Environment variables

| Name             | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`   | Neon's **direct (non-pooled)** connection string, i.e. the host without `-pooler`. The app uses Neon's HTTP driver, so pooling isn't needed, and migrations should not run through a pooler. |
| `ADMIN_PASSWORD` | Password for the finance person's login                                 |
| `SESSION_SECRET` | Long random string used to sign the admin cookie (`openssl rand -hex 32`) |
| `APP_TIMEZONE`   | Optional. IANA timezone for displayed week dates (default `Africa/Nairobi`) |

Copy `.env.example` to `.env.local` and fill it in. Never commit real values.

## Local development

1. Create a free Neon database at <https://neon.tech> and copy its connection string.
2. `npm install`
3. `cp .env.example .env.local` and set the three variables.
4. `npm run db:migrate` – applies the SQL migrations in `drizzle/`.
5. `npm run dev` and open <http://localhost:3000> (admin at <http://localhost:3000/admin>).

If you change `src/db/schema.ts`, run `npm run db:generate` to create a new migration, then `npm run db:migrate`.

## Deploy to Vercel

1. Push this project to a Git repository and import it in Vercel.
2. In the Vercel project: **Storage → Create Database → Neon** (Marketplace). This adds `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` and `SESSION_SECRET`.
4. Run the migrations once against the production database:
   - `vercel env pull .env.local` (or paste the production `DATABASE_URL` into `.env.local`), then
   - `npm run db:migrate`.
5. Deploy. Share the site's root URL (`/`) with the group; the finance person signs in at `/admin`.

Rerun `npm run db:migrate` whenever a new migration is added.

## Notes

- **Share update** (Week tab) opens a sheet with the WhatsApp text (Copy / Open in WhatsApp) and **Download status image**, a 1080×1920 PNG drawn in the browser with canvas (no external service).
- The "Payout in …" countdown targets Sunday 18:00 Nairobi time (fixed in `src/lib/countdown.ts`); it is display-only.
- **History tab:** closing a week now saves who paid, not just the total. Tap any past week to tick or untick who paid; its total is recalculated and you confirm before saving. **Add week** records a missing earlier week: you pick the week number and tick who paid, and the Sunday and the recipient are worked out for you from the **Cycle start date** in Settings (the Sunday of week 1) and the payout order (week N goes to the N-th person, wrapping around). Weeks closed before this change have no per-member record until you tick them once. A recorded week can also be **deleted** from its page (with a confirmation), for example one entered wrongly, and then added again.
- Removing a member takes them out of the schedule straight away (later weeks move up). Only *adding* a member is held back until the next cycle.
- Migrations `0003` to `0005` are additive (a new `history_payments` table, two optional columns on `history`, an optional `cycle_start` on the group, and a `joined_cycle` on members that defaults to 1 for everyone already in the group), so existing data is untouched. **Run `npm run db:migrate` against the production database before deploying code that uses them.**
- `npm test` runs the unit and component tests. The database tests run the real migrations on an in-memory Postgres (PGlite), never your database.
- **Look and feel:** frosted-glass cards over a slow-drifting orb backdrop (only `transform` and `opacity` animate; the drift pauses while the tab is hidden). It honours `prefers-reduced-motion` (no drift, tilt, confetti, cascade or digit roll) and `prefers-reduced-transparency` (solid cards), and falls back to solid cards where `backdrop-filter` is unsupported. Setting `data-theme="light"` or `"dark"` on `<html>` forces a colour scheme (handy for design review; there is no toggle in the UI).

- The database starts empty. The admin dashboard prompts you to add members and set the contribution amount.
- The group settings row is created automatically on first load.
- "Close week" records the week in history, marks the recipient as received, clears payments and moves to the next week. When the last member in the cycle is paid out, the cycle resets automatically.
- Removing a member deletes their current-week payment; past history is kept as-is.
- Admin login is rate limited per IP: 5 failed attempts lock that IP out for 15 minutes. IPs are normalised first (`::ffff:` prefix stripped, `::1` = `127.0.0.1`, IPv6 grouped by /64). Attempts are stored in the `login_attempts` table, so it works across serverless instances. A successful login clears the counter.
