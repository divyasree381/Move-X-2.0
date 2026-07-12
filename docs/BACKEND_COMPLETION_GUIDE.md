# MoveX Backend Completion Guide

This document explains what remains before the MoveX backend can run as a complete production system. It is based on the repository as audited on 12 July 2026.

Use it together with:

- [`README.md`](../README.md) for the project overview and local commands.
- [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md) for environment-file rules.
- [`docs/RUNBOOK.md`](./RUNBOOK.md) for routine operational commands.
- [`backend/api/.env.example`](../backend/api/.env.example) for API variables.
- [`backend/workers/.env.example`](../backend/workers/.env.example) for worker variables.
- [`frontend/web/.env.example`](../frontend/web/.env.example) for browser-safe variables.

## 1. Current Backend Status

The backend is not an empty skeleton. The following foundations already exist:

| Capability                                                                          | Current status                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| NestJS API, validation, response envelope, guards, CSRF, throttling and logging     | Implemented                                             |
| PostgreSQL/PostGIS schema and Prisma migrations                                     | Implemented                                             |
| Redis sessions, OTP challenges, carts, geo data, idempotency and realtime transport | Implemented                                             |
| Customer and partner OTP authentication                                             | Implemented                                             |
| Staff password authentication, invitations and permissions                          | Implemented                                             |
| Partner KYC metadata and private document-storage adapter                           | Implemented; provider setup required                    |
| Food, grocery, pharmacy, ordering, rides, courier and home services                 | Core backend flows implemented                          |
| Razorpay payment order, refund and webhook handling                                 | Implemented; live account setup required                |
| Ledger, wallet reconciliation, invoices and payout workflow                         | Implemented, but real payout/settlement adapters remain |
| Outbox worker, notifications, realtime events and search indexing                   | Implemented; worker must be deployed continuously       |
| Sentry and OpenTelemetry hooks                                                      | Implemented; external projects/collector required       |
| CI for install, migration, lint, typecheck, test, OpenAPI, build and Playwright     | Implemented                                             |

The system is ready for integration work, but it should not be called production-ready until every **Launch blocker** below is completed.

## 2. Priority Legend

- **Launch blocker:** required before accepting real users or money.
- **Production hardening:** required before public scale, but can follow a controlled internal staging launch.
- **Future capability:** optional until that feature is advertised or enabled.

## 3. Launch Blockers

Complete these in order:

1. Provision production PostgreSQL/PostGIS and Redis.
2. Create production domains, HTTPS and exact CORS allowlists.
3. Generate and store strong application secrets.
4. Create the private Supabase Storage bucket for KYC documents.
5. Connect a real Indian SMS/OTP provider.
6. Complete Razorpay live-account and webhook configuration.
7. Configure transactional email.
8. Deploy the API and worker as separate continuously running services.
9. Replace mock payout and settlement providers before automated partner payouts.
10. Add database/Redis/worker readiness checks and monitoring alerts.
11. Configure backups and perform a restore drill.
12. Complete staff MFA before staff accounts are exposed in production.

## 4. Environment Ownership

Never place a secret in a variable beginning with `NEXT_PUBLIC_`.

| Environment              | Where it belongs                       | Important values                                                                                       |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| API secrets              | API hosting platform secret manager    | Database, Redis, auth/encryption secrets, SMS, maps, storage, Razorpay, email, search, Sentry and OTEL |
| Worker secrets           | Worker hosting platform secret manager | Database, Redis, shared auth hash secret, notification, search, Sentry and OTEL                        |
| Web public configuration | Vercel project environment             | API base URL, Razorpay public key ID, CSRF cookie name                                                 |
| Local API                | `backend/api/.env`                     | Local or sandbox values only                                                                           |
| Local worker             | `backend/workers/.env`                 | Local or sandbox values only                                                                           |
| Local web                | `frontend/web/.env.local`              | Browser-safe local values only                                                                         |

The API and worker must use the same `DATABASE_URL`, `REDIS_URL` and `AUTH_HASH_SECRET`. Do not share unrelated API-only secrets with the web app.

## 5. Generate Application Secrets

Generate a different random value for every secret. Run this PowerShell block once per value:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

Generate separate values for:

- `AUTH_HASH_SECRET`
- `CONFIG_SECRET_KEY`
- `PARTNER_KYC_SECRET_KEY`
- `OTP_HASH_SALT`
- `ORDER_OTP_HASH_SALT`
- `ADMIN_BOOTSTRAP_TOKEN`
- `MFA_SECRET_KEY` when MFA is completed

