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
  16–end of month; pay date = period end + 5 days. Unlocked existing rows are corrected on load. New rows are Open once
  started, else Draft — never Closed by the calendar (old auto-closed rows: `scripts/reopen-auto-closed-periods.js`).
  `#periods` reads the stored rows (`periodsDb`) and lists only the current, the next and periods with timesheets or a
  payroll run. The app uses
  the real current date (attendance engine `MGH_ATT.TODAY` included); no frozen demo date.
- No sample data: screens show backend data or an empty state. A day without punches is "No Record", not "Absent".
- 12 statuses: Draft → Open → Awaiting Employee/Supervisor/PM/HR/Finance → Processing → Approved → Paid →
  Closed → Archived. Locked periods are immutable; corrections only via Payroll Adjustments.
- Company: My Global Hub (Dominicana SRL, RNC 133-474018, Punta Cana) is the single umbrella company and the only
  organization/tenant (`MGH Dominicana SRL` in RBAC). Arawaki (e-commerce), Wokokai (social network) and Treslog
  (shipping app) are PROJECTS inside it — not legal entities, tenants or clients. No "MGH USA Inc." / "MGH UK Ltd.".
- My time (employee, contractor, PM, supervisor — always their OWN record), `src/kit/MyTimeView.jsx` + `MyTimesheets.jsx`:
  `#myentry` log daily activities (only while that quincena's sheet is Draft/Returned) • `#mysheets` one row per quincena,
  live hours while editable, submit • `#myhistory` status timeline of own sheets + leave. Team review stays in
  `#approvals` / `#queue` / `#timesheets`. Backend rules (`timesheets.controller.js`): hours are computed from activities
  (+ approved paid leave, paid holidays; OT by org rule) and frozen on submit; 0 worked+leave hours can't be submitted;
  only sheets under review can be approved/returned/adjusted; nobody but admin approves their own sheet; activities are
  written only by their owner (admin may correct) and locked once the sheet leaves Draft/Returned.
- Meeting attendees: a pm/supervisor/admin logging a `Reunión` activity may send `attendees: [empId]` to
  `POST /activities`; `createMeeting` (`activities.controller.js`) creates the organizer's activity plus one copy per
  active attendee (same hours, shared `meeting_id`, `logged_by` = organizer) in one transaction. Attendees whose
  quincena sheet isn't Draft/Returned are skipped and returned in `meeting.skipped`. Copies are independent of the
  organizer's row; the attendee may delete theirs while editable. This is the only exception to "owner writes".
- Review → pay flow: employee logs activities (optionally on project tasks) → submits (hours frozen) → PM step
  (`#approvals`): per-activity review `POST /timesheets/:id/activities/:aid/review` (all / partial with mandatory reason /
  none), comments `POST /timesheets/:id/comments` (stored in sheet history), approve recomputes hours from the decisions
  → owner step (stepIdx ≥ 1, admin only) → Approved. `#processing`: run pays only Approved sheets (`notIncluded` lists the
  rest) → approve run → bank/USDC files (only from an approved run) → `POST /payroll/runs/:id/paid` (admin) marks run,
  sheets and period Paid. Employee sees decisions on each activity (`#myentry`) and in `#myhistory`.
- Projects (`jira_projects`): MSHP "Wokokai" (keeps the Jira key), ARW "Arawaki", TR3 "Tr3slog"
  (`backend/scripts/setup-mgh-projects.js`). Membership = `project_members.user_id` = employee id (or the employee
  profile's `project`). Employees/contractors/supervisors see only member projects (`#projects` → `MyProjects.jsx`),
  create tasks (auto-assigned to themselves) and move tasks assigned to them; PM/admin manage projects, members,
  sprints, statuses and assign by employee id (`AgileWorkspace.jsx`). Add Employee "Projects" creates memberships.
  Backend enforcement in `routes.js` (`requireProjectMember`, `taskAccess`); task search is membership-scoped.
- Accounts: never a shared default password. New employee/contractor logins get a random one-time password
  (`initialPassword`, shown once); a password typed by the admin must pass `passwordProblem`. Either way the account gets
  `must_change_password=1`: `authenticate` answers 403 `PASSWORD_CHANGE_REQUIRED` (except /auth/me, /auth/password,
  /auth/logout) until the user replaces it, and App.jsx shows a non-dismissable modal. Create responses carry
  `account.status` (created | linked | conflict | failed | none); an email already linked to another employee is never
  taken over. Forgotten password: "Restablecer contraseña" on the employee profile (HR/admin/PM, not own profile; only admin
  for an admin; a PM only for employee/contractor/supervisor accounts)
  System roles (one per login): employee, contractor, supervisor, pm, hr, finance, admin (= Platform Admin, top level,
  passes every `requireRole`). Who may give which role on creation: `ASSIGNABLE_ROLES` in `auth.service.js` (PM →
  employee/contractor/supervisor; a job title never escalates beyond that). Admin changes roles on the profile card
  "Acceso al sistema" (`PUT /employees/:id/account/role`; not own role, not the last admin). Bootstrap admins:
  `node scripts/set-user-role.js --role admin <email…>` (dry run) / `--apply` (reads live Firestore, then asks CAMBIAR).
- Removing an employee ("Eliminar empleado" on the profile; PM for team accounts, admin for any; never yourself or the
  last admin): `GET /employees/:id/removal` previews, `DELETE /employees/:id` cascades over operational data
  (activities, unpaid sheets, punches, leave, memberships, task assignment, contractor rows, login + sessions) and is
  refused (409) with payroll history (approved/paid sheets, run lines, approved adjustments, paid contractor payments);
  then `POST /employees/:id/deactivate` (status Terminated, login disabled, history kept). `employees.controller.js`. → `POST /employees/:id/reset-password` issues a new temporary password (shown once), revokes the
  user's sessions and sets must_change_password. Google-only accounts have no local password until they set one via
  `POST /api/auth/password` (current password, Google re-verification, or none set yet).
- Payouts: bank, Coinbase (USDC/BTC/ETH on Base/Ethereum/Polygon/Solana) or split; must total 100%.
  Coinbase requires KYC + W-8BEN.
- Contractors are employees: `employees.type` (Full-time / Contractor) is only a profile field — hours, tasks and payroll
  ignore it, and it never sets the login role (`ensureUserForEmployee({ keepExistingRole: true })`; new logins = employee).
  `#contractors` is the payout profile of Contractor-type employees; one payroll for everyone (#processing):
  `POST /contractor-payments` answers 410. Never fill missing payout/contact data with sample values
  (`scripts/clear-placeholder-contractor-data.js` cleans old ones).
- Payout files (`banking-rails.service.js`) never invent a wallet, account, NID or demo line: missing/masked data → 409
  naming the employees, nothing generated. Crypto share goes only to the USDC batch, the rest only to bank files.
  Company identifiers come from env: `MGH_ACH_COMPANY_ID`, `MGH_BHD_COMPANY_ACCOUNT` (`MGH_BHD_COMPANY_RNC` defaults to 133474018).

## Gotchas
- Check `src/kit/kit.jsx` and `NAV` in `src/lib/payroll.js` before adding a screen; contractor screens exist.
- When scripting edits, never use `String.replace` with replacement text containing `$'`, `$&` or `` $` ``.
- Backend stores masked `acct`/`nid` only. Swap `src/db.js` for a real database before production use.
- Enforced in code: any test process (`NODE_TEST_CONTEXT` / `NODE_ENV=test`) is pinned to SQLite in
  `src/db/connection.js` and the Firebase Admin SDK stays offline (`firebase.service.js`), even with `node --test`
  run directly. `firestore_pure.test.js` only runs with `ALLOW_FIRESTORE_IN_TESTS=true`. Guard: `test/test_isolation.test.js`.
  Old test leftovers in production: `node scripts/cleanup-test-artifacts.js` (dry run) / `--apply`.
- **CRITICAL FIREBASE RULE:** NEVER run automated tests against live production Firebase (`hr-myglobalhub-net`). The project is on the Free Spark Plan (50k reads/day limit). All automated tests MUST run strictly against local SQLite (`DATABASE_CLIENT=sqlite`, `DISABLE_REMOTE_FIREBASE=true`). Production Firebase is reserved exclusively for live app execution with real users.
