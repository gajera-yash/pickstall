# Pickstall

Storefront, digital products and courses for online creators. Spec: `PRD.md`. Rules for AI tools: `CLAUDE.md`. Design system: `DESIGN.md`. Decisions: `docs/DECISIONS.md`.

## Prerequisites
- Node.js 24+
- pnpm (`corepack enable pnpm`)
- A MongoDB database: a free **MongoDB Atlas** cluster, or MongoDB running locally (no real data in dev). See `docs/DECISIONS.md` (D-024).

## Setup
1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in the values (never commit `.env.local`):
   - `MONGODB_URI`: from Atlas (**Connect > Drivers**), for example `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net`. In Atlas **Network Access**, allow your IP.
   - `BETTER_AUTH_SECRET`: a long random string, for example the output of `openssl rand -base64 32`.
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`.
3. `pnpm dev`, then open http://localhost:3000. Collections and indexes are created on first use.

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
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route types + `tsc --noEmit` |
| `pnpm test:unit` | Unit tests (no database) |
| `pnpm test` | All tests |

The data model lives in `lib/db/collections.ts` (document types) and `lib/db/mongo.ts` (indexes).
