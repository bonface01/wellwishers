# Contribution Circle

A small web app for a WhatsApp savings group. Members each contribute a fixed amount per week to a finance person, who pays the whole pot to one member each week.

- **Public page (`/`)** – read-only: this week's recipient, who has paid, payout order, past weeks. No login.
- **Admin (`/admin`)** – for the finance person: settings, members, payment checklist, close week, WhatsApp update.

**Payout order:** full first name A–Z (case-insensitive). Only members with exactly the same first name are ordered by second name. When everyone has received, a new cycle starts from the top.

**Currency:** defaults to `KSh` and is shown before the amount everywhere, e.g. `KSh 1,000`.

**Joining mid-cycle:** in Settings set the current week number, then on the Members tab mark who has already received this cycle.

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
- `npm test` runs the unit and component tests.
- **Look and feel:** frosted-glass cards over a slow-drifting orb backdrop (only `transform` and `opacity` animate; the drift pauses while the tab is hidden). It honours `prefers-reduced-motion` (no drift, tilt, confetti, cascade or digit roll) and `prefers-reduced-transparency` (solid cards), and falls back to solid cards where `backdrop-filter` is unsupported. Setting `data-theme="light"` or `"dark"` on `<html>` forces a colour scheme (handy for design review; there is no toggle in the UI).

- The database starts empty. The admin dashboard prompts you to add members and set the contribution amount.
- The group settings row is created automatically on first load.
- "Close week" records the week in history, marks the recipient as received, clears payments and moves to the next week. When the last member in the cycle is paid out, the cycle resets automatically.
- Removing a member deletes their current-week payment; past history is kept as-is.
- Admin login is rate limited per IP: 5 failed attempts lock that IP out for 15 minutes. IPs are normalised first (`::ffff:` prefix stripped, `::1` = `127.0.0.1`, IPv6 grouped by /64). Attempts are stored in the `login_attempts` table, so it works across serverless instances. A successful login clears the counter.
