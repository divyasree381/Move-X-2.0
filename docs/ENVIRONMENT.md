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

The open-source maps provider uses Photon autocomplete, Nominatim geocoding, and OSRM routing. Google requires `GOOGLE_MAPS_API_KEY`. Provider keys remain server-side.

## Required Production Secrets

Generate unique values per environment for:

- `AUTH_HASH_SECRET`
- `CONFIG_SECRET_KEY`
- `MFA_SECRET_KEY`
- `OTP_HASH_SALT` and `ORDER_OTP_HASH_SALT`
- `ADMIN_BOOTSTRAP_TOKEN` during first-super-admin setup only
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`
- `SMS_GATEWAY_API_KEY` when `SMS_PROVIDER=http`
- `GOOGLE_MAPS_API_KEY` when `MAPS_PROVIDER=google`
- `RESEND_API_KEY` when `EMAIL_PROVIDER=resend`
- `MEILISEARCH_API_KEY` when `SEARCH_PROVIDER=meilisearch`

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
| `STAFF_MFA_REQUIRED` | Require staff MFA in production | `true` |
| `OTP_TTL_SECONDS` | OTP challenge lifetime | `300` |
| `OTP_REQUEST_PHONE_LIMIT` | OTP requests per phone window | `3` |
| `OTP_REQUEST_IP_LIMIT` | OTP requests per IP window | `20` |
| `OTP_VERIFY_PHONE_LIMIT` | Verification attempts per phone window | `20` |
| `OTP_VERIFY_IP_LIMIT` | Verification attempts per IP window | `60` |

Optional security tuning uses these code defaults:

| Variable | Default |
| --- | --- |
| `THROTTLE_TTL_MS` | `60000` |
| `THROTTLE_LIMIT` | `100` |
| `THROTTLE_BLOCK_MS` | `60000` |
| `OTP_HASH_SALT` | required explicitly in production |
| `ORDER_OTP_HASH_SALT` | required explicitly in production |

Production deployments should explicitly configure both OTP salts.

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

## Workers

The worker requires `DATABASE_URL` and `REDIS_URL`. Notification, search, and observability variables must match the API environment. Outbox defaults are documented in `backend/workers/.env.example`.

## Web

Only browser-safe settings belong in `frontend/web/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CSRF_COOKIE_NAME`
- `PLAYWRIGHT_BASE_URL` for local end-to-end runs

Never expose Razorpay secrets, Google server keys, database URLs, Redis URLs, OTP salts, encryption keys, or SMS credentials through `NEXT_PUBLIC_*` variables.
