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
