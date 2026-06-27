# MoveX

MoveX is a multi-vertical local-services super-app for the Indian market. It brings food delivery, grocery, pharmacy, ride-hailing, courier, and home services into one shared platform.

The product is built around one reusable service spine:

```text
locate -> estimate -> confirm/pay -> match partner -> track -> complete -> rate
```

The same spine is reused across delivery, mobility, courier, and home-service flows instead of building separate systems for each vertical.

## User Roles

MoveX supports eight roles:

- `CUSTOMER`
- `RESTAURANT`
- `DELIVERY`
- `DRIVER`
- `SUPPORT`
- `FINANCE`
- `ADMIN`
- `SUPER_ADMIN`

Permissions are driven by the shared permission matrix in `packages/shared` and enforced by backend guards. Frontend navigation also uses this matrix for role-based UI.

## Tech Stack

### Monorepo

- pnpm workspaces
- Turborepo
- TypeScript strict mode
- Shared package for contracts, enums, schemas, state machines, and permissions

### Backend

- NestJS modular monolith
- PostgreSQL
- Prisma ORM
- PostGIS for geo/location support
- Redis for sessions, OTPs, carts, geo heartbeats, throttling, idempotency, and realtime support
- Pino structured logging
- OpenTelemetry hooks
- Sentry hooks
- Swagger/OpenAPI in non-production

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- Radix/shadcn-style primitives
- TanStack Query
- React Hook Form and Zod patterns for forms/validation
- HttpOnly cookie auth, no auth tokens in browser-readable storage

### Workers

- Background worker app under `backend/workers`
- Outbox processor for notifications, realtime pushes, and search indexing
- At-least-once processing with idempotent handlers

### External Providers

MoveX keeps external services behind provider interfaces so they can be swapped later:

- `SmsProvider`
- `PaymentProvider`
- `MapsProvider`
- `StorageProvider`
- `NotificationProvider`
- `RealtimeProvider`
- `SearchAdapter`
- `PayoutProvider`

Current local development uses mocks where possible. Production should use real providers.

## Repository Layout

```text
backend/
  api/               NestJS API gateway and modular backend
  workers/           Outbox, notification, realtime, and search worker process
  infra/             Dockerfiles for API and workers

frontend/
  web/               Next.js web app
  e2e/               Playwright E2E tests

packages/
  shared/            Shared TypeScript contracts, enums, schemas, permissions, state machines

.github/             GitHub Actions CI/CD workflow
.husky/              Git hooks
RUNBOOK.md           Step-by-step local runbook
README.md            Project overview and onboarding guide
```

## Backend Structure

```text
backend/api/src/
  common/            Guards, decorators, filters, interceptors, middleware, pipes, shared request types
  infrastructure/    Prisma, Redis, SMS, storage, notification providers
  modules/           Business and platform modules
    finance/
    health/
    identity/
    maps/
    marketplace/
    ops/
    orders/
    outbox/
    partner-ops/
    payments/
    platform/
    realtime/
    rides/
    sample/
    trust/
  app.module.ts
  main.ts
  setup-app.ts
```

Important backend conventions:

- All routes are prefixed with `/api`.
- API versioning uses URI versioning, default `v1`.
- Success responses are wrapped in a shared API envelope.
- Exceptions are normalized by a global exception filter.
- Auth, roles, CSRF, validation, throttling, and response wrapping are global concerns.
- Side effects should go through `OutboxEvent`, not inline request logic.
- Ledger entries are the source of truth for money.
- Wallet balances are cached/read-optimized values derived from ledger entries.

## Frontend Structure

```text
frontend/web/src/
  app/               Next.js routes and route groups
  components/        UI primitives and feature components
  hooks/             Client hooks
  lib/               API client, helpers, utility functions
  providers/         App-level React providers
```

Main frontend areas:

- Customer shell
- Partner shell
- Ops console shell
- Marketplace discovery
- Cart and checkout
- Order tracking
- Ride booking and tracking
- Courier booking
- Home-service booking
- Finance and ops pages
- Trust/dispute surfaces

## Shared Package

`packages/shared` contains cross-cutting contracts used by both backend and frontend:

- Enums
- Zod schemas
- API envelope types
- Error-code enum
- Permission matrix
- Location/maps types
- Order, ride, courier, and home-service state machines

Import shared contracts from `@movex/shared`.

## Local Development Setup

See [RUNBOOK.md](./RUNBOOK.md) for the full command-by-command setup.

Short version:

```powershell
pnpm install
docker compose up -d
Copy-Item backend/api/.env.example backend/api/.env
Copy-Item frontend/web/.env.example frontend/web/.env
Copy-Item backend/workers/.env.example backend/workers/.env
pnpm --filter @movex/api db:generate
pnpm --filter @movex/api db:migrate
pnpm --filter @movex/api db:seed
pnpm dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`
- API docs: `http://localhost:3001/api/docs`
- Mailpit: `http://localhost:8025`
- Meilisearch: `http://localhost:7700`

## Root Commands

Run from the repository root.

```powershell
pnpm dev          # Run workspace dev tasks
pnpm build        # Build all packages/apps
pnpm lint         # Lint all packages/apps
pnpm typecheck    # Typecheck all packages/apps
pnpm test         # Run tests across the workspace
pnpm test:e2e     # Run Playwright tests
pnpm format       # Format files with Prettier
```

Package-specific commands:

