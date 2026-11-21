# Bolt Markets

Website, client portal, back office and API for **Bolt Markets**, a multi-asset MetaTrader 5 broker.
English and Arabic (full right-to-left) throughout, dark-first, mobile-first.

| Folder | What it is | Stack |
| --- | --- | --- |
| [`frontend/`](frontend) | Public website (Home, Trading, Markets, Bolt Funded, Tools, News/Learn blog, Help Center, Company, Legal) and the client portal | React 19, Vite 7, Tailwind CSS 4, TypeScript; every route prerendered in both languages |
| [`admin/`](admin) | Back office for staff: clients, KYC, deposits and withdrawals, MT5 accounts, Bolt Funded, tickets, messages, blog CMS, audit log, system status | React 19, Vite 7, Tailwind CSS 4, TypeScript |
| [`backend/`](backend) | REST API: auth with email verification and 2FA, KYC, MT5 accounts, payments, webhooks, support, IB referrals, blog, live prices | Python 3.13, Starlette + Pydantic, PostgreSQL |
| [`backend/bridge/`](backend/bridge) | Optional Windows services that connect the API to MT5 Manager and stream prices from an MT5 terminal | Python, MetaTrader5 package |
| [`e2e/`](e2e) | 22-step browser test of the whole client and staff journey against a local API | Playwright |
| [`frontend/vercel.json`](frontend/vercel.json) | Live hosting: Vercel builds the website and the back office (served at `/admin`) on every push to `main` | Vercel |
| [`.github/workflows/`](.github/workflows) | `ci.yml` runs lint, types and tests; `pages.yml` can publish to GitHub Pages instead of Vercel | GitHub Actions |
| [`render.yaml`](render.yaml) | One-click deployment of the API and its PostgreSQL database on Render | Render Blueprint |

Design file (design system, website, portal and back office screens):
https://www.figma.com/design/BNaoXnGXhBZ2W07jt3lcQX

---

## What still needs your details

Nothing below was invented. Each feature is built and tested, and stays **switched off** (or hidden) until its value is set.

| Needed | Where to set it | What it unlocks |
| --- | --- | --- |
| Legal company name, registration number, address | `VITE_COMPANY_*` | Footer, Contact page and legal documents |
| Regulator and licence number, or "unregulated" + jurisdiction | `VITE_REGULATORY_STATUS`, `VITE_REGULATOR_NAME`, `VITE_LICENSE_NUMBER`, `VITE_JURISDICTION`, `VITE_GOVERNING_LAW` | Regulatory statements across the site |
| Lawyer review of the five legal documents | `VITE_LEGAL_REVIEWED=true`, `VITE_LEGAL_EFFECTIVE_DATE` | Removes the "draft for legal review" banner |
| Restricted countries | `VITE_RESTRICTED_COUNTRIES` (website) **and** `RESTRICTED_COUNTRIES` (API) | Footer notice; sign-up refuses those countries |
| Support email, phone, WhatsApp | `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_WHATSAPP`; `SUPPORT_INBOX` on the API | Contact options; contact-form notifications |
| Live chat (Crisp, Tawk.to or Intercom) | `VITE_LIVE_CHAT_PROVIDER`, `VITE_LIVE_CHAT_ID` | Chat widget and "Live chat" buttons |
| X, Instagram, YouTube, Discord | `VITE_SOCIAL_*` | Social links |
| Outgoing email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Verification, password-reset and notification emails. **Clients cannot log in until they confirm their email**, so this is required before opening sign-up |
| MT5 server names and download links | `VITE_MT5_SERVER_*`, `VITE_MT5_DOWNLOAD_*`, `VITE_MT5_WEB_TERMINAL*`; `MT5_SERVER_*` | Platform pages and account credentials |
| MT5 account opening | `MT5_MODE=webapi` with `MT5_WEBAPI_URL`, `MT5_MANAGER_LOGIN`, `MT5_MANAGER_PASSWORD`, or `MT5_MODE=bridge` with the Manager bridge; `MT5_GROUP_*` | Live and demo account creation, balance sync, deposits credited to MT5 |
| Live prices | `QUOTES_MODE=bridge` + `QUOTES_BRIDGE_KEY` and the quote bridge, or `QUOTES_MODE=terminal` on Windows | Ticker, live board and market pages |
| Card deposits (Stripe Checkout) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card deposits |
| Crypto deposits and payouts (NOWPayments) | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Crypto deposits; withdrawals need at least one payment rail |
| Automated KYC (optional) | `KYC_PROVIDER=sumsub`, `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET` | Sumsub checks. Without it, manual review in the back office works out of the box (documents are encrypted in the database) |
| Domain | Vercel → Settings → Domains, then `VITE_SITE_URL`, `FRONTEND_URL`, `ADMIN_URL` | Your own domain instead of `boltmarket.vercel.app` |
| Blog auto-publish | `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` | Publishing a post in the back office rebuilds the static site |
| Testimonials | — | None were supplied, so the site has no testimonial section |
| Opening sign-up | `REGISTRATION_OPEN=true` | Off by default in production until the items above are done |

