# Pickstall

Storefront, digital products and courses for online creators. Spec: `PRD.md`. Rules for AI tools: `CLAUDE.md`. Design system: `DESIGN.md`. Decisions: `docs/DECISIONS.md`.

## Prerequisites
- Node.js 24+
- pnpm (`corepack enable pnpm`)
- A hosted Supabase **dev** project (no real data). There is no local Docker setup; see `docs/DECISIONS.md` (D-001).

## Setup
1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in the values (never commit `.env.local`).
3. `pnpm supabase login`, then `pnpm supabase link --project-ref <your-dev-project-ref>`
4. `pnpm db:push:dry` to preview, then `pnpm db:push` to apply migrations to the dev project.
5. `pnpm dev`, then open http://localhost:3000

## Supabase Auth settings (dashboard, dev project)
`supabase/config.toml` only affects a local stack, so set these in the Supabase dashboard:
1. **Authentication > URL Configuration**: Site URL `http://localhost:3000`; add `http://localhost:3000/**` to Redirect URLs.
2. **Authentication > Sign In / Providers > Email**: enabled; email OTP length **6**.
3. **Authentication > Emails > Magic Link** template: show the code with `{{ .Token }}` (we sign in with a 6-digit code, not a link).
4. Optional, Google: create a Google OAuth client (Web) with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, paste its ID and secret into **Providers > Google**, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in `.env.local`.

The built-in Supabase email sender allows only a few emails per hour. Custom SMTP (Resend) comes in Block E.

## Scripts
| Command | What it does |
|---|---|
| `pnpm dev` | Run locally |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route types + `tsc --noEmit` |
| `pnpm test:unit` | Unit tests (no database) |
| `pnpm test:db` | RLS tests against the **dev** project only (guarded) |
| `pnpm test` | All tests |
| `pnpm db:push:dry` / `pnpm db:push` | Preview / apply migrations to the linked project |
| `pnpm db:types` | Regenerate `lib/supabase/database.types.ts` |

Never run `supabase db reset` against the hosted project, and never edit a migration that has been pushed. Add a new one instead.
