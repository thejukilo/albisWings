# Albis Wings — Crew Portal (Demo)

A Next.js + Supabase prototype of the flight school management platform.
This demo includes the **Check-in dashboard** matching the layout of the
existing system, with login, currency warnings, OPS news, general news,
events, quicklinks, and a personal reservation list.

## Stack

- **Next.js 15** (App Router, Server Components)
- **TypeScript**
- **Tailwind CSS** with a custom aviation-inspired theme
- **Supabase** for auth + Postgres backend
- Designed to deploy to **Vercel free tier**

---

## Local setup

### Prerequisites

- Node.js 18+ (Vercel and Next.js 15 require it)
- Your Supabase project, already loaded with:
  - `flightschool_supabase.sql` (schema)
  - `seed_demo.sql` (demo data)
  - `10_auth_and_rls.sql` (RLS policies)
- An auth user linked to a `public.users` row (see Step 5 in the main thread)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in your Supabase project values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ROTATED_ANON_KEY
```

Find both in your Supabase dashboard under **Project Settings → API**.

> **Use the `anon` key, NOT the `service_role` key.** The anon key is safe
> to expose in the frontend because RLS policies enforce access control.
> The service_role key bypasses RLS and must NEVER be in client code.

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`. Use the
email + password of the Supabase Auth user you created earlier.

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: AW crew portal demo"
gh repo create aw-demo --private --source=. --push
# Or via GitHub UI: create empty repo, then:
# git remote add origin git@github.com:YOU/aw-demo.git
# git branch -M main
# git push -u origin main
```

### 2. Import to Vercel

1. Go to <https://vercel.com/new>
2. Select your GitHub repo
3. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as `.env.local`
4. Click **Deploy**

You'll get a live URL like `https://aw-demo.vercel.app` in ~60 seconds.

### 3. Configure Supabase redirect URLs

In Supabase dashboard → **Authentication → URL Configuration**:

- Add your Vercel URL to **Site URL** and **Redirect URLs**:
  - `https://aw-demo.vercel.app`
  - `https://aw-demo.vercel.app/**`

Without this, auth redirects after login won't work.

---

## What's on the dashboard

| Section | Source data |
|---------|-------------|
| Currency banner | Aggregates `flight_pilots.landings_logged` over last 90 days for SEP class |
| OPS News | `news_posts` where `category = 'ops'` |
| General News | `news_posts` where `category = 'general'` |
| Events | `news_posts` where `category = 'event'` and `event_starts_at > now()` |
| Open techlog | `v_open_techlog` view, rows with open defects |
| My reservations | `v_reservation_grid` view, filtered to current user |
| Quicklinks | Hard-coded list (move to DB later if you want them editable) |

---

## Project structure

```
src/
├── app/
│   ├── globals.css        Tailwind + aviation theme + paper-grain background
│   ├── layout.tsx         Root layout
│   ├── page.tsx           THE check-in dashboard
│   ├── login/page.tsx     Compass-rose login screen
│   └── actions.ts         Server actions (sign out)
├── components/
│   └── TopNav.tsx         Header + navigation
├── lib/supabase/
│   ├── client.ts          Browser Supabase client
│   └── server.ts          Server Supabase client (RSC + Server Actions)
└── middleware.ts          Refreshes auth tokens, redirects logged-out users
```

---

## What's next

Possible additions in priority order:

1. **Reservation grid** — the big multi-aircraft Gantt screen (`/reservations`)
2. **Techlog detail** — per-aircraft view with defect history (`/techlog/[reg]`)
3. **Flightlog detail** — per-aircraft + personal logbook (`/flightlog`)
4. **Training progress** — Lode's PPL syllabus view with the modal (`/training`)
5. **News editor** — for ops_manager / admin (`/admin/news`)
6. **FlyDrive** — file browser with role-based permissions (`/drive`)

Each is a separate route + a few queries. None requires more than a day's work.