Please also confirm these assumptions (all in one place each):

- **$3 per lot** on Institutional is treated as charged per side ($6 per round turn) in the cost estimator: `COMMISSION_SIDES_PER_TRADE` in `frontend/src/config/accounts.ts`.
- **Standard and Pro are commission-free** (the brief listed spreads only): `commissionPerLot` in the same file.
- **Bolt Funded** plan prices, targets and loss limits are starting values, not approved terms: `frontend/src/config/funded.ts` and `FUNDED_*` on the API.
- **Instrument list and contract specifications** (38 symbols, contract sizes, minimum lots) are typical MT5 defaults: `frontend/src/config/markets.ts`. Match them to your MT5 symbol settings.
- **IB commissions** are credited manually from the back office (adjustments); there is no automatic rebate engine because no rates were given.
- The name **"Bolt Markets"** may already be registered by other companies in some countries. Check trademark and company-name availability before launch.

---

## Deploying

The website and back office are static and live on **Vercel**. The API and database live on **Render** (or any Docker host).

### 1. Website and back office (Vercel)

The Vercel project `boltmarket` is linked to this repository. Every push to `main` runs the build in [`frontend/vercel.json`](frontend/vercel.json) (website prerendered in English and Arabic, back office built into `/admin`) and publishes it:

- website: `https://boltmarket.vercel.app/` (Arabic at `/ar/`)
- back office: `https://boltmarket.vercel.app/admin/`

Public settings (`VITE_*`, see the table above) live in Vercel → Project → Settings → Environment Variables; change one and redeploy. Everything in a `VITE_*` variable is compiled into public JavaScript, so only public values belong there. Vercel's free Hobby plan is meant for non-commercial use: move the project to a paid plan, or to GitHub Pages, before taking real clients.

**GitHub Pages instead:** set the repository variable `DEPLOY_PAGES=true` (Settings → Secrets and variables → Actions → Variables), choose Settings → Pages → Source: **GitHub Actions**, and run the **Website (GitHub Pages)** workflow. The site is then at `https://projectlemo.github.io/BoltMarket/`. For a fresh copy of the project in another account, `./scripts/publish-github.sh` creates the repository and turns on Pages.

### 2. Deploy the API

**On Vercel (current setup).** The Vercel project `boltmarket-api` builds [`backend/`](backend) as a Python function in Frankfurt (`fra1`), using the `asgi:app` entrypoint set in `backend/pyproject.toml`. It needs a PostgreSQL database: in the project's **Storage** tab create a **Neon** database (Frankfurt region) and connect it, which adds `DATABASE_URL`. On Vercel, email is sent during the request (`MAIL_SYNC`, automatic) because no background worker runs between requests. Request bodies are capped at 4.5 MB there, so `MAX_UPLOAD_MB=4`.

**On Render (Docker, always-on worker):**

