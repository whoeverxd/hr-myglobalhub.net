# My Global Hub — Enterprise Payroll Design System

My Global Hub is a multi-entity **workforce, timesheet and payroll platform** (operating entities in the Dominican Republic, USA and UK). Its core loop: employees log bi-weekly time (reconciled against **Jira Cloud worklogs**), managers approve through a multi-tier lifecycle (Employee → Supervisor → Project Manager → HR → Finance → Lock), and payroll runs, splits deposits across multiple banks, and issues pay stubs. Surfaces: a desktop **admin/manager web app** (primary) and a **mobile ESS app** (clock-in, worklogs, pay stubs).

This system evolves the attached Figma file into a premium enterprise SaaS language, per the brief: white surfaces, navy navigation **#132A52**, primary **#334296**, accent **#0094CC**, Plus Jakarta Sans, rounded cards, soft shadows, large data tables and executive dashboards.

## Sources
- **Figma:** "Timesheet App.fig" (one page, 24 frames): Bi-Weekly Approval Workspace, Team Timesheets & Jira Sync, Employee Directory & Multi-Bank Settings, Pay Periods & Processing, Payroll Adjustments, Branded Pay Stub, Central Banking & Treasury, Departments & Cost Centers, Jira Cloud Sync & Sprint Cost Analytics, Reports – Executive Payroll Register, Organization Multi-HQ Administration, Approval Workflows & Policy Governance, Audit Logs, Webhooks / API Console, API Reference, Workforce Shift Scheduling, and 8 mobile frames.
- **Upload:** `uploads/image.png` — sphere brand mark (copied to `assets/logo-sphere.png`).
- The Figma file defines **no formal components, variables or text styles** (METADATA lists 0 of each). Tokens and components here were extracted from the repeated values in the frames.

## Evolution from Figma → this system
| Figma value | This system |
|---|---|
| Sidebar `#0A2540` | `--mgh-navy` **#132A52** (`#0A2540` kept as `--mgh-navy-900`) |
| Green CTA `#006C47` | `--mgh-primary` **#334296** for actions; green stays **success** |
| — | `--mgh-accent` **#0094CC** for sync / info / live states |
| Neutrals, surfaces, radii, shadows, type scale | Kept exactly |

---

## CONTENT FUNDAMENTALS
- **Voice:** precise, operational, compliance-literate. Copy reads like a controller's ledger, not marketing: "Awaiting Supervisor Approval", "Jira Sync Validated", "Auto-lock in 4d 18h".
- **Casing:** Title Case for buttons, nav and card titles ("Approve & Next Employee", "Return for Corrections"). **UPPERCASE** with +0.55px tracking for overlines, KPI labels and table headers ("PENDING APPROVALS", "HOURLY COST BASIS").
- **Person:** product addresses the user implicitly; system actors are named ("by Compliance Engine", "via Jira Webhook"). Greeting on dashboard uses first name ("Good morning, Elena").
- **Data density:** numbers always carry units and context — `86.5h`, `$52.50 / hr`, `98.2% Match`, `$4,541.25 Est.`. Hours to 1 decimal; money 2 decimals with `$` and currency code when multi-currency (USD, DOP).
- **IDs** are first-class and monospace: `MGH-1042`, `ATLAS-412`, `PP-2025-08`, `•••• 8491`.
- **Separators:** bullet ` • ` joins meta ("Sr. Full Stack Developer • Engineering Department").
- **Statutory specificity:** real regulatory nouns (TSS, AFP, ISR, DGII, RNC / Cédula, Law 87-01, FedWire, ACH, AML).
- **No emoji.** Status is expressed with pills, dots and Material Symbols.

