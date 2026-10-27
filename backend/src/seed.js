// Initial demo data (mirrors the Claude Design prototype). Copied into data/db.json on first run.
const ADJUSTMENTS = [
  {
    "id": "MGH-1042",
    "name": "Joshua Hernandez",
    "role": "Project Manager & Lead",
    "avatar": "https://lh3.googleusercontent.com/a/ACg8ocIbwZhRWfile1B8LjT1SHb6EYXpIY1tl02ZKuXfwRA5l08ySGLc=s96-c",
    "type": "Q1 Performance Bonus",
    "cat": "Discretionary incentive pool",
    "kind": "bonus",
    "amt": 5000,
    "tax": "DGII Taxable ISR",
    "taxTone": "info",
    "target": "Banco BHD León (80%) • Chase USA (20%)",
    "by": "Elena Rostova • Apr 11, 09:42",
    "status": "Approved & Queued"
  },
  {
    "id": "MGH-1088",
    "name": "Sofia Almonte",
    "role": "UI/UX Architect",
    "type": "Remote Office Stipend",
    "cat": "Hardware & ergonomics",
    "kind": "stipend",
    "amt": 1200,
    "tax": "TSS Exempt",
    "taxTone": "success",
    "target": "Banco Popular • DOP checking",
    "by": "Marcus Vance • Apr 10, 16:15",
    "status": "Tax Audited"
  },
  {
    "id": "MGH-1102",
    "name": "David Wu",
    "role": "DevOps Engineer",
    "type": "Retroactive OT Parity",
    "cat": "Cycle PP-2025-07 Jira on-call delta",
    "kind": "retro",
    "amt": 850,
    "tax": "DGII Taxable ISR",
    "taxTone": "info",
    "target": "Chase Bank USA • 100%",
    "by": "Elena Rostova • Apr 12, 11:08",
    "status": "Pending 2FA"
  },
  {
    "id": "MGH-0975",
    "name": "Mariana Reyes",
    "role": "QA Automation Lead",
    "avatar": null,
    "type": "Health Plan Upgrade",
    "cat": "ARS Humano international coverage",
    "kind": "deduction",
    "amt": -450,
    "tax": "Statutory Deduction",
    "taxTone": "neutral",
    "target": "Payroll retention • internal ledger",
    "by": "System automated • Apr 01, 00:01",
    "status": "Approved & Queued"
  },
  {
    "id": "MGH-1120",
    "name": "Javier Peña",
    "role": "Backend Engineer",
    "avatar": null,
    "type": "Equipment Reimbursement",
    "cat": "Laptop dock & monitor",
    "kind": "stipend",
    "amt": 640,
    "tax": "TSS Exempt",
    "taxTone": "success",
    "target": "Banreservas • 100%",
    "by": "Ana Gómez • Apr 09, 14:20",
    "status": "Pending Approval"
  }
];

const JIRA_ISSUES = {
  "ATLAS-412": "GraphQL API Optimization",
  "ATLAS-420": "Hotfix: Redis Cluster Failover",
  "ATLAS-415": "Auth Microservice Integration",
  "CORE-108": "Database Sharding Pipeline",
  "ATLAS-104": "Standup & Sprint Planning"
};

const WORKLOGS = [
  { id: 'wl-1', key: 'ATLAS-412', title: 'GraphQL API Optimization', desc: 'Resolver batching for payroll register query', hrs: 0.75 },
];

module.exports = {
  initialData: () => ({
    adjustments: JSON.parse(JSON.stringify(ADJUSTMENTS)),
    worklogs: JSON.parse(JSON.stringify(WORKLOGS)),
    proofs: [],
    employees: [],
    periodOverrides: {},
    nextEmployeeNo: 1163,
  }),
  JIRA_ISSUES,
};