1. Render dashboard → **New → Blueprint** → select the repository. `render.yaml` creates the `bolt-markets-api` web service (Docker, Frankfurt) and the `bolt-markets-db` PostgreSQL database.
2. When asked, enter `FRONTEND_URL` (`https://boltmarket.vercel.app`), `ADMIN_URL` (`https://boltmarket.vercel.app/admin`) and `BOOTSTRAP_ADMIN_EMAIL` (your email).
3. Render generates `SECRET_KEY`, `DATA_KEY` and `BOOTSTRAP_ADMIN_PASSWORD`. **Back up `DATA_KEY`**: it encrypts KYC documents and 2FA secrets, and changing it makes them unreadable.
4. When the deploy is green, open `https://<service>.onrender.com/api/v1/health` and `/docs` for the API reference.

The free plans are fine for a preview, but free services sleep after 15 minutes without traffic and the free database expires after 30 days. Use paid plans before taking real clients.

**Railway or another host:** build `backend/Dockerfile` from the repository root (`docker build -f backend/Dockerfile .`), attach PostgreSQL, and set the variables from [`backend/.env.example`](backend/.env.example). The container honours `$PORT`.

### 3. Connect the website to the API

Vercel → `boltmarket` → Settings → Environment Variables: add `VITE_API_URL` = your API URL (for example `https://bolt-markets-api.onrender.com`) for Production and Preview, then redeploy. The website, client portal and back office all use it.

### 4. First login to the back office

Open `https://boltmarket.vercel.app/admin/`, sign in with `BOOTSTRAP_ADMIN_EMAIL` and the generated `BOOTSTRAP_ADMIN_PASSWORD` (Render → service → Environment). Staff accounts must set up two-factor authentication on first login. Then change the password and add colleagues with **Clients → Add staff** (roles: admin, compliance, finance, support; each sees only its own queues).

From a shell with access to the database you can also run `python -m app.cli create-admin --email you@example.com`.

### 5. Go live checklist

SMTP → MT5 (`MT5_MODE`) → price feed (`QUOTES_MODE`) → at least one payment rail → company and regulatory details → lawyer-approved legal documents (`VITE_LEGAL_REVIEWED=true`) → restricted countries → `REGISTRATION_OPEN=true`.

---

## Local development

Requirements: Python 3.12+, Node 20.19+.

```bash
# API on http://localhost:8000  (docs at /docs)
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # development defaults: SQLite, everything optional
uvicorn app.main:app --reload

# Website + portal on http://localhost:5173
cd frontend
cp .env.example .env.local    # set VITE_BASE_PATH= and VITE_API_URL=http://localhost:8000
npm install && npm run dev

# Back office on http://localhost:5174
cd admin
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm install && npm run dev
```

For local design review without MT5, set `MT5_MODE=mock` and `QUOTES_MODE=simulated` on the API. Both are refused when `ENVIRONMENT=production`, and simulated prices are always labelled as such in the UI.

Useful commands (`backend/`): `python -m app.cli check` (configuration report), `migrate`, `create-admin`, `seed-blog`, `sync-accounts`, `send-emails`, `openapi`.

---

## How it works

**Website.** 46 route patterns; the build prerenders 55 paths in English and Arabic to their own `index.html` files (110 pages, including the 10 starter articles), plus 404, a sitemap with `hreflang` and robots.txt. Account specs, instruments, funded plans and calculators read from `frontend/src/config/`, so a value changes everywhere at once. The 10 starter articles ship with the site; articles published in the back office are served by the API and prerendered on the next build.

**Client portal** (`/portal`): register (name, email, country, password) → confirm email → optional 2FA → verification upload → open live or demo MT5 accounts → deposit by card or crypto → withdraw → history → IB referral link and code → support tickets → Bolt Funded evaluations → settings.

**Back office** (`/admin`): role-based access with mandatory staff 2FA; queues for KYC, deposits to review, withdrawals to approve and pay, MT5 accounts waiting; client files with notes, suspension and adjustments; tickets and contact messages; blog CMS (EN/AR, drafts, publish); audit log of every staff action; system page showing which integrations are configured.