## VISUAL FOUNDATIONS
- **Color:** white cards on white/`#FAF8FF` pages; a lavender-tinted neutral ladder (`#F2F3FF → #EAEDFF → #E2E7FF → #DAE2FD`) for muted tiles, table heads, secondary buttons and borders. Ink `#131B2E`, body `#43474D`, muted `#74777E`. Navy sidebar is the only large dark mass; navy also marks the "final" figure (Est. Gross, Net pay) and dark ID tags.
- **Semantic:** success green `#006C47` on `rgba(113,219,166,.2)`; warning `#BE7E00` / amber `#FFB951`; danger `#BA1A1A` on `#FFDAD6`; info = accent `#0094CC`.
- **Type:** Plus Jakarta Sans throughout. KPI 36/36 ExtraBold −1.08; page title 28/36 Bold −0.7; H2 22; H3 18/24 SemiBold; body 13/18; nav 14/20; overline 11/14 Bold +0.55 uppercase. Mono (Liberation Mono in Figma) for IDs/accounts.
- **Spacing:** auto-layout gaps of 2 / 4 / 8 / 14 / 20 / 28. Card padding 20; page gutter 28; header 64; sidebar 288.
- **Radii:** 4 (mono tags, kbd), 8 (controls, nav items, tiles), 12 (cards), 16 (review panels), pill 9999 (status chips).
- **Cards:** white, 12px radius, `0 1px 2px rgba(0,0,0,.05)` — no borders. Selected cards lift to `shadow-md` with a primary inset left bar and `#EEF0FF` fill. Nested tiles are flat `#F2F3FF`.
- **Shadows:** very soft only — xs (cards), header `0 1px 8px rgba(0,0,0,.04)`, nav `0 1px 8px rgba(0,0,0,.12)`, md for selection, lg for modals/document previews. Focus ring `0 0 0 4px rgba(210,228,255,.5)`.
- **Transparency & blur:** sticky header is `rgba(255,255,255,.9)` + `blur(24px)`; sidebar overlays use white at 5/10/15%; sticky approval bar is tinted + blurred.
- **Backgrounds:** no gradients, textures or illustrations. Imagery is limited to circular professional headshots and the sphere brand mark.
- **Tables:** sticky `#F2F3FF` header with uppercase 11px labels; 1px `#EAEDFF` row dividers; hover `#FAF8FF`; selected `#EEF0FF`; numbers right-aligned tabular; bulk-selection swaps in a navy action bar.
- **Interaction:** hover = one step darker fill (primary → `#2A3780`, tint → next tint). Press relies on the same darker fill (no scale). Transitions 120–200ms `cubic-bezier(.2,0,0,1)`; no bounce.
- **Layout:** fixed 288 sidebar + sticky 64 header; content max ~1600px; KPI rows are 4-up auto-fit grids; detail pages use 2fr/1fr splits.

## ICONOGRAPHY
- **Material Symbols Outlined** (Google, variable font) — the only icon system in the Figma (307 uses at weight 600; 16px inline/nav, 18px card headers). Loaded from Google Fonts CDN; rendered with `<Icon name="…">`.
- Icon colors follow text or the semantic tone; card-header icons use primary.
- No emoji, no custom SVG icon set, no PNG icons. Unicode is used only for `•` separators, `—` empty cells and `⌘K`.
- Logos: `assets/logo-mark.png` (sidebar mark), `assets/logo-lockup.png` (header lockup), `assets/logo-official.png` (pay-stub brand logo), `assets/logo-sphere.png` (uploaded sphere), `assets/letterhead.jpg`.

## Fonts — substitutions
- Plus Jakarta Sans, Material Symbols Outlined: Google Fonts (same as source).
- **Liberation Mono → Cousine** (Google Fonts; same Ascender design, metric-compatible). ⚠️ Flagged substitution — supply Liberation Mono files if exact match matters.

---

## Index
- `styles.css` — entry point (imports only) → `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React primitives (below), one card per folder
- `ui_kits/enterprise/` — full click-through app, 16 screens (see its README)
- `assets/` — logos, avatars
- `SKILL.md` — agent-skill entry

## Components
Extracted from repeated Figma frame patterns (the file defines no formal component sets).
- **core/** Icon, Button, IconButton, Badge, Avatar, Card
- **forms/** SearchField, TextField, Select, Checkbox, Toggle, FilterChips
- **data/** StatCard, MetricTile, DataTable, TableToolbar, Pagination, ProgressBar, Stepper, KeyValue, ActivityFeed
- **navigation/** Sidebar, TopBar, PageHeader, Tabs

### Intentional additions
- **Icon** — wrapper for the Material Symbols glyph set.
- **TextField / Select / Toggle / Pagination / TableToolbar** — required by the brief's enterprise tables and settings screens; styled from Figma's input, chip and key/value patterns.
- The dark "SCREEN: … / MODULE: … / REF" banner in Figma frames is a design-file annotation, not product UI — omitted.
