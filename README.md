# finAI-Buddy 🪙

> AI-powered micro-savings, UPI roundups, gamified pods and parental controls — a full-stack personal-finance app for India's teen savers.

Built with **TanStack Start** (React 19 + SSR), **Tailwind v4**, **shadcn/ui**, and **Drizzle ORM** on **Neon Postgres**.

---

## ✨ What's inside

A complete, functional app — not a mockup:

| Page | What works |
| --- | --- |
| **Overview** (`/`) | Live net worth, trend chart, savings stats, budget donuts, streak heatmap, recent activity, family & trophy widgets — all from your real data |
| **Savings Pods** (`/pods`) | Create pods, add money, edit, delete, auto-save flag, progress + completion trophies |
| **Transactions** (`/transactions`) | Add income/expense, UPI roundups into pods, search & filter, delete |
| **Goals** (`/goals`) | Long-horizon goals with progress logging, deadlines, edit/delete |
| **Insights** (`/insights`) | Category breakdown, daily-spend & 6-month trend charts, top merchants, savings rate, editable budgets |
| **Rewards** (`/rewards`) | XP/level progress, trophy case, live achievement evaluation |
| **Family Hub** (`/family`) | Family members + controls, weekly allowance, chore rewards that credit the wallet |
| **Ask Buddy** (`/buddy`) | Data-driven AI coach — answers real questions and can move money into pods ("save ₹100") |
| **Settings** (`/settings`) | Edit profile, view linked accounts, persistence status, sign out |
| **Auth** (`/login`, `/signup`) | Real email/password auth with sessions |

Plus: ⌘K command palette, live data-derived notifications, responsive layout with a mobile bottom-nav, a 3D-tilt/glassmorphism neon design with a WebGL coin hero, light **and** dark themes, and accessibility (focus rings, reduced-motion, ARIA).

### 🆕 Advanced capabilities
- **Double-entry ledger** — every money movement is recorded as an immutable ledger entry; transaction deletes reverse precisely (account + pod + linked roundup contribution).
- **Recurring rules engine** — weekly allowances and pod auto-saves are applied automatically (idempotent catch-up) on load, or on demand from Settings.
- **CSV import** — bulk-import a bank statement on the Transactions page (client-side parse → server import).
- **Buddy AI** — a local data-driven responder by default; set `ANTHROPIC_API_KEY` to upgrade open-ended chat to the **Claude API** (Opus 4.8), grounded in a live financial snapshot, with automatic local fallback.
- **Email verify + password reset** — full token flows (`/verify-email`, `/forgot-password`, `/reset-password`); emails send via **Resend** when `RESEND_API_KEY` is set, otherwise the link is logged/shown in dev.
- **Hardened auth** — HMAC-signed session cookies, per-email/IP rate limiting, and a cross-origin (CSRF) request guard.
- **Charts** — Recharts with hover tooltips, axes, and legends. **Onboarding** tour for new users. **Skeleton** loaders during navigation. **Optimistic UI** on add-transaction, pod contribute, and chore complete.

---

## 🚀 Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:3000**).

**It works immediately** — with no database configured, the app runs on a seeded **in-memory** store.

### Demo account
```
demo@finai.app  /  demo12345
```
Click **"Use demo account"** on the login page to autofill it. Or create your own via **Sign up**.

> In-memory mode resets when the dev server restarts. Add Neon (below) to make data persistent.

---

## 🗄️ Add a Neon database (optional, for persistence)

1. Create a free project at **[neon.tech](https://neon.tech)** and copy the connection string.
2. Copy `.env.example` → `.env` and set:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
   ```
3. Create the tables and load the demo data:
   ```bash
   npm run db:push    # create all 13 tables
   npm run db:seed    # load the demo account + sample data
   ```
4. Restart `npm run dev`. The app now reads/writes Neon Postgres. The Settings page shows **"Connected to Neon Postgres ✓"**.

### Database scripts
| Command | Description |
| --- | --- |
| `npm run db:push` | Push the schema to Neon (create/update tables) |
| `npm run db:generate` | Generate SQL migration files into `drizzle/` |
| `npm run db:seed` | Seed the demo account |
| `npm run db:studio` | Open Drizzle Studio to browse data |

---

## 🧱 Architecture

```
src/
├─ db/
│  ├─ schema.ts        Drizzle tables (money stored as integer paise)
│  ├─ client.ts        Neon connection (lazy, from DATABASE_URL)
│  ├─ repo.ts          Repository: Neon impl + in-memory fallback (same interface)
│  ├─ seed-data.ts     Canonical demo dataset (shared by seed script + memory repo)
│  └─ seed.ts          `npm run db:seed` entry
├─ server/             TanStack server functions (the API): auth, dashboard,
│                      transactions, pods, goals, budgets, insights, rewards,
│                      family, buddy, settings
├─ lib/
│  ├─ money.ts         Paise ⇄ rupee helpers, INR formatting
│  ├─ finance.ts       Pure calculators (net worth, budgets, streaks, series)
│  └─ auth/            PBKDF2 password hashing + cookie sessions
├─ components/app/     AppShell, primitives, charts, Modal, BuddyPanel
└─ routes/
   ├─ _app.tsx         Auth-guarded layout (renders the AppShell)
   ├─ _app/*.tsx       All authenticated pages
   └─ login/signup.tsx Public auth pages
```

**Data flow:** pages load via route `loader`s calling server functions → server functions use the `repo` (Neon or in-memory) → mutations call server functions then `router.invalidate()`. Money is integer **paise** end-to-end; the UI formats with `<Money paise={…} />`.

**Auth:** PBKDF2-hashed passwords (WebCrypto), opaque session tokens in an httpOnly cookie, checked in the `_app` layout's `beforeLoad`.

---

## 🧪 Tests
| Command | Description |
| --- | --- |
| `npm test` | Vitest unit tests (money, finance, ledger reversal, in-memory repo) |
| `npm run test:e2e` | Playwright smoke tests — run `npx playwright install` once first |

## 🛠️ Other scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (HMR) |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |

---

Built for Gen-Z India 🇮🇳 — free forever for teens, parental controls included.
