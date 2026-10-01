# Threat Feed Service — Scaffold Plan

Design decisions locked in during review:
- Postgres + Prisma, UUID primary keys everywhere; every relation is a real FK column, not a loose string
- Prisma schema/migrations/seed live under `src/database/prisma/` (not root `prisma/`)
- NestJS (latest), global prefix `api/v1`, Swagger
- Bearer/JWT auth, RBAC via `roles` + `permissions` (method + path based), single role per user
- `sources` table holds ingestion provider configs (`name`, `type`, `params` jsonb — e.g. source URL/auth); `jobs` reference a `source` instead of embedding config inline, and `feeds` reference a `source` for provenance (replacing the earlier `job_execution_id` FK — a feed's *origin* is its source, not the run that last touched it)
- Jobs run on BullMQ + Redis; `job_executions` records one row per queue run
- Writes wrapped in Prisma `$transaction`, with domain events emitted before (validation-only) and **after commit** (never from inside the transaction)
- Modules communicate via `@nestjs/event-emitter`, not direct cross-module service injection
- Redis-backed cache module (`src/cache/`) available app-wide via `CACHE_MANAGER`
- Job execution is generic: a `collection-worker` BullMQ processor resolves a `Collector` strategy by `source.type` and runs it — the *first* collector implemented is `phishing-database`, targeting the [Phishing.Database](https://github.com/Phishing-Database/Phishing.Database) raw text lists (see §7)
- Every new module lives under `src/modules/<name>`

---

## 1. Project structure

```
threat-feed/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/          # @CurrentUser, @RequirePermission
│   │   ├── filters/             # global HttpExceptionFilter
│   │   ├── guards/              # JwtAuthGuard, PermissionsGuard
│   │   ├── interceptors/        # logging/response interceptors
│   │   ├── pipes/               # validation config
│   │   └── events/              # base event classes, event name constants
│   ├── config/
│   │   ├── configuration.ts     # @nestjs/config schema (db, jwt, redis, cache)
│   │   └── validation.schema.ts # joi/zod env validation
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts    # extends PrismaClient, handles $transaction helper
│   ├── cache/
│   │   ├── cache.module.ts      # CacheModule.registerAsync, Redis (Keyv) store, global
│   │   └── cache.constants.ts   # key prefixes/TTL constants
│   ├── modules/
│   │   ├── auth/                # users, roles, permissions, login/refresh
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── permissions/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/      # jwt.strategy.ts, local.strategy.ts
│   │   │   └── events/          # user.created, user.updated, ...
│   │   ├── feeds/
│   │   │   ├── feeds.module.ts
│   │   │   ├── feeds.controller.ts
│   │   │   ├── feeds.service.ts
│   │   │   ├── dto/
│   │   │   └── events/          # feed.created, feed.updated, feed.deleted
│   │   ├── sources/
│   │   │   ├── sources.module.ts
│   │   │   ├── sources.controller.ts
│   │   │   ├── sources.service.ts
│   │   │   ├── dto/
│   │   │   └── events/          # source.created, source.updated, source.deleted
│   │   └── jobs/
│   │       ├── jobs.module.ts
│   │       ├── jobs.controller.ts
│   │       ├── jobs.service.ts
│   │       ├── job-executions/
│   │       ├── queues/          # queue registration
│   │       ├── collection-worker/
│   │       │   ├── collection-worker.module.ts
│   │       │   ├── collection-worker.processor.ts  # generic BullMQ processor
│   │       │   └── collectors/
│   │       │       ├── collector.interface.ts       # fetch(source) -> RawIndicator[]
│   │       │       ├── collector.registry.ts         # source.type -> Collector
│   │       │       └── phishing-database.collector.ts
│   │       └── events/          # job_execution.started, job_execution.completed
│   └── health/
│       └── health.module.ts     # @nestjs/terminus
├── test/
│   └── **/*.e2e-spec.ts
├── .env.example
├── docker-compose.yml           # postgres + redis for local dev
├── nest-cli.json
├── package.json
├── tsconfig.json
└── PLAN.md
```

---

## 2. Dependencies

**Core**
```
@nestjs/core @nestjs/common @nestjs/platform-express
@nestjs/config @nestjs/swagger @nestjs/terminus
@nestjs/event-emitter
@nestjs/passport passport passport-jwt
@nestjs/jwt
@nestjs/bullmq bullmq ioredis
@nestjs/axios axios        # HTTP fetch for collectors (e.g. phishing-database raw text lists)
@nestjs/cache-manager cache-manager @keyv/redis  # cache module (Redis-backed)
@prisma/client
class-validator class-transformer
bcrypt
nestjs-pino pino-http   # structured logging
```

**Dev**
```
prisma
@nestjs/cli @nestjs/testing @nestjs/schematics
jest ts-jest supertest
@types/passport-jwt @types/bcrypt
```

---

## 3. Prisma schema (target shape)

Schema lives at `src/database/prisma/schema.prisma`. Prisma CLI needs to be told where to find it — add to `package.json`:
```json
"prisma": { "schema": "src/database/prisma/schema.prisma" }
```
All CLI commands (`generate`, `migrate dev`, `db seed`) then run unmodified from the repo root.

Every table below has a UUID primary key, and every reference to another table is a first-class Prisma relation (real FK column + constraint) — no bare "id string" columns standing in for a relationship.

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

enum FeedType { DOMAIN IPV4 IPV6 URL }
enum JobStatus { PENDING RUNNING SUCCESS FAILED }

model Feed {
  id           String    @id @default(uuid())
  value        String
  type         FeedType
  confidence   Int?
  severity     String?
  tags         String[]
  isActive     Boolean   @default(true) @map("is_active")
  expiresAt    DateTime? @map("expires_at")
  sourceId     String    @map("source_id")
  source       Source    @relation(fields: [sourceId], references: [id])
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@unique([value, type])
  @@index([type])
  @@index([sourceId])
  @@map("feeds")
}

model Source {
  id        String   @id @default(uuid())
  name      String   @unique
  type      String   // e.g. http_json, csv_url, stix_taxii, misp, manual
  params    Json     // source-specific config: url, auth, headers, format, ...
  isActive  Boolean  @default(true) @map("is_active")
  feeds     Feed[]
  jobs      Job[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("sources")
}

model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String   @map("password_hash")
  isActive       Boolean  @default(true) @map("is_active")
  firstname      String?
  lastname       String?
  roleId         String   @map("role_id")
  role           Role     @relation(fields: [roleId], references: [id])
  lastLoginAt    DateTime? @map("last_login_at")
  failedLoginAttempts Int  @default(0) @map("failed_login_attempts")
  createdJobs    Job[]
  deletedAt      DateTime? @map("deleted_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Role {
  id          String       @id @default(uuid())
  name        String
  key         String       @unique
  users       User[]
  permissions Permission[]
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@map("roles")
}

model Permission {
  id        String   @id @default(uuid())
  key       String   // read | write | *
  method    String   // GET | POST | PUT | DELETE | *
  path      String   // /feeds, /feeds/*, ...
  roleId    String   @map("role_id")
  role      Role     @relation(fields: [roleId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("permissions")
}

model Job {
  id           String    @id @default(uuid())
  name         String
  type         String
  sourceId     String    @map("source_id")
  source       Source    @relation(fields: [sourceId], references: [id])
  schedule     String?   // cron expression, null = manual only
  isActive     Boolean   @default(true) @map("is_active")
  lastRunAt    DateTime? @map("last_run_at")
  nextRunAt    DateTime? @map("next_run_at")
  createdById  String?   @map("created_by")
  createdBy    User?     @relation(fields: [createdById], references: [id])
  executions   JobExecution[]
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("jobs")
}

model JobExecution {
  id               String    @id @default(uuid())
  jobId            String    @map("job_id")
  job              Job       @relation(fields: [jobId], references: [id])
  status           JobStatus @default(PENDING)
  startedAt        DateTime? @map("started_at")
  finishedAt       DateTime? @map("finished_at")
  recordsProcessed Int       @default(0) @map("records_processed")
  recordsCreated   Int       @default(0) @map("records_created")
  recordsUpdated   Int       @default(0) @map("records_updated")
  recordsFailed    Int       @default(0) @map("records_failed")
  errorMessage     String?   @map("error_message")
  triggeredBy      String    @default("scheduled") @map("triggered_by")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@map("job_executions")
}
```

---

## 4. Cross-cutting concerns

- **Transactions + events**: `PrismaService` exposes a `runInTransaction(work)` helper. Services call it, collect "after" events during the callback, and only `eventEmitter.emit(...)` them once the transaction promise resolves successfully. "Before" events (validation/enrichment only, no DB writes) fire prior to entering the transaction.
- **Auth guard**: global `JwtAuthGuard` (via `APP_GUARD`) validates the bearer token; a `PermissionsGuard` + `@RequirePermission(method, path)` decorator checks the caller's role against the `permissions` table.
- **Logging**: `nestjs-pino` as the Nest logger, request-id correlation via middleware, structured JSON logs.
- **Validation**: global `ValidationPipe({ whitelist: true, transform: true })`.
- **Errors**: global `HttpExceptionFilter` normalizes error responses (`{ statusCode, message, error, path, timestamp }`).
- **Swagger**: mounted at `/api/docs`, bearer auth scheme registered, generated from DTOs.
- **Health**: `/api/v1/health` via Terminus, checks Postgres + Redis.
- **Cache**: `CacheModule` (global, `@nestjs/cache-manager` + `@keyv/redis`, same Redis instance as BullMQ but a separate logical DB index) exposed app-wide. Used for hot read paths — e.g. `FeedsService.findByValue` and permission lookups in `PermissionsGuard` — with explicit TTLs and cache invalidation triggered from the `feed.updated`/`feed.deleted`/`permission.updated` event listeners (never left to expire silently on writes).
- **Testing**: Jest unit tests per service/controller (mocked Prisma), e2e suite hitting a test Postgres via `docker-compose`, coverage threshold enforced in `package.json`.

---

## 5. BullMQ job flow

1. `POST /api/v1/jobs/:id/run` (or cron trigger) → `JobsService` loads the job's `Source` (for `type`/`params`), creates a `JobExecution` row (`PENDING`), and enqueues a BullMQ job with `{ jobId, executionId, sourceId }` on the `collection` queue.
2. `CollectionWorkerProcessor` (`modules/jobs/collection-worker/`) picks it up, flips execution to `RUNNING`, resolves a `Collector` from the registry by `source.type`, and calls `collector.fetch(source)` → `RawIndicator[]`. See §7 for the first collector (`phishing-database`).
3. The processor upserts the returned indicators into `feeds` with `sourceId` set to that source (unique on `value+type`, incrementing `recordsCreated`/`recordsUpdated`/`recordsFailed`). `job_executions` stays pure run-tracking (status/timing/counts) — it is not referenced by `feeds`.
4. On completion, the processor updates the execution row (`SUCCESS`/`FAILED`, `finishedAt`, counts, `errorMessage`), then emits `job_execution.completed` **after** that update commits.
5. `FeedsModule` (or any listener) reacts to `job_execution.completed` without the jobs module knowing who's listening.

---

## 6. Phishing Database collector

First concrete `Collector` implementation, targeting the [Phishing.Database](https://github.com/Phishing-Database/Phishing.Database) project's raw newline-delimited text lists on GitHub. Each URL becomes its own `Source` row (`type = "phishing_database"`), so it gets its own schedule, its own `job`, and its own `job_executions` history — a bad/slow file doesn't block the others.

**Source seed data** (`params.url`, `params.indicatorType` → `FeedType`, `params.status`):

| URL (raw.githubusercontent.com/.../master/...) | indicatorType | status |
|---|---|---|
| `phishing-IPs-ACTIVE.txt` | IPV4 | ACTIVE |
| `phishing-IPs-INACTIVE.txt` | IPV4 | INACTIVE |
| `phishing-IPs-INVALID.txt` | IPV4 | INVALID |
| `phishing-ips-NEW-today.txt` | IPV4 | ACTIVE (delta) |
| `phishing-domains-ACTIVE.txt` | DOMAIN | ACTIVE |
| `phishing-domains-INACTIVE.txt` | DOMAIN | INACTIVE |
| `phishing-domains-INVALID.txt` | DOMAIN | INVALID |
| `phishing-domains-NEW-today.txt` | DOMAIN | ACTIVE (delta) |
| `phishing-links-ACTIVE.txt` | URL | ACTIVE |
| `phishing-links-ACTIVE-NOW.txt` | URL | ACTIVE (delta) |
| `phishing-links-ACTIVE-today.txt` | URL | ACTIVE (delta) |
| `phishing-links-NEW-today.txt` | URL | ACTIVE (delta) |
| `phishing-links-INACTIVE.txt` | URL | INACTIVE |
| `phishing-links-INVALID.txt` | URL | INVALID |

- `status → feeds.isActive`: `ACTIVE` maps to `true`; `INACTIVE`/`INVALID` map to `false`. The `INVALID` lists exist specifically to demote previously-ingested entries that turned out to be false positives, so the collector must still upsert them (not skip them) — that's what flips a stale `feeds` row back to `isActive: false`.
- The `-NEW-today` / `-ACTIVE-today` / `-ACTIVE-NOW` files are deltas already covered by the corresponding full `ACTIVE` list. Give them their own `Job`/`Source` on a **short cadence** (e.g. hourly cron) for freshness, and run the full `ACTIVE`/`INACTIVE`/`INVALID` lists on a **daily cron** as the reconciliation pass. Both write to the same `feeds` rows (unique on `value+type`), so there's no duplication risk, only redundant work — acceptable for freshness.

**`PhishingDatabaseCollector`** (`implements Collector`):
```ts
supports(sourceType: string) { return sourceType === 'phishing_database'; }

async fetch(source: Source): Promise<RawIndicator[]> {
  const { url, indicatorType, status } = source.params as PhishingDbParams;
  const { data: text } = await this.httpService.axiosRef.get<string>(url, { responseType: 'text', timeout: 15_000 });
  const isActive = status === 'ACTIVE';
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value) => ({ value, type: indicatorType, isActive }));
}
```

**Perf note**: `phishing-links-ACTIVE.txt` alone can run tens of thousands of lines. Don't upsert row-by-row inside a loop — batch into chunks (e.g. 1,000 rows) and either (a) run chunked `prisma.feed.upsert` calls inside `Promise.all` per chunk, or (b) use a raw `INSERT ... ON CONFLICT (value, type) DO UPDATE` with a multi-row `VALUES` list per chunk for real bulk-upsert performance. Pick (b) if the daily full-reconciliation job is slow in practice.

---

## 7. Scaffold steps (execution order)

1. `nest new . --package-manager npm --skip-git` (repo has no git yet — confirm before running)
2. `npm install` the dependency list above
3. `npx prisma init --schema src/database/prisma/schema.prisma`, set `"prisma": { "schema": "..." }` in `package.json`, replace generated schema with section 3, add `.env` with `DATABASE_URL`
4. `docker-compose.yml` for local Postgres + Redis
5. Scaffold `common/`, `config/`, `database/` (PrismaModule/PrismaService)
6. Scaffold `cache/` (CacheModule.registerAsync with Redis/Keyv store, marked `@Global()`)
7. `nest g module modules/auth` + users/roles/permissions sub-resources, JWT strategy, guards
8. `nest g module modules/sources` with CRUD + DTOs (feeds and jobs both depend on it existing first)
9. `nest g module modules/feeds` with CRUD + DTOs
10. `nest g module modules/jobs` with BullMQ registration, job-executions sub-resource, and `collection-worker/` (generic processor + `Collector` interface/registry)
11. Implement `PhishingDatabaseCollector` and register it in the collector registry (§6)
12. Wire `main.ts`: global prefix `api/v1`, Swagger, ValidationPipe, exception filter, pino logger
13. `npx prisma migrate dev --name init`
14. `src/database/prisma/seed.ts`: default roles (`admin`, `viewer`), wildcard permissions for admin, one bootstrap admin user, the 14 `phishing_database` `Source` rows + one `Job` per source (§6 table)
15. First unit tests for each module's service (happy path + one failure path), plus `PhishingDatabaseCollector` (mocked HTTP response → parsed `RawIndicator[]`)

---

## Open items to confirm before/while building
- Exact env vars needed (`DATABASE_URL`, `REDIS_HOST/PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_TTL`)
- Refresh token storage (DB table vs stateless rotation) — not yet designed
- Rate limiting package (`@nestjs/throttler`) — not yet added to dependency list, add if needed