Store them in the hosting provider's encrypted secret manager. Do not commit them, paste them into documentation, or send them in chat.

## 6. PostgreSQL And PostGIS

### What MoveX uses it for

Users, stores, orders, rides, ledger entries, payouts, invoices, KYC metadata, audit logs, outbox events and all durable business data.

### Recommended setup

The current Supabase PostgreSQL database is suitable. In Supabase:

1. Open the project dashboard.
2. Go to **Project Settings > Database**.
3. Copy the production connection string intended for server workloads.
4. Use SSL and keep the password only in API/worker secrets.
5. Confirm the PostGIS extension is enabled.
6. Enable automatic backups and point-in-time recovery if the selected plan supports it.

Set the same value in API and worker environments:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require
```

Apply migrations as a one-off deployment step, not concurrently from every API replica:

```powershell
pnpm --filter @movex/api exec prisma migrate deploy
```

Verify:

```powershell
pnpm --filter @movex/api exec prisma migrate status
```

Before production launch, take a backup and restore it into a separate test project. A backup that has never been restored is not yet a proven recovery plan.

## 7. Redis

### What MoveX uses it for

Sessions, OTP challenges, request throttling, cart state, geo/heartbeat data, webhook locks, idempotency and realtime/outbox coordination.

### How to obtain it

Use a managed Redis service such as Upstash, Redis Cloud, AWS ElastiCache or the Redis service offered by the API host. Choose a region close to PostgreSQL and the API.

Set in both API and worker:

```env
REDIS_URL=rediss://default:PASSWORD@HOST:PORT
```

Production requirements:

- TLS enabled (`rediss://`) where supported.
- Authentication enabled.
- No public unrestricted network access.
- Persistence/backup policy appropriate for the provider.
- Memory and eviction alerts configured.

If Redis is unavailable, login, carts, throttling and matching are affected. Treat it as a critical dependency.

## 8. Private KYC Document Storage

### What MoveX uses it for

Store images, live partner photos, licenses, Aadhaar/PAN proofs and other approval documents. PostgreSQL stores metadata; object storage stores the file bytes.

### Supabase setup

1. Open **Supabase > Storage**.
2. Create a bucket named `movex-private`.
3. Keep **Public bucket** disabled.
4. Do not create anonymous read policies for this bucket.
5. In **Project Settings > API Keys**, copy a backend secret/service-role key.
6. Put that key only in the API secret manager.

API configuration:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_BACKEND_SECRET_OR_SERVICE_ROLE_KEY
SUPABASE_PRIVATE_BUCKET=movex-private
PARTNER_KYC_SECRET_KEY=YOUR_SEPARATE_RANDOM_SECRET
```

The frontend must upload and retrieve KYC documents through authenticated MoveX API endpoints. It must never receive the Supabase service-role key. The API should continue using short-lived signed URLs for authorized access.

Verification checklist:

- A partner can upload an allowed image/PDF.
- The object appears in the private bucket.
- Opening its storage URL without authorization fails.
- The owning partner can request temporary access.
- An authorized admin can review it.
- A different partner cannot access it.
- Deleting/replacing a document removes the old object and metadata safely.

Official setup reference: [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## 9. SMS And OTP Delivery

### What MoveX uses it for

Customer/partner OTP login and SMS notifications.

### What must be obtained in India

1. Select a provider that supports Indian DLT requirements.
2. Complete business/KYC onboarding with the provider.
3. Register the entity, sender/header and OTP message template on the DLT platform.
4. Obtain the provider API URL, API key/secret, approved sender ID and template ID.
5. Verify the provider's API request format against `HttpSmsProvider`.

Configuration:

```env
SMS_PROVIDER=http
SMS_GATEWAY_URL=https://PROVIDER_API_ENDPOINT
SMS_GATEWAY_API_KEY=YOUR_API_KEY
SMS_GATEWAY_SENDER=YOUR_APPROVED_SENDER_ID
SMS_GATEWAY_TEMPID=YOUR_APPROVED_DLT_TEMPLATE_ID
```

Important: SMS vendors use different payload formats. The existing adapter is generic, but a provider-specific adapter may still be needed if the selected vendor does not accept its current HTTP/query format. Test this in the vendor sandbox before production.

Production must never use `SMS_PROVIDER=mock`. Confirm that OTP values do not appear in application logs or database rows.

## 10. Maps And Routing

### Current options

- `MAPS_PROVIDER=open-source`: Photon/Nominatim/OSRM/OpenStreetMap-backed development option.
- `MAPS_PROVIDER=google`: Google Places, Geocoding and Routes implementation.

For a commercial launch, use a provider with a suitable SLA, quota and terms. To use Google:

1. Create a Google Cloud project and billing account.
2. Enable Places API (New), Geocoding API and Routes API.
3. Create a server-side API key.
4. Restrict it to the required APIs and, where possible, API server egress IPs.
5. Never put this server key in `NEXT_PUBLIC_*`.

```env
MAPS_PROVIDER=google
GOOGLE_MAPS_API_KEY=YOUR_SERVER_KEY
MAPS_GEOCODE_CACHE_TTL_MS=300000
MAPS_ROUTE_CACHE_TTL_MS=60000
```

Verify autocomplete, place details, geocoding, reverse geocoding, route and route matrix calls. Also confirm that caching complies with the selected provider's terms.

Official setup reference: [Google Places API key setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key).

## 11. Razorpay Payments

### What is already implemented

- Server-derived payment amounts.
- Payment-order creation with idempotency.
- HMAC webhook signature verification.
- Captured, failed and refunded event handling.
- Redis replay protection and locking.
- Ledger/outbox updates.
- Restricted refund creation.

### Live setup

1. Complete Razorpay business KYC and activate live mode.
2. Create live API keys in the Razorpay dashboard.
3. Store the key secret only in the API environment.
4. Create a separate webhook secret.
5. Configure this webhook URL:

```text
https://api.YOUR_DOMAIN/api/v1/payments/webhooks/razorpay
```

6. Subscribe to payment captured, failed and refunded events supported by the integration.
7. Put only the public key ID in the web environment.

API:

```env
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=YOUR_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_SEPARATE_WEBHOOK_SECRET
```

Web:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
```

