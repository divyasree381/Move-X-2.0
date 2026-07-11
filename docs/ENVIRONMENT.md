# MoveX Environment Configuration

MoveX keeps committed environment files as templates only. Real `.env` and `.env.local` files must remain untracked and must never contain values intended for the browser unless the variable starts with `NEXT_PUBLIC_`.

## Provider Selection

| Capability | Selector | Local default | Production option |
| --- | --- | --- | --- |
| Maps | `MAPS_PROVIDER` | `open-source` | `google` |
| SMS | `SMS_PROVIDER` | `mock` | `http` |
| Payments | `PAYMENT_PROVIDER` | `mock` | `razorpay` |
| Email | `EMAIL_PROVIDER` | `mock` | `resend` |
| Search | `SEARCH_PROVIDER` | `postgres` | `meilisearch` |
| Private files | `STORAGE_PROVIDER` | `mock` | `supabase` |

The open-source maps provider uses Photon autocomplete, Nominatim geocoding, and OSRM routing. Google requires `GOOGLE_MAPS_API_KEY`. Provider keys remain server-side.

## Required Production Secrets

Generate unique values per environment for:

- `AUTH_HASH_SECRET`
- `CONFIG_SECRET_KEY`
- `OTP_HASH_SALT` and `ORDER_OTP_HASH_SALT`
- `ADMIN_BOOTSTRAP_TOKEN` during first-super-admin setup only
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`
- `SMS_GATEWAY_API_KEY` when `SMS_PROVIDER=http`
- `GOOGLE_MAPS_API_KEY` when `MAPS_PROVIDER=google`
- `RESEND_API_KEY` when `EMAIL_PROVIDER=resend`
- `MEILISEARCH_API_KEY` when `SEARCH_PROVIDER=meilisearch`
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_PRIVATE_BUCKET` when `STORAGE_PROVIDER=supabase`
- `PARTNER_KYC_SECRET_KEY` for partner identity and bank-detail encryption (falls back to `CONFIG_SECRET_KEY`)

`SMS_GATEWAY_SECRET` remains accepted temporarily for existing deployments, but new environments must use `SMS_GATEWAY_API_KEY`.

## Core Runtime

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API listener port | `3001` |
| `WEB_ORIGIN` | Canonical web origin | local web URL |
| `CORS_ORIGIN` | Exact comma-separated API allowlist | local web URL |
| `DATABASE_URL` | PostgreSQL connection | local MoveX database |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |

## Security And Sessions

| Variable | Purpose | Default |
| --- | --- | --- |
| `SESSION_COOKIE_NAME` | HttpOnly session cookie | `__Host-movex_session` |
| `CSRF_COOKIE_NAME` | Double-submit CSRF cookie | `movex_csrf` |
| `SESSION_TTL_SECONDS` | Server-side session lifetime | `2592000` |
| `OTP_TTL_SECONDS` | OTP challenge lifetime | `300` |
| `OTP_REQUEST_PHONE_LIMIT` | OTP requests per phone window | `3` |
| `OTP_REQUEST_IP_LIMIT` | OTP requests per IP window | `20` |
| `OTP_VERIFY_PHONE_LIMIT` | Verification attempts per phone window | `20` |
| `OTP_VERIFY_IP_LIMIT` | Verification attempts per IP window | `60` |
| `STAFF_LOGIN_EMAIL_LIMIT` | Staff login attempts per email window | `10` |
| `STAFF_LOGIN_IP_LIMIT` | Staff login attempts per IP window | `50` |
| `STAFF_RECOVERY_EMAIL_LIMIT` | Staff recovery requests per email window | `3` |
| `STAFF_RECOVERY_IP_LIMIT` | Staff recovery requests per IP window | `20` |

Optional security tuning uses these code defaults:

| Variable | Default |
| --- | --- |
| `THROTTLE_TTL_MS` | `60000` |
| `THROTTLE_LIMIT` | `100` |
| `THROTTLE_BLOCK_MS` | `60000` |
| `OTP_HASH_SALT` | required explicitly in production |
| `ORDER_OTP_HASH_SALT` | required explicitly in production |