```powershell
pnpm --filter @movex/api dev
pnpm --filter @movex/web dev
pnpm --filter @movex/workers dev
pnpm --filter @movex/api db:generate
pnpm --filter @movex/api db:migrate
pnpm --filter @movex/api db:seed
pnpm --filter @movex/workers search:rebuild
```

## Local Services

`docker-compose.yml` starts:

- PostgreSQL with PostGIS
- Redis
- Meilisearch
- Mailpit
- SMS mock server

Start services:

```powershell
docker compose up -d
```

Stop services:

```powershell
docker compose down
```

## Environment Files

Local env files are copied from examples:

```text
backend/api/.env.example      -> backend/api/.env
frontend/web/.env.example     -> frontend/web/.env
backend/workers/.env.example  -> backend/workers/.env
```

Important local backend env values:

```env
DATABASE_URL=postgresql://movex:movex@localhost:5432/movex?schema=public
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
SMS_PROVIDER=mock
PAYMENT_PROVIDER=mock
SEARCH_PROVIDER=postgres
AUTH_HASH_SECRET=replace-with-a-long-random-secret
CONFIG_SECRET_KEY=replace-with-32-byte-config-secret
MFA_SECRET_KEY=replace-with-32-byte-mfa-secret
ADMIN_BOOTSTRAP_TOKEN=replace-with-one-time-setup-token
```

Important local frontend env values:

```env
NEXT_PUBLIC_APP_NAME=MoveX
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

## Core Backend Modules

### Identity

Handles:

- Phone OTP login for customer and partner roles
- Staff/admin password login
- Server-side sessions
- HttpOnly cookies
- MFA for staff/admin roles
- User profile
- Address CRUD
- Partner approval and online/location status

### Marketplace

Handles:

- Store discovery
- Store search
- Partner store management
- Menu item management
- Store approvals
- Stock helpers

### Orders

Handles:

- Redis-backed cart
- Server-side pricing
- Coupons
- Checkout transaction
- Stock decrement/restore
- OTP handoffs
- Delivery tracking
- Ratings
- Pharmacy prescription verification
- Grocery/pharmacy substitutions

### Rides / Mobility

Handles:

- Ride estimates
- Driver matching
- Ride lifecycle
- Courier bookings
- Home-service bookings
- OTP verification
- Partner queues
- Fare and cancellation calculations

### Payments and Finance

Handles:

- Razorpay provider adapter
- Payment orders
- Webhook processing
- Refunds
- Ledger entries
- Wallet balance reconciliation
- Payout sweeps
- Invoices
- Reconciliation reports

### Realtime and Outbox

Handles:

- Topic authorization
- Server-sent realtime updates
- Standard domain events
- Worker-driven notification and realtime dispatch

### Ops and Platform

Handles:

- Admin/staff console APIs
- User management
- Store/partner approvals
- Coupons
- System config
- Support tickets
- Audit logs
- Feature flags
- Analytics projections
- Search rebuild requests

## Production Requirements

To make MoveX fully functional in production, configure real providers and infrastructure.

Required infrastructure:

- Production PostgreSQL with PostGIS
- Production Redis
- Object storage for uploads/prescriptions
- HTTPS API domain
- HTTPS web domain
- Exact CORS allowlist
- Container hosting for API
- Separate container/process for workers
- Vercel or equivalent for frontend

Required provider credentials:

```env
# SMS
SMS_PROVIDER=msg91
SMS_GATEWAY_URL=...
SMS_GATEWAY_API_KEY=...

# Payments
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Maps
MAPS_PROVIDER=google
GOOGLE_MAPS_API_KEY=...

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
NOTIFICATION_EMAIL_FROM="MoveX <notifications@yourdomain.com>"

# Search, optional but recommended
SEARCH_PROVIDER=meilisearch
MEILISEARCH_HOST=...
MEILISEARCH_API_KEY=...
MEILISEARCH_STORE_INDEX=movex_stores

# Observability
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=...
```

Production safety requirements:

- `NODE_ENV=production`
- Strong `AUTH_HASH_SECRET`, `CONFIG_SECRET_KEY`, and `MFA_SECRET_KEY`
- `SESSION_COOKIE_NAME` must use the `__Host-` prefix
- `SMS_PROVIDER=mock` must not be used
- `PAYMENT_PROVIDER=mock` must not be used
- CORS must use exact production origins only
- Staff/admin MFA should be enabled
- Razorpay webhook signature verification must be configured

## Testing and Quality

Quality commands:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

CI runs install, lint, typecheck, tests, OpenAPI generation, build, and Playwright E2E.

## Development Rules

When adding features:

- Keep shared contracts in `packages/shared`.
- Validate request boundaries with DTOs/Zod patterns.
- Keep external services behind provider interfaces.
- Write money movements through the ledger.
- Do not trust client-side pricing or amounts.
- Emit side effects through outbox events.
- Reuse the shared service spine instead of copy-pasting vertical-specific flows.
- Keep frontend route files thin; put real UI in feature components.
- Keep backend domain code in `backend/api/src/modules`.

## First Files To Read

For a new developer, start here:

1. `RUNBOOK.md`
2. `packages/shared/src/index.ts`
3. `packages/shared/src/permissions.ts`
4. `packages/shared/src/state-machines.ts`
5. `backend/api/src/app.module.ts`
6. `backend/api/src/setup-app.ts`
7. `backend/api/prisma/schema.prisma`
8. `frontend/web/src/app/(app)/layout.tsx`
9. `frontend/web/src/lib/api.ts`