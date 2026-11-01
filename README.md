# Pickstall

Storefront, digital products and courses for online creators. Spec: `PRD.md`. Rules for AI tools: `CLAUDE.md`. Design system: `DESIGN.md`. Decisions: `docs/DECISIONS.md`.

## Prerequisites
- Node.js 20.9+ (22 LTS or 24 recommended)
- pnpm (`corepack enable pnpm`)
- A MongoDB database: a free **MongoDB Atlas** cluster, or MongoDB running locally (no real data in dev). See `docs/DECISIONS.md` (D-024).

## Setup
1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in the values (never commit `.env.local`):
   - `MONGODB_URI`: from Atlas (**Connect > Drivers**), for example `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net`. In Atlas **Network Access**, allow your IP.
   - `BETTER_AUTH_SECRET`: a long random string, for example the output of `openssl rand -base64 32`.
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`.
3. `pnpm doctor` checks Node, `.env.local` and that MongoDB answers from this PC, and says how to fix anything missing.
4. `pnpm dev`, then open http://localhost:3000. Collections and indexes are created on first use.

## Run on another PC or open from another device
- **Another PC (its own copy):** clone the repo, `pnpm install`, copy `.env.local` from your main PC (safely, never through git), then run `pnpm doctor`. The usual problems it catches:
  - *MongoDB did not answer*: in Atlas **Network Access**, add that PC's public IP.
  - *MongoDB address could not be found*: the network's DNS cannot resolve `mongodb+srv` addresses. Set the PC's DNS to 8.8.8.8, or use Atlas's standard `mongodb://` connection string.
- **Another device, same Wi-Fi (phone, second laptop, an IDE preview such as Antigravity):** run `pnpm dev` on the main PC and open the `http://192.168.x.x:3000` address that `pnpm doctor` or `pnpm dev` prints. `127.0.0.1`, LAN addresses and this PC's name work in development (D-041); for anything else (a tunnel) add the host to `DEV_ALLOWED_HOSTS`. If the other device cannot connect at all, allow Node.js through the Windows firewall on the main PC.
- Google sign-in only works on the address registered in Google Cloud (`localhost:3000`); use the email code elsewhere.

## Sign-in codes (email)
- **Development without Resend:** leave `RESEND_API_KEY` empty. The 6-digit code is printed in the `pnpm dev` terminal as `auth.dev_sign_in_code`.
- **With Resend:** set `RESEND_API_KEY`. Without a verified domain, Resend only delivers to your own Resend account email. For other addresses, verify a domain in Resend and set `EMAIL_FROM`, for example `Pickstall <login@yourdomain.com>`. Production requires `RESEND_API_KEY`.

## Google sign-in (optional)
1. Google Cloud Console > APIs & Services > Credentials > **Create OAuth client ID** (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (and the same path on your production domain).
3. Put the ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | Run locally |
| `pnpm doctor` | Checks this PC can run the app: Node, `.env.local`, MongoDB connection |
| `pnpm dev:sandbox` | Run locally on a throwaway in-memory database (port 3100); nothing touches your real data |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route types + `tsc --noEmit` |
| `pnpm test:unit` | Unit tests (no database) |
| `pnpm test:integration` | Cross-tenant and payment tests on a throwaway in-memory MongoDB |
| `pnpm test` | Unit + integration tests |
| `pnpm test:e2e` | Playwright smoke: in-memory MongoDB + dev server on port 3100 (stop `pnpm dev` first; run `pnpm exec playwright install chromium` once before the first run) |
| `node scripts/load-test.mjs <url>` | Basic load test (localhost only by default) |

The integration and e2e tests never touch your real database: they start their own MongoDB in memory (the first run downloads the `mongod` binary, about 800 MB, into `node_modules/.cache`).

The data model lives in `lib/db/collections.ts` (document types) and `lib/db/mongo.ts` (indexes).
