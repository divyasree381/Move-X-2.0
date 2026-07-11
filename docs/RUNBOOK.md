# MoveX Runbook

Use these commands from the repository root:

```powershell
cd "C:\All folders\Project Files\Move-X-2.0"
```

## 1. Required Tools

Install these first:

- Node.js `20.11+`
- pnpm `11.9.0`
- Docker Desktop
- Git

Install pnpm:

```powershell
npm install --global pnpm@11.9.0
pnpm --version
```

## 2. Install Frontend + Backend Packages

This is a pnpm workspace. Install once at the repo root; it installs backend, frontend, workers, and shared packages.

```powershell
pnpm install
```

Do not run separate `npm install` commands inside `backend/api` or `frontend/web`.

## 3. Start Local Services

Start Postgres, Redis, Meilisearch, Mailpit, and the SMS mock:

```powershell
docker compose up -d
```

Check containers:

```powershell
docker compose ps
```

Useful local service URLs:

- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- Meilisearch: `http://localhost:7700`
- Mailpit UI: `http://localhost:8025`
- SMS mock: `http://localhost:1080`

## 4. Create Environment Files

PowerShell:

```powershell
Copy-Item backend/api/.env.example backend/api/.env
Copy-Item frontend/web/.env.example frontend/web/.env.local
Copy-Item backend/workers/.env.example backend/workers/.env
```

macOS/Linux:

```bash
cp backend/api/.env.example backend/api/.env
cp frontend/web/.env.example frontend/web/.env.local
cp backend/workers/.env.example backend/workers/.env
```

For local development, the defaults are mostly ready. At minimum, confirm these values:

```env
DATABASE_URL=postgresql://movex:movex@localhost:5432/movex?schema=public
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
SMS_PROVIDER=mock
PAYMENT_PROVIDER=mock
SEARCH_PROVIDER=postgres
```

Also set strong local secrets in `backend/api/.env`:

```env
AUTH_HASH_SECRET=replace-with-a-long-random-secret
CONFIG_SECRET_KEY=replace-with-32-byte-config-secret
ADMIN_BOOTSTRAP_TOKEN=replace-with-one-time-setup-token
SESSION_COOKIE_NAME=__Host-movex_session
```

## 5. Prepare Database

Generate Prisma client:

```powershell
pnpm --filter @movex/api db:generate
```

Apply migrations:

```powershell
pnpm --filter @movex/api db:migrate
```

Seed sample users, stores, menu items, and home-service catalog:

```powershell
pnpm --filter @movex/api db:seed
```

## 6. Run The Applications

Run API, frontend, workers, and shared watch tasks through Turbo:

```powershell
pnpm dev
```

Default URLs:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/api/v1/health`
- API docs in non-production: `http://localhost:3001/api/docs`

Run only backend API:

```powershell
pnpm --filter @movex/api dev
```

Run only frontend:

```powershell
pnpm --filter @movex/web dev
```

Run only workers:

```powershell
pnpm --filter @movex/workers dev
```

## 7. Useful Verification Commands

Run these when you are ready to check quality:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run Playwright E2E:

```powershell
pnpm test:e2e
```

Generate OpenAPI client/contracts:

```powershell
pnpm openapi:generate
```

## 8. Production / Full Functional Website Requirements

For a fully functional real website, replace mocks with real services and production-safe configuration.

The complete provider and variable reference is in [`ENVIRONMENT.md`](ENVIRONMENT.md).

### Backend Infrastructure

You need:

- Managed PostgreSQL with PostGIS enabled
- Managed Redis
- Object storage provider for prescription uploads and files
- Production domain names for API and web
- HTTPS everywhere
- Exact CORS allowlist, no wildcard origins

Production backend env must include:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGIN=https://your-frontend-domain.com
SESSION_COOKIE_NAME=__Host-movex_session
AUTH_HASH_SECRET=long-random-secret
CONFIG_SECRET_KEY=long-random-secret
OTP_HASH_SALT=long-random-ride-otp-salt
ORDER_OTP_HASH_SALT=long-random-order-otp-salt
```

### SMS / OTP

Local development uses `SMS_PROVIDER=mock`. Production needs a real SMS gateway:

```env
SMS_PROVIDER=http
SMS_GATEWAY_URL=https://your-sms-provider-endpoint
SMS_GATEWAY_API_KEY=your-real-sms-key
```

### Payments

Local development can use mock payments. Production needs Razorpay:

```env
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

Configure Razorpay webhook to call your backend payment webhook endpoint, and keep the webhook secret server-side only.

### Maps

For real autocomplete, geocoding, and routing:

```env
MAPS_PROVIDER=google
GOOGLE_MAPS_API_KEY=your-server-side-google-maps-key
```

Keep this key only in `backend/api/.env`; do not expose it in frontend env.

### Private Partner Documents

For partner onboarding uploads, create a private Supabase Storage bucket named `movex-private`, then configure only the API:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PRIVATE_BUCKET=movex-private
PARTNER_KYC_SECRET_KEY=replace-with-a-long-random-secret
```

Keep **Public bucket** disabled. Do not add the secret key to the web environment. Apply the Prisma migration before submitting partner verification:

```powershell
pnpm --filter @movex/api exec prisma migrate deploy
```

### Email / Notifications

For production notification email:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-key
NOTIFICATION_EMAIL_FROM="MoveX <notifications@yourdomain.com>"
```

### Search

Start with Postgres search:

```env
SEARCH_PROVIDER=postgres
```

For real search engine mode:

```env
SEARCH_PROVIDER=meilisearch
MEILISEARCH_HOST=https://your-meilisearch-host
MEILISEARCH_API_KEY=your-meilisearch-key
MEILISEARCH_STORE_INDEX=movex_stores
```

Then rebuild the index:

```powershell
pnpm --filter @movex/workers search:rebuild
```

### Observability

For production monitoring:

```env
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=your-release-version
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://your-otel-collector/v1/traces
```

### Admin Security

Staff authentication uses email and scrypt-hashed passwords, verified invitation links, forced temporary-password replacement, role-based permissions, and revocable server-side sessions.

```env
ADMIN_BOOTSTRAP_TOKEN=one-time-random-token
AUTH_HASH_SECRET=same-long-random-secret-on-api-and-workers
WEB_ORIGIN=https://your-frontend-domain.com
```

After creating the first super admin, rotate or remove the bootstrap token. Apply the staff identity migration before inviting staff, run the worker to deliver invitation/reset emails, and configure `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `NOTIFICATION_EMAIL_FROM` in production. Staff MFA remains deliberately deferred and is not part of the active login flow.

### Deployment Targets

Recommended deployment shape:

- `frontend/web`: Vercel
- `backend/api`: container service such as ECS, Cloud Run, Fly.io, Render, Railway, or Kubernetes
- `backend/workers`: separate worker container
- `docker-compose.yml`: local development only

## 9. Common Daily Commands

Start local infra:

```powershell
docker compose up -d
```

Start the app:

```powershell
pnpm dev
```

Stop local infra:

```powershell
docker compose down
```

Reset local database data only when you intentionally want a clean DB:

```powershell
pnpm --filter @movex/api db:migrate
pnpm --filter @movex/api db:seed
```
