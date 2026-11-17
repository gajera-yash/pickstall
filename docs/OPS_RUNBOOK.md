# Ops runbook

What to set up once the site is live on Vercel (`docs/DEPLOY_VERCEL.md`), and what to do when something breaks. Decision: D-075.

---

## 1. Uptime monitor (10 minutes, free)

1. Create a free account with an uptime service (for example UptimeRobot, Better Stack or Checkly).
2. Add an **HTTP(s) monitor** for `https://pickstall.store/api/health`, every 5 minutes.
3. Alert when the status is not `200`. The endpoint answers `503` when the database cannot be reached, so one monitor covers both the app and MongoDB.
4. Add a second monitor for `https://pickstall.store/` (the landing page).
5. Send alerts to your email and phone.

`/api/health` only says `ok` or `degraded`. It never shows versions, hosts or error text, so it is safe to leave public.

## 2. Sentry (error monitoring)

1. Create a free Sentry account and a **Next.js** project.
2. Copy the DSN into Vercel as `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (the same value in both), then redeploy.
3. Optional: also set `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`. Errors then show real file names and lines.
4. In Sentry > Alerts, create an alert for **a new issue** and for **more than 10 events in 1 hour**, sent to your email.
5. Check that it works: open `https://pickstall.store/this-page-does-not-exist`. Nothing should be reported, because a 404 is not an error. A real server error shows up within a minute.

What is never sent (`lib/monitoring/scrub.ts`): query strings, cookies, headers, form contents, user details, the order-email token and order ids in URLs. Browser reports go through `/monitoring` on our own domain.

## 3. MongoDB Atlas backups

- **Free (M0) cluster:** no automatic backups. Before real creators join, move to a paid tier (M10 or Flex) and turn on **Cloud Backup** (Atlas > Cluster > Backup).
- Suggested policy: snapshots every day, kept for 7 days; weekly snapshots kept for 4 weeks; monthly snapshots kept for 3 months.
- **Test a restore once**: restore a snapshot into a new cluster (never over the live one), point a local `.env.local` at it, and open the dashboard. Delete the test cluster afterwards.
- Until backups are on, export once a week on your own PC (`mongodump --uri "<your MONGODB_URI>" --out backup-YYYY-MM-DD`). Keep the folder private: it contains customer data.

## 4. Load test (before inviting creators)

Run the load test against the **Vercel preview** or the production site, never against someone else's site:

```bash
node scripts/load-test.mjs https://pickstall.store/ --concurrency 20 --requests 500 --allow-remote
```

```bash
node scripts/load-test.mjs https://pickstall.store/@your-username --concurrency 20 --requests 500 --allow-remote
```

What good looks like: 0 errors and a p95 under about 800 ms. Rate limits protect login, checkout and the other sensitive endpoints, so test only public pages. If p95 is high, check Vercel > Observability and Atlas > Metrics (slow queries, connections).

## 5. Independent security review (before live payments)

Before Stripe live mode, ask someone outside the project to review it:

- an affordable option is a freelance pentester (for example on a bug-bounty or freelancing platform) with a fixed scope: sign-in, checkout, webhooks, file and video access, and the tenant isolation between creators;
- give them `docs/SECURITY_REVIEW_R9.md` and a **test-mode** deployment with test accounts, never production keys;
- fix every high or critical finding before turning on live mode.

## 6. When something breaks

| Symptom | First checks |
|---|---|
| Uptime alert, `/api/health` gives 503 | Atlas status page, Atlas > Network Access (Vercel needs `0.0.0.0/0` or its IPs), whether `MONGODB_URI` was changed. |
| Site down, health check does not answer | Vercel status page, Vercel > Deployments (roll back to the last good deployment with "Promote to Production"). |
| Nobody can log in | Resend dashboard (API key, domain still verified, sending limits), Sentry for `auth.*` errors. |
| Sales not marked paid | Stripe > Developers > Webhooks: failed deliveries. Fix the cause, then use "Resend" on the events. Handling is idempotent, so resending is safe. |
| A creator reports activity they don't recognise | Ask them to use **Settings > Account > Sign out other devices**, then sign in again with a fresh email code. Their recent activity is shown there. |
| A secret leaked | Rotate it at the provider (Atlas password, `BETTER_AUTH_SECRET` signs everyone out, Stripe keys, Resend key), update Vercel, redeploy. |

## 7. Not included, and why

- **Two-factor authentication (2FA):** creators sign in with a one-time code sent to their email, so every sign-in already proves they control the inbox. An authenticator-app second step on top of an email code adds friction for little gain in this phase. Revisit if creators sign in with passwords or ask for it.
- **Status page:** the uptime services above offer a free public status page if creators ask for one.