**API.** JSON over HTTPS under `/api/v1`, OpenAPI docs at `/docs`. Errors come back as `{"error": {"code", "message", "fields"}}` in the caller's language. Money is stored in integer cents. Webhooks: `/api/v1/webhooks/stripe`, `/api/v1/webhooks/nowpayments`, `/api/v1/webhooks/sumsub` (all signature-checked and idempotent).

**MT5.** `MT5_MODE=webapi` talks to the MT5 Manager Web API; `MT5_MODE=bridge` talks to `backend/bridge/mt5_manager_bridge.py` on a Windows server with the Manager API. Prices come from `backend/bridge/mt5_quote_bridge.py`, which pushes ticks from an MT5 terminal to the API, and reach browsers as server-sent events. Both bridges follow MetaQuotes' public interfaces; confirm the calls against your MT5 build and provider before going live ([bridge README](backend/bridge/README.md)).

### Security

- Secrets are never committed: `.env` files are git-ignored, production values live in Render's environment settings and GitHub variables hold only public values.
- Passwords hashed with scrypt; short-lived JWT access tokens with rotating refresh tokens and reuse detection; TOTP 2FA with recovery codes; login lockout and rate limits.
- KYC documents and 2FA secrets encrypted at rest with AES-GCM (`DATA_KEY`); uploads type- and size-checked.
- CORS allows only `FRONTEND_URL` and `ADMIN_URL` origins (plus `CORS_ORIGINS`); production start-up refuses weak keys, SQLite, mock MT5 and simulated prices.

---

## Tests

| Suite | Command | Result at hand-over |
| --- | --- | --- |
| API, SQLite | `cd backend && pytest` | 68 passed |
| API, PostgreSQL 16 | `TEST_DATABASE_URL=postgresql://… pytest` | 68 passed |
| Lint and types | `ruff check . && mypy app` | clean |
| Website units (calculators, Markdown, QR, validation) | `cd frontend && npm test` | 18 passed |
| Internal links | `npm run build && npm run check:links` | 6,066 links on 112 pages, none broken |
| End to end (website, portal, back office) | see [`e2e/README.md`](e2e/README.md) | 22 of 22 steps passed |

CI runs the API suites on SQLite and PostgreSQL, ruff, mypy, a Docker build with a health check, the website unit tests, build and link check, and a strict TypeScript check of both apps.

### Notes from the build environment

This project was produced in a sandbox without access to the npm and PyPI registries, which shaped a few choices:

- **The brief asked for FastAPI; the API uses Starlette**, the ASGI framework FastAPI is built on, with Pydantic models and a small typed router that generates the OpenAPI docs. FastAPI was not installed in the sandbox and could not be added. Deployment is identical (uvicorn), and moving the handlers to FastAPI later is mechanical.
- Queries are plain SQL through a thin layer that runs on SQLite (development, tests) and PostgreSQL (production), with numbered migrations in `backend/app/migrations/` applied on start (`AUTO_MIGRATE`).
- Local builds used `npm run build:offline` (esbuild + Tailwind's JS compiler) because Vite and the font packages were not installable; that build stubs the `@fontsource` packages, so local screenshots used system fonts. The CI and Pages builds use the normal `npm run build`, which bundles Manrope, Inter and IBM Plex Sans Arabic.
- `npm run typecheck` could only be run against a lenient React type shim in the sandbox, so the **TypeScript** job in CI is the first check against the real `@types/react`. It is reported separately and does not block the Pages deployment.
- Lighthouse was not available. The home page ships prerendered HTML with 58 KB of gzipped JavaScript and 13 KB of gzipped CSS for first load; run Lighthouse on the deployed site to confirm the 90+ target.
- No lock files are committed (they could not be generated offline). After your first `npm install` in `frontend/`, `admin/` and `e2e/`, commit the generated `package-lock.json` files and switch the workflows to `npm ci`.
