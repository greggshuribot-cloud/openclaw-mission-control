# OpenClaw Mission Control

Founder Mode operating system for orchestrating a multi-agent AI startup team in a persistent virtual office.

## Stack
- Next.js 16 (App Router)
- Tailwind CSS
- Zustand state
- React Flow (dependency map)
- Prisma + PostgreSQL

## Local Setup
```bash
npm install
cp .env.example .env   # if needed
npm run dev
```

## Database (Prisma + Postgres)
1. Set `DATABASE_URL` in `.env`
2. Create migration:
```bash
npx prisma migrate dev --name init
```
3. Generate client:
```bash
npx prisma generate
```

## Auth Setup (Milestone 1)
Set these env vars in `.env`:
- `SESSION_SECRET` (long random string, at least 32 chars)
- `FOUNDER_EMAIL`
- `FOUNDER_PASSWORD`

Example:
```env
SESSION_SECRET="replace-with-a-long-random-secret"
FOUNDER_EMAIL="founder@openclaw.com"
FOUNDER_PASSWORD="replace-with-a-strong-password"
MONTHLY_CAP_UNITS="10000"
CURRENT_USED_UNITS="2500"
```

First login behavior:
- On the first successful login attempt using `FOUNDER_EMAIL`, the app auto-creates the founder row in `users` if it does not exist yet.
- Passwords are stored as `scrypt` hashes in `password_hash`.

Auth routes:
- `POST /api/auth/login`
- `POST /api/auth/logout`

Route protection:
- `/` requires a valid session cookie and redirects to `/login` when unauthenticated.

## Current Scope (v0 Scaffold)
- Main navigation tabs
- Office Home view with zones + live agent state
- Company Meeting toggle (state freeze/teleport)
- Dispatch tab stubs
- Current Sprint dependency graph (React Flow)
- Prisma schema from PRD base tables

## Next Milestones
1. Auth + founder session
2. Real task/proposal CRUD backed by Postgres
3. PM gatekeeper flow (Approve/Reject)
4. PixiJS rendering upgrade for office canvas
5. Treasury burn-rate calculations + alerts
