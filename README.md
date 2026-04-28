# Backstop

Operations platform for independent baseball coaches. Bookings, players, and money in one dashboard.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL via Prisma
- NextAuth (credentials)
- Tailwind CSS
- Recharts
- Deployable to Vercel + Neon

## Local setup

```bash
# 1. Install
npm install

# 2. Set up env
cp .env.example .env
# edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# 3. Generate Prisma client + push schema
npx prisma migrate dev --name init

# 4. Run
npm run dev
```

Visit http://localhost:3000.

## Deploy to Vercel + Neon

### 1. Create Neon database

1. Go to https://neon.tech, create a project
2. Copy the **pooled** connection string (the one with `-pooler` in the host)
3. This is your `DATABASE_URL`

### 2. Push to Vercel

1. Push this repo to GitHub
2. Import into Vercel
3. Add these env vars in Vercel project settings:
   - `DATABASE_URL` — your Neon pooled connection string
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32` to generate
   - `NEXTAUTH_URL` — your production URL, e.g. `https://app.backstopapp.com`
   - `ADMIN_EMAIL` — `founder@backstopapp.com` (or whatever you want)

### 3. Apply schema to production

The build script runs `prisma migrate deploy` automatically. The first deploy will run your migrations against Neon.

If you used `prisma db push` locally instead of `migrate dev`, run this once to create a baseline migration:

```bash
npx prisma migrate dev --name init
git add prisma/migrations
git commit -m "add initial migration"
git push
```

### 4. Custom domain

Point `app.backstopapp.com` at Vercel via CNAME. Update `NEXTAUTH_URL` to match.

## Architecture notes

- **Conflict prevention**: `@@unique([coachId, startTime])` + a transactional overlap check in `lib/booking.ts`. Two simultaneous bookings on the same slot can't both succeed.
- **Player dedup**: `lib/player.ts` matches on phone first (digits only), then email. Returning players with new contact info get fields backfilled.
- **Slug generation**: `lib/slug.ts` — auto-generated from name, falls back to numeric suffixes, blocks reserved words.
- **Admin gate**: `lib/auth.ts` exports `isAdminEmail()` — checks against `ADMIN_EMAIL` env var. Change without redeploy.
- **Money**: All amounts stored as integer cents to avoid float drift.
- **Times**: Stored as UTC. v1 ships without per-coach timezone — fine for single-region deployment, add later if you go national.

## Routes

| Route | Who |
| --- | --- |
| `/` | Marketing |
| `/signup` `/login` | Auth |
| `/dashboard/*` | Coach |
| `/book/[slug]` | Public (players) |
| `/admin` | Founder only |

## What's intentionally NOT here

Per spec: no payment processing, no SMS, no file uploads, no video, no subscriptions, no marketplace, no analytics platform. Add a GHL webhook to `/api/public/[slug]/book/route.ts` if you want booking notifications later — it's a 5-line addition.
