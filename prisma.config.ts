import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/database/prisma/schema.prisma",
  migrations: {
    path: "src/database/prisma/migrations",
    // Run compiled output, not ts-node: ts-node's require hook only intercepts
    // `.ts` specifiers, so it can't resolve the generated Prisma client's
    // `.js`-suffixed relative imports (nodenext convention) to their `.ts`
    // siblings. `npm run seed` builds first to keep this in sync.
    seed: "node dist/src/database/prisma/seed.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
