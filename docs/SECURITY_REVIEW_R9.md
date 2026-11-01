# Security review and tests (R9)

> Date: 2026-11-01. Block R9 from `PRD.md` section 8 (reads 5.5 and 6). Checklist: `CLAUDE.md` section 8.
> Nothing was run against the founder's database: the integration and e2e tests start their own MongoDB in memory.

## 1. Findings and fixes

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | High | **A payment event was not tied to the checkout session we created.** `payment.succeeded` matched the order by id only. A connected creator could create a Checkout Session on their own Stripe account with another store's pending order id in `metadata.order_id`, pay it (to themselves), and the signed Connect webhook would mark the other store's order paid and unlock its product. | Fixed: fulfilment requires `{ _id, provider, providerSessionId }` to match the event; refunds also require the same provider (`lib/payments/process.ts`). Unit and integration tests. |
| F2 | Low | `RegExp.test` turns an array into a string, so `["maya"]` passed slug and token checks before reaching a MongoDB filter. No data could leak (an array never equals a string field), but it broke the "strings only" rule (PRD 5.5 item 5). | Fixed: `typeof === "string"` before every slug, token and uuid check (`lib/stores/public.ts`, `lib/orders/queries.ts`, `lib/auth/access-tokens.ts`, `lib/media/media.ts`). |
| F3 | Low | `findPurchase` and `grantAccess` accepted an operator object as the order id. Still limited to the buyer's own email, and every caller already checked `isUuid`. | Fixed inside the library functions too (defense in depth). Integration test. |
| F4 | Medium | No security headers. | Fixed: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS in production, no `X-Powered-By` (`lib/security/headers.ts`, `next.config.ts`). |
| F5 | High (open, founder action) | `.env.local` was committed and pushed in `97c9217` (already recorded in D-034). The MongoDB password, `BETTER_AUTH_SECRET`, Resend key and Stripe test key in that file are in the public history. | **Rotate all four.** Rewriting history does not help once pushed. |

### CSP notes
- `script-src 'self' 'unsafe-inline'`: Next.js streams page data in inline scripts. A per-request nonce would make every page dynamic and switch off the cached public store pages. Risk is low because there is no third-party script and creator or buyer text is never rendered as HTML (D-014). Revisit if a script host is ever added.
- `img-src https:` because creators may use their own https image links. `form-action 'self' https:` because "Open your purchase" and checkout redirect to the creator's link or Stripe, and browsers apply `form-action` to redirects.
- Uploaded images keep their own stricter policy (`default-src 'none'; sandbox`).

## 2. Checklist (CLAUDE.md 8)

| Item | Result |
|---|---|
| Inputs validated with Zod; outputs minimal | Yes. Server actions read `FormData` or validate bound arguments (`productIdInput`, `isUuid`, `typeof`). Public reads use projections; tests assert no delivery link, Stripe account id or owner id in public data. |
| Authorization server-side (no IDOR) | Yes. Every creator query starts from the session owner's store id; buyers are matched by verified email. Covered by `tests/integration/cross-tenant.test.ts` on a real MongoDB. |
| Every query filters by the owner and has an ownership test | Yes for stores, products, orders, customers, income, library. |
| No secrets in code, logs, bundles, git history | Code, logs and bundles: yes. **Git history: no (F5).** |
| Webhooks: signature, idempotent, replay-safe | Yes. Same event twice or ten in parallel = one paid order and one email (`tests/integration/payments.test.ts`). |
| Rate limits on login/OTP, checkout, coupons, playback | Login code, password login, password link, checkout, product writes, username changes and checks, uploads, CSV export, library opens, Better Auth endpoints. Coupons and playback do not exist yet (Phase 2). |
| Files and video via signed, expiring URLs; private buckets | Delivery is an https link opened only through the POST endpoint after checks (D-036). Real private file storage with short signed URLs is still not built (no storage decided). |
| No raw query concatenation; no `dangerouslySetInnerHTML` | Yes (none in the code base). Search text is regex-escaped. |
| Redirects validated; OAuth `state` | `safeNextPath` (tested); Better Auth checks `state`; delivery redirect target comes from the database only. |
| Errors do not leak internals or account existence | Yes (same answers for unknown email and wrong code/password). |
| Creator text sanitized and limited; https redirects; CSV formulas | Yes (D-013, D-014, D-035). |
| MockProvider cannot run in production | Yes (`mockAllowed`, `providerByName`), unit-tested; e2e uses it only under `next dev`. |

## 3. Tests added

- `tests/unit/security-headers.test.ts`, `tests/unit/injection.test.ts`, updated `tests/unit/checkout.test.ts`.
- `tests/integration/` (new Vitest project, in-memory MongoDB replica set): cross-tenant suite, NoSQL injection on the real driver, download limit under parallel opens, webhook idempotency under parallel deliveries, one email per order, session binding, refunds per provider, free orders.
- `tests/e2e/smoke.spec.ts` (Playwright via `pnpm test:e2e`): store page with headers, draft store hidden, anonymous mock purchase to "Thank you!" with one paid order, the answer saved and one email row, private pages redirect to login, delivery endpoint and webhook refuse anonymous requests, 360 px pages without horizontal scroll.
- `scripts/load-test.mjs`: basic load test.

## 4. Not done / known gaps

- Creator signup and dashboard steps are not in the e2e smoke (signing in needs the emailed code); the founder's manual smoke test (PRD 8.1) still covers them.
- No audit log for sensitive actions yet (PRD 5.5 item 7).
- Session cookie `Secure` flag relies on Better Auth's default for an https base URL; confirm on the deployed site in R10.
- Dev-only dependency advisories (via the shadcn CLI): 1 low, 1 moderate. Production dependencies: none.
- Public product and store pages log a dev-only error "Next.js encountered the unstable value `new Date()` while prerendering" from `findPublicStore` (since R5 replaced `await connection()` with `instant = false`). Pages still render; check it before R10.
- On this Windows machine the test `mongod` (8.2.6) crashes when several indexes are built at once on collections that already hold data. The e2e spec therefore seeds after the app built its indexes. Atlas runs Linux and a different build; nothing seen there, but if index builds at startup ever fail in production, build them one by one in `lib/db/mongo.ts`.

## 5. Results (2026-11-01, founder's PC: Windows, 8 GB RAM, project on drive E:)

- `pnpm test` (unit + integration): all green.
- `pnpm test:e2e`: 6 of 6 passed (about 2 minutes once routes are compiled; the very first run compiles each route and can take 10+ minutes on this disk).
- Load test, `next dev` on the same PC, public store page with 6 products, 200 requests at concurrency 10: 0 errors, 3.7 req/s, p50 2.7 s, p95 3.0 s. Dev mode renders without caching and with dev overhead on a busy 8 GB machine, so this only proves the page stays correct under parallel load. Run `pnpm build && pnpm start` and then `node scripts/load-test.mjs http://localhost:3000/@<username>` for real numbers, and repeat on the deployed server in R10 before any capacity claim.
