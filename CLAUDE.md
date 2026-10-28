# My Global Hub Timekeeping — project notes

## Layout
- `frontend/` — React 19 + Vite. Entry `src/main.jsx` → `src/App.jsx`.
  - `src/App.jsx` — app shell + custom screens (Pay Periods, Adjustments, Approval Workflows, My Time Entry,
    Add Employee, Employee Created, Proof of Payment). `renderVals()` builds the view-model, `render()` is markup.
  - `src/lib/payroll.js` — constants & helpers (NAV, STAGES, RULES, PAYCALC, period math).
  - `src/lib/api.js` — backend client. `/api` is proxied to :5050 by Vite.
  - `src/kit/kit.jsx` — design-system UI-kit screens, registered on `window.__MGH_KIT` (NOT `window.SCREENS`,
    which the DS bundle defines with wrong asset paths). `KitScreen` rewrites avatar paths to `assets/avatars/`.
  - `src/design-system/` — My Global Hub Design System bundle + tokens. Do not edit `_ds_bundle.js`;
    it needs `window.React` (set in `src/setup-globals.js`). Components via `DS.<Name>`.
  - `public/assets/` — logos and avatars (`assets/logo-mgh.png` is the sphere mark).
- `backend/` — Express 5 API. `server.js` → `src/routes.js`, JSON store `src/db.js`, seed `src/seed.js`,
  period rules `src/payroll.js`. Default port 5050 (macOS uses 5000 for AirPlay).
- `design-source/` — original Claude Design prototype (`My Global Hub.dc.html` + `support.js` runtime).

## Design system (binding)
Navy sidebar #132A52, primary #334296, accent #0094CC, Plus Jakarta Sans, Material Symbols icons. No emoji.
Compose with DS components (Sidebar, TopBar, PageHeader, Card, StatCard, Badge, Button, Select, TextField,
Toggle, FilterChips, Stepper, ActivityFeed…).

## Data conventions
- Pay periods: `PP-{YYYY}-{NN}` quincenas (`frontend/src/lib/periodService.js`, `backend/src/payroll.js`): 1–15 and
  16–end of month; pay date = period end + 5 days. Unlocked existing rows are corrected on load. The app uses
  the real current date (attendance engine `MGH_ATT.TODAY` included); no frozen demo date.
- No sample data: screens show backend data or an empty state. A day without punches is "No Record", not "Absent".
- 12 statuses: Draft → Open → Awaiting Employee/Supervisor/PM/HR/Finance → Processing → Approved → Paid →
  Closed → Archived. Locked periods are immutable; corrections only via Payroll Adjustments.
- Company: My Global Hub (Dominicana SRL, RNC 133-474018, Punta Cana) is the single umbrella company and the only
  organization/tenant (`MGH Dominicana SRL` in RBAC). Arawaki (e-commerce), Wokokai (social network) and Treslog
  (shipping app) are PROJECTS inside it — not legal entities, tenants or clients. No "MGH USA Inc." / "MGH UK Ltd.".
- Accounts: never a shared default password. New employee/contractor logins get a random one-time password
  (`initialPassword`, shown once). Google-only accounts have no local password until they set one via
  `POST /api/auth/password` (current password, Google re-verification, or none set yet).
- Payouts: bank, Coinbase (USDC/BTC/ETH on Base/Ethereum/Polygon/Solana) or split; must total 100%.
  Coinbase requires KYC + W-8BEN.

## Gotchas
- Check `src/kit/kit.jsx` and `NAV` in `src/lib/payroll.js` before adding a screen; contractor screens exist.
- When scripting edits, never use `String.replace` with replacement text containing `$'`, `$&` or `` $` ``.
- Backend stores masked `acct`/`nid` only. Swap `src/db.js` for a real database before production use.
- **CRITICAL FIREBASE RULE:** NEVER run automated tests against live production Firebase (`hr-myglobalhub-net`). The project is on the Free Spark Plan (50k reads/day limit). All automated tests MUST run strictly against local SQLite (`DATABASE_CLIENT=sqlite`, `DISABLE_REMOTE_FIREBASE=true`). Production Firebase is reserved exclusively for live app execution with real users.