Production deployments should explicitly configure both OTP salts.

Staff authentication uses scrypt-hashed passwords, verified email invitations, forced temporary-password replacement, single-use hashed recovery tokens, role permissions, audit logging, and revocable server-side sessions. Staff MFA remains deliberately deferred.

The API and worker must share the same `AUTH_HASH_SECRET`; the worker uses it to derive invitation and password-reset links without storing plaintext lifecycle tokens. Set `WEB_ORIGIN` on both services to the canonical frontend origin.

## Orders And Retention Tuning

| Variable | Default |
| --- | --- |
| `CART_TTL_MS` | `2592000000` |
| `ORDER_CHECKOUT_IDEMPOTENCY_TTL_MS` | `86400000` |
| `ORDER_CHECKOUT_LOCK_TTL_MS` | `30000` |
| `ORDER_TAX_RATE` | `0.05` |
| `ORDER_BASE_DELIVERY_FEE` | `25` |
| `ORDER_DELIVERY_FEE_PER_KM` | `6` |
| `DELIVERY_QUEUE_RADIUS_KM` | `8` |
| `ORDER_STALE_UNPAID_MS` | `900000` |
| `ORDER_LOYALTY_POINTS_PER_RUPEE` | `0.02` |
| `RIDE_LOYALTY_POINTS_PER_RUPEE` | `0.02` |
| `REFERRAL_REFERRER_CREDIT` | `100` |
| `REFERRAL_REFEREE_CREDIT` | `50` |

## Matching Tuning

| Variable | Default |
| --- | --- |
| `RIDE_DRIVER_SEARCH_RADIUS_KM` | `6` |
| `COURIER_PARTNER_SEARCH_RADIUS_KM` | `8` |
| `HOME_SERVICE_PRO_SEARCH_RADIUS_KM` | `10` |
| `RIDE_DRIVER_OFFER_TTL_MS` | `45000` |
| `COURIER_PARTNER_OFFER_TTL_MS` | `45000` |
| `HOME_SERVICE_PRO_OFFER_TTL_MS` | `45000` |
| `RIDE_DRIVER_HEARTBEAT_STALE_MS` | `45000` |

## Payment And Map Caching

| Variable | Default |
| --- | --- |
| `PAYMENT_IDEMPOTENCY_TTL_MS` | `86400000` |
| `PAYMENT_WEBHOOK_PROCESSED_TTL_MS` | `604800000` |
| `PAYMENT_WEBHOOK_LOCK_TTL_MS` | `30000` |
| `MAPS_GEOCODE_CACHE_TTL_MS` | `300000` |
| `MAPS_ROUTE_CACHE_TTL_MS` | `60000` |

## Private Partner Documents

Partner KYC files and pharmacy prescriptions use the backend-only `StorageProvider`. Local development defaults to the in-memory mock. Production must use a private Supabase Storage bucket:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PRIVATE_BUCKET=movex-private
PARTNER_KYC_SECRET_KEY=generate-a-separate-long-random-secret
```

Create `movex-private` in the Supabase Storage dashboard with **Public bucket disabled**. The API uploads with the server secret key and returns only short-lived signed URLs after MoveX session and permission checks. Never place the Supabase secret key in `frontend/web/.env.local` or any `NEXT_PUBLIC_*` variable.

PostgreSQL stores document type, version, checksum, MIME type, review state, and object key. Aadhaar, PAN, account number, and UPI details are encrypted or masked before persistence; raw file contents remain in object storage.

## Workers

The worker requires `DATABASE_URL` and `REDIS_URL`. Notification, search, and observability variables must match the API environment. Outbox defaults are documented in `backend/workers/.env.example`.

## Web

Only browser-safe settings belong in `frontend/web/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CSRF_COOKIE_NAME`
- `PLAYWRIGHT_BASE_URL` for local end-to-end runs

Never expose Razorpay secrets, Google server keys, database URLs, Redis URLs, OTP salts, encryption keys, or SMS credentials through `NEXT_PUBLIC_*` variables.