Test in Razorpay test mode first. Replay the same webhook and verify that the ledger is changed only once. Never process a webhook before validating the signature against the raw request body.

Official references: [Razorpay webhooks](https://razorpay.com/docs/webhooks/) and [Razorpay API keys](https://razorpay.com/docs/api/).

## 12. Transactional Email

### What MoveX uses it for

Staff invitations/password recovery, notifications and operational messages processed by the worker.

Using Resend:

1. Create a Resend account.
2. Add a sending domain.
3. Add the required DNS records and wait for verification.
4. Create a restricted production API key.
5. Use an address on the verified domain.

Set the same email configuration in API and worker when both can send messages:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
NOTIFICATION_EMAIL_FROM="MoveX <notifications@YOUR_DOMAIN>"
```

Verify staff invitation, password recovery and a worker-dispatched notification. Configure SPF, DKIM and DMARC before high-volume sending.

Official reference: [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction).

## 13. Search

PostgreSQL search can remain active initially:

```env
SEARCH_PROVIDER=postgres
```

For Meilisearch:

1. Create a Meilisearch Cloud project or deploy a secured instance.
2. Obtain the HTTPS host and private API key.
3. Set the same values in API and worker.

```env
SEARCH_PROVIDER=meilisearch
MEILISEARCH_HOST=https://YOUR_SEARCH_HOST
MEILISEARCH_API_KEY=YOUR_PRIVATE_KEY
MEILISEARCH_STORE_INDEX=movex_stores
```

After deployment, rebuild the index once:

```powershell
pnpm --filter @movex/workers search:rebuild
```

Then keep the worker running so outbox events apply incremental updates. Search must gracefully fall back or report temporary unavailability without affecting checkout.

## 14. Observability

### Sentry

Create separate Sentry projects/environments for API and worker, then set:

```env
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=YOUR_RELEASE_ID
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### OpenTelemetry

Deploy or subscribe to an OTLP-compatible collector/backend and set:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://YOUR_COLLECTOR/v1/traces
```

Do not include passwords, session tokens, OTPs, payment signatures or KYC values in logs, traces or error reports.

Create alerts for:

- API error rate and latency.
- Database connection failures.
- Redis connection failures and memory pressure.
- Worker heartbeat missing.
- Outbox backlog age and maximum-attempt events.
- Payment webhook signature failures and repeated delivery failures.
- Notification delivery failure rate.
- Payout/reconciliation mismatches.

## 15. Deploy API, Worker And Web

The worker is not optional. If only the API and web are deployed, outbox-driven notifications, realtime pushes and search updates will remain pending.

Recommended topology:

- Web: Vercel.
- API: container platform with HTTPS and a stable public URL.
- Worker: separate always-on container using the same release image/code.
- Database: Supabase PostgreSQL/PostGIS.
- Redis: managed Redis.

Existing container definitions:

- `backend/infra/Dockerfile.api`
- `backend/infra/Dockerfile.workers`

Deployment order:

1. Provision PostgreSQL, Redis, storage and external providers.
2. Add staging secrets to the platform secret manager.
3. Build the release images.
4. Run `prisma migrate deploy` as a one-off release job.
5. Deploy the API.
6. Verify `GET https://api.YOUR_DOMAIN/api/v1/health`.
7. Deploy the worker and confirm it is polling the outbox.
8. Deploy the web with `NEXT_PUBLIC_API_BASE_URL=https://api.YOUR_DOMAIN/api/v1`.
9. Configure the Razorpay webhook only after the API URL is stable.
10. Run smoke tests, then promote the same artifact/configuration pattern to production.

Add separate GitHub Actions deployment workflows for staging and production. Production should require environment approval, run migrations once, deploy API and worker, perform a health check, and stop on failure. Keep rollback instructions for both application images and database migrations.

## 16. Create The First Super Admin

Set a strong one-time `ADMIN_BOOTSTRAP_TOKEN`, start the API, then call the bootstrap endpoint exactly once:

```powershell
$body = @{
  setupToken = "YOUR_ONE_TIME_TOKEN"
  email = "owner@YOUR_DOMAIN"
  password = "A-STRONG-UNIQUE-PASSWORD"
  name = "MoveX Owner"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.YOUR_DOMAIN/api/v1/auth/admin/bootstrap" `
  -ContentType "application/json" `
  -Body $body
```

The endpoint refuses to create another super admin once one exists. After success:

1. Rotate/remove `ADMIN_BOOTSTRAP_TOKEN` from production secrets.
2. Log in through the staff flow.
3. Create other staff through the permission-protected registration/invitation flow.
4. Do not share the super-admin account.

## 17. Backend Code Still Required

These items require engineering work, not just environment setup.

### 17.1 Real payout provider - launch blocker for automated payouts

`FinanceModule` currently injects `MockPayoutProvider`. Before sending real partner payouts:

1. Implement a RazorpayX `PayoutProvider` adapter.
2. Add provider selection through environment configuration.
3. Create contacts/fund accounts using validated partner bank details.
4. Send an idempotency key for every payout request.
5. Persist provider references and map provider states to MoveX payout states.
6. Add payout webhook/status polling and timing-safe verification where applicable.
7. Make retries safe and prevent a second transfer for the same MoveX payout.
8. Add sandbox, failure, timeout and replay tests.

Until this is complete, keep payouts in review/manual mode and never present mock `PROCESSING` results as real transfers.

Official reference: [RazorpayX Payout APIs](https://razorpay.com/docs/api/x/payouts/).

### 17.2 Real settlement provider - launch blocker for finance reconciliation

`FinanceModule` currently injects `MockRazorpaySettlementProvider`. Implement the real settlement adapter to:

- Authenticate with Razorpay securely.
- Fetch all pages for a date range.
- Normalize paise/rupee amounts and timestamps correctly.
- Match provider payment IDs to authoritative ledger entries.
- Persist reports and flag missing, duplicate or amount-mismatched rows.
- Handle API rate limits and repeatable report generation.

### 17.3 Staff MFA - intentionally deferred, required before public staff access

TOTP secret generation/encryption and database fields exist, but MFA is not yet enforced end to end. Add:

- Authenticated setup endpoint returning a TOTP URI/QR payload.
- Code confirmation before enabling MFA.
- MFA challenge during staff login before issuing the final session.
- Disable/reset flow requiring password plus MFA or a privileged recovery process.
- One-time hashed recovery codes.
- Audit logs for setup, disable and recovery.
- Rate limits and tests for replay/invalid codes.

Do not expose staff/admin login publicly in production until this is complete or an equivalent identity-provider MFA policy is enforced.

### 17.4 Liveness and readiness

The current `/api/v1/health` response proves only that the NestJS process can answer. Add:

- `/health/live`: process liveness only.
- `/health/ready`: bounded checks for PostgreSQL and Redis.
- Worker heartbeat stored in Redis with an expiry.
- Outbox backlog count/oldest age for internal monitoring.

Do not expose credentials or detailed infrastructure errors in public health responses.

### 17.5 Outbox dead-letter and replay operations

The worker retries and tracks attempts, but production operations also need:

- A failed/dead-letter state after the maximum attempt count.
- Alerting when events enter that state.
- A permission-protected admin inspection endpoint.
- A safe replay action that preserves handler idempotency.
- Retention/archival for old processed events.

### 17.6 Deployment automation

CI verifies the code, but there are no complete staging/production deployment workflows. Add workflows that:

- Build immutable API/worker images.
- Publish them to a registry.
- Run migrations once.
- Deploy staging automatically after approved branch policy.
- Deploy production only after manual environment approval.
- Verify readiness and support rollback.

## 18. Production Hardening

Complete before significant public traffic:

- Load-test OTP, store discovery, cart, checkout, ride matching and webhook bursts.
- Run provider contract tests against SMS, maps, Razorpay, storage and email sandboxes.
- Add database connection-pool limits appropriate for Supabase pooling.
- Define data retention for sessions, audit logs, KYC documents and notifications.
- Add account deletion/data export handling required by the privacy policy.
- Add KYC document malware/content scanning before documents reach admin reviewers.
- Review database access and storage access logs regularly.
- Document incident response, secret rotation and webhook-key rotation.
- Test restore, regional outage and Redis-loss procedures.
- Perform an external security review before handling meaningful payment volume.

## 19. Future Capabilities

These are not launch blockers unless enabled or advertised:

- Replace `StubRouteOptimizationProvider` with real batching/route optimization.
- Add MQTT transport and broker ACLs for native/mobile scale; Redis/SSE remains the current web transport.
- Move all search traffic to Meilisearch after relevance and recovery testing.
- Add advanced driver fairness, acceptance-rate and dispatch optimization.
- Add multi-region failover after traffic justifies the operational complexity.

## 20. Local Verification Commands

Install and generate:

```powershell
pnpm install
pnpm --filter @movex/api db:generate
```

Run API and worker in separate terminals:

```powershell
pnpm --filter @movex/api dev
```

```powershell
pnpm --filter @movex/workers dev
```

Run the web in a third terminal:

```powershell
pnpm --filter @movex/web dev
```

Verify the API:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health
```

Run the full quality gate before deployment:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm openapi:generate
pnpm build
pnpm test:e2e
```

## 21. Go-Live Smoke Checklist

Do not accept real traffic until all answers are **yes**:

- [ ] Production API starts with `NODE_ENV=production` and passes readiness validation.
- [ ] PostgreSQL migration status is clean and PostGIS queries work.
- [ ] A database backup has been restored successfully in a separate environment.
- [ ] Redis uses TLS/auth and session, OTP, cart and lock behavior works.
- [ ] CORS contains only exact HTTPS web origins.
- [ ] Session cookie uses the `__Host-` prefix, Secure, HttpOnly and SameSite=Lax.
- [ ] Supabase KYC bucket is private and unauthorized document access fails.
- [ ] Real SMS sends an approved DLT OTP template.
- [ ] Google/open-source maps choice has valid terms, quota and monitoring.
- [ ] Razorpay test payment, live penny-value validation and signed webhook pass.
- [ ] Webhook replay does not duplicate a ledger entry.
- [ ] Wallet recomputation matches the cached balance.
- [ ] Refund permissions and audit logs are correct.
- [ ] Real payout adapter is enabled, or payouts are explicitly manual/disabled.
- [ ] Real settlement reconciliation flags an injected mismatch.
- [ ] Worker heartbeat is healthy and an outbox event reaches notification/realtime/search once.
- [ ] Email domain and delivery are verified.
- [ ] Sentry/OTEL receive a controlled test event without secrets.
- [ ] First super admin exists, bootstrap token is removed, and staff MFA is enforced.
- [ ] API and worker rollback steps have been tested.
- [ ] CI and browser acceptance tests are green for the release commit.

## 22. Definition Of Backend Completion

MoveX backend completion means more than successful compilation. It is complete when:

1. Every advertised customer and partner flow uses durable production providers.
2. Money always reconciles to the ledger and provider settlement data.
3. KYC documents remain private and access is audited.
4. Staff actions are permission-controlled, audited and MFA-protected.
5. API and worker are independently deployable, observable and recoverable.
6. Backups, alerts, webhook replay protection and outbox recovery are proven.
7. CI, contract tests, core E2E tests and production smoke checks pass.

Treat this document as a living checklist. Update the status table and remove a remaining item only after its implementation, provider setup, tests and operational verification are all complete.
