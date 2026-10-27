# My Global Hub — Enterprise Payroll (project notes)

## Entry point
- `My Global Hub.dc.html` — single-page app (Design Component). Open in a browser; routes persist in the URL hash (e.g. `#periods`, `#mytime`, `#addEmployee`, `#paystub`).
- `support.js` — DC runtime (do not edit).

## Design system (binding)
- My Global Hub Design System, bound at `_ds/my-global-hub-design-system-2a603dc7-793a-4b65-aaf1-7c1fdd79f90c/`.
- Load its tokens + `_ds_bundle.js` in `<helmet>`; compose with its components (`MyGlobalHubDesignSystem_2a603d.*`: Sidebar, TopBar, PageHeader, Card, StatCard, Badge, Button, Select, TextField, Toggle, FilterChips, Stepper, ActivityFeed…).
- Navy sidebar #132A52, primary #334296, accent #0094CC, Plus Jakarta Sans, Material Symbols icons. No emoji.
- Logo: `assets/logo-mgh.png` (user-supplied sphere mark).

## Structure
- `app/kit.jsx` — the design system's enterprise UI-kit screens (dashboard, approvals, queue, timesheets, employees, profile, payroll, processing, paystub, banking, jira, projects, reports, admin, settings, audit, contractors, contractorPayments), bundled with each file scoped in an IIFE. Screens register on `window.__MGH_KIT` (NOT `window.SCREENS`, which the DS bundle also defines with wrong asset paths). `KitScreen` rewrites avatar paths to `assets/avatars/`.
- Custom screens are template markup inside the DC: Pay Periods & Processing, Adjustments, Approval Workflows, My Time Entry, Add Employee, Proof of Payment (renders under the Pay Stub).

## Data conventions
- Pay periods: bi-weekly, `PP-{YYYY}-{NN}`, PP-2025-01 starts Dec 24 2024; app "today" = Tue Apr 15 2025 (PP-2025-08 in PM approval, PP-2025-09 open).
- 12 period statuses: Draft → Open → Awaiting Employee/Supervisor/PM/HR/Finance → Processing → Approved → Paid → Closed → Archived. Locked periods are immutable; corrections only via Payroll Adjustments.
- Companies: My Global Hub (Dominicana SRL, RNC 133-474018, Punta Cana), Kairoon, Arawaki.
- Payouts: bank deposit, Coinbase (USDC/BTC/ETH on Base/Ethereum/Polygon/Solana), or split; allocations must total 100%. Coinbase requires KYC + W-8BEN.

## Editing gotchas
- When scripting edits, never use `String.replace` with replacement text containing `$'`, `$&` or `` $` `` (e.g. `'$'+x`) — use split/join.
- Check `app/kit.jsx` and the NAV array before adding a screen; contractor screens already exist there.
