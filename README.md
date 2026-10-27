# My Global Hub Timekeeping

Bi-weekly payroll, time entry, approvals, contractor payments and proof of payment for the
My Global Hub ecosystem (My Global Hub Dominicana SRL, Kairoon, Arawaki).

- **frontend/** — React 19 + Vite. Uses the My Global Hub Design System (navy #132A52, primary #334296,
  accent #0094CC, Plus Jakarta Sans, Material Symbols).
- **backend/** — Node + Express API with a JSON-file store (`backend/data/db.json`).
- **design-source/** — the original Claude Design prototype, kept for reference.

## Run it in VS Code

Requires Node 20+.

```bash
npm run install:all   # first time only
npm run dev           # starts API on :5050 and the web app on :5173
```

Open http://localhost:5173. Vite forwards `/api/*` to the backend.

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app with hot reload |
| `npm run build` | Production build into `frontend/dist` |
| `npm start` | Runs the API and serves the built app on http://localhost:5050 |

If the backend is not running, the app still opens with its built-in demo data.

## Screens

Routes live in the URL hash, e.g. `#periods`, `#mytime`, `#addEmployee`, `#adjustments`, `#workflows`, `#paystub`.

- **Custom screens** (`frontend/src/App.jsx`): Pay Periods & Processing, Adjustments, Approval Workflows,
  My Time Entry, Add Employee / Employee Created, Proof of Payment (under the pay stub).
- **Kit screens** (`frontend/src/kit/kit.jsx`): dashboard, approvals, queue, timesheets, employees, profile,
  payroll, processing, paystub, banking, jira, projects, reports, admin, settings, audit, contractors,
  contractorPayments.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | |
| GET | `/api/bootstrap` | Adjustments, worklogs, proofs, period status overrides |
| GET | `/api/periods?year=2025` | 26 bi-weekly cycles, `PP-2025-01` starts Dec 24 2024 |
| PATCH | `/api/periods/:id` | `{ status }`. Closed/Archived periods are immutable (409) |
| GET/POST | `/api/adjustments` | PATCH `/api/adjustments/:id` to approve |
| GET/POST/DELETE | `/api/worklogs` | Jira worklogs for My Time Entry |
| GET/POST/DELETE | `/api/proofs` | One proof per transfer; Coinbase needs a `0x` + 64-hex tx hash |
| GET/POST | `/api/employees` | Assigns `MGH-1163`, `MGH-1164`, … |
| POST | `/api/dev/reset` | Restores demo data (disabled in production) |

Copy `backend/.env.example` to `backend/.env` to change the port or database file.

## Data conventions

- Pay periods are bi-weekly, `PP-{YYYY}-{NN}`. 12 statuses: Draft → Open → Awaiting Employee/Supervisor/PM/HR/Finance
  → Processing → Approved → Paid → Closed → Archived. Corrections to locked periods go through Payroll Adjustments.
- Payouts: bank deposit, Coinbase (USDC/BTC/ETH on Base/Ethereum/Polygon/Solana) or split; allocations must total 100%.
  Coinbase requires KYC + W-8BEN.
- Demo "today" is Tue Apr 15 2025 (PP-2025-08 in PM approval, PP-2025-09 open).

## Push to GitHub

The repo is already initialised with a first commit. In VS Code open **Source Control → Publish Branch**,
or from a terminal:

```bash
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```
