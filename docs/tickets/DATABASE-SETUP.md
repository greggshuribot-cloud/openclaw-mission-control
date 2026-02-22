# DATABASE SETUP - Quick Fix for Development

## Issue
PostgreSQL not running → login hangs indefinitely

## Quick Fix: Switch to SQLite

**1. Update prisma/schema.prisma:**
```prisma
datasource db {
  provider = "sqlite"
}
```

**2. Update .env:**
```env
DATABASE_URL="file:./dev.db"
```

**3. Update src/lib/prisma.ts:**
Remove the PostgreSQL adapter and use vanilla PrismaClient:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**4. Run migrations:**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

**5. Restart dev server:**
```bash
npm run dev
```

Login should now work!
