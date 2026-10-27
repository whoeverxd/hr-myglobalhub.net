const { query, getOne, execute, transaction } = require('./connection');
const { buildPeriods } = require('../payroll');

const INITIAL_EMPLOYEES = [
  {
    id: 'MGH-1001',
    name: 'Edwin Montalvo',
    role: 'Chief Executive Officer / Dueño',
    dept: 'Executive',
    type: 'Full-time',
    entity: 'MGH USA Inc.',
    loc: 'Miami, FL',
    mgr: 'Board of Directors',
    project: 'Global Platform',
    rate: 120.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-1.jpg',
    bank: 'Chase USA',
    routing: '021000021',
    acct: '9876543210',
    cur: 'USD',
    alloc: 100,
    crypto_alloc: 0,
    email: 'edwin@myglobalhub.net',
  },
  {
    id: 'MGH-1042',
    name: 'Joshua Hernandez',
    role: 'Project Manager & Lead',
    dept: 'Engineering',
    type: 'Full-time',
    entity: 'MGH Dominicana SRL',
    loc: 'Punta Cana, DR',
    mgr: 'Edwin Montalvo',
    project: 'MSHP — Project Planning',
    rate: 65.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-2.jpg',
    bank: 'Banco BHD León',
    routing: 'BHDLDO22',
    acct: '1029384756',
    cur: 'USD',
    alloc: 80,
    crypto_alloc: 20,
    crypto_asset: 'USDC',
    crypto_network: 'Base',
    crypto_wallet: '0x3aB858B5d06456EaFeEfa24e86895315B91a9F12',
    email: 'joshua@myglobalhub.net',
  },
  {
    id: 'MGH-1043',
    name: 'Zain Rondon',
    role: 'Full Stack Developer',
    dept: 'Engineering',
    type: 'Contractor',
    entity: 'MGH Dominicana SRL',
    loc: 'Santiago, DR',
    mgr: 'Joshua Hernandez',
    project: 'MSHP — Project Planning',
    rate: 50.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-3.jpg',
    bank: 'Banco BHD León',
    routing: 'BHDLDO22',
    acct: '2039485761',
    cur: 'USD',
    alloc: 100,
    crypto_alloc: 0,
    email: 'zain@myglobalhub.net',
  },
  {
    id: 'MGH-1044',
    name: 'Luis Rodriguez',
    role: 'Backend & Mobile Developer',
    dept: 'Engineering',
    type: 'Full-time',
    entity: 'MGH Dominicana SRL',
    loc: 'Santo Domingo, DR',
    mgr: 'Joshua Hernandez',
    project: 'MSHP — Project Planning',
    rate: 50.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-4.jpg',
    bank: 'Banreservas',
    routing: 'RESRDO22',
    acct: '3049586712',
    cur: 'USD',
    alloc: 100,
    crypto_alloc: 0,
    email: 'luis@myglobalhub.net',
  },
  {
    id: 'MGH-1045',
    name: 'Lissandra',
    role: 'UI/UX Designer & Frontend Developer',
    dept: 'Engineering',
    type: 'Full-time',
    entity: 'MGH Dominicana SRL',
    loc: 'Santo Domingo, DR',
    mgr: 'Joshua Hernandez',
    project: 'MSHP — Project Planning',
    rate: 45.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-5.jpg',
    bank: 'Banco BHD León',
    routing: 'BHDLDO22',
    acct: '4059687123',
    cur: 'USD',
    alloc: 100,
    crypto_alloc: 0,
    email: 'lissandra@myglobalhub.com',
  },
  {
    id: 'MGH-1046',
    name: 'Juan Zamora',
    role: 'QA Engineer & Developer',
    dept: 'Engineering',
    type: 'Full-time',
    entity: 'MGH Dominicana SRL',
    loc: 'Santo Domingo, DR',
    mgr: 'Joshua Hernandez',
    project: 'MSHP — Project Planning',
    rate: 45.0,
    status: 'Ready',
    avatar: 'assets/avatars/person-6.jpg',
    bank: 'Banreservas',
    routing: 'RESRDO22',
    acct: '5069788234',
    cur: 'USD',
    alloc: 100,
    crypto_alloc: 0,
    email: 'juan.zamora@myglobalhub.com',
  },
];

const INITIAL_ADJUSTMENTS = [
  {
    id: 'MGH-1042',
    name: 'Joshua Hernandez',
    role: 'Project Manager & Lead',
    avatar: 'assets/avatars/person-2.jpg',
    type: 'Q1 Performance Bonus',
    cat: 'Discretionary incentive pool',
    kind: 'bonus',
    amt: 5000,
    tax: 'DGII Taxable ISR',
    taxTone: 'info',
    target: 'Banco BHD León (80%) • Chase USA (20%)',
    by_user: 'Edwin Montalvo • Apr 11, 09:42',
    status: 'Approved & Queued',
  },
  {
    id: 'MGH-1043',
    name: 'Zain Rondon',
    role: 'Full Stack Developer',
    avatar: 'assets/avatars/person-3.jpg',
    type: 'Remote Office Stipend',
    cat: 'Hardware & ergonomics',
    kind: 'stipend',
    amt: 1200,
    tax: 'TSS Exempt',
    taxTone: 'success',
    target: 'Banco BHD León • DOP checking',
    by_user: 'Joshua Hernandez • Apr 10, 16:15',
    status: 'Tax Audited',
  },
  {
    id: 'MGH-1044',
    name: 'Luis Rodriguez',
    role: 'Backend & Mobile Developer',
    avatar: 'assets/avatars/person-4.jpg',
    type: 'Equipment Reimbursement',
    cat: 'Development workstation & monitors',
    kind: 'stipend',
    amt: 850,
    tax: 'TSS Exempt',
    taxTone: 'success',
    target: 'Banreservas • 100%',
    by_user: 'Joshua Hernandez • Apr 12, 11:08',
    status: 'Approved & Queued',
  },
];

const INITIAL_WORKLOGS = [
  { id: 'wl-1', issue_key: 'MSHP-396', title: 'Refactorizacion codigo flutter', desc: 'Componentes inline y refactorizaciones', hrs: 3.5, employee_id: 'MGH-1042' },
  { id: 'wl-2', issue_key: 'MSHP-401', title: 'Flujo de cancelacion de plan', desc: 'Implementación del backend y reglas de negocio', hrs: 4.0, employee_id: 'MGH-1043' },
  { id: 'wl-3', issue_key: 'MSHP-400', title: 'Pagina de checkout', desc: 'Simulacion de pagos y endpoints', hrs: 4.0, employee_id: 'MGH-1044' },
];

const INITIAL_USERS = [
  {
    id: 'usr-admin',
    email: 'admin@myglobalhub.net',
    name: 'Admin System',
    role: 'admin',
    entity: 'MGH Dominicana SRL',
    password: 'AdminPassword123!',
  },
  {
    id: 'usr-admin-com',
    email: 'admin@myglobalhub.com',
    name: 'Admin System',
    role: 'admin',
    entity: 'MGH Dominicana SRL',
    password: 'AdminPassword123!',
  },
  {
    id: 'usr-edwin',
    email: 'edwin@myglobalhub.net',
    name: 'Edwin Montalvo',
    role: 'admin',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1001',
    avatar: 'assets/avatars/person-1.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-joshua',
    email: 'joshua@myglobalhub.net',
    name: 'Joshua Hernandez',
    role: 'pm',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1042',
    avatar: 'assets/avatars/person-2.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-joshua-com',
    email: 'joshua@myglobalhub.com',
    name: 'Joshua Hernandez',
    role: 'pm',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1042',
    avatar: 'assets/avatars/person-2.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-zain',
    email: 'zain@myglobalhub.net',
    name: 'Zain Rondon',
    role: 'contractor',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1043',
    avatar: 'assets/avatars/person-3.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-zain-com',
    email: 'zain@myglobalhub.com',
    name: 'Zain Rondon',
    role: 'contractor',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1043',
    avatar: 'assets/avatars/person-3.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-luis',
    email: 'luis@myglobalhub.net',
    name: 'Luis Rodriguez',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1044',
    avatar: 'assets/avatars/person-4.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-luis-com',
    email: 'luis@myglobalhub.com',
    name: 'Luis Rodriguez',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1044',
    avatar: 'assets/avatars/person-4.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-lissandra',
    email: 'lissandra@myglobalhub.com',
    name: 'Lissandra',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1045',
    avatar: 'assets/avatars/person-5.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-lissandra-net',
    email: 'lissandra@myglobalhub.net',
    name: 'Lissandra',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1045',
    avatar: 'assets/avatars/person-5.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-juan-com',
    email: 'juan.zamora@myglobalhub.com',
    name: 'Juan Zamora',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1046',
    avatar: 'assets/avatars/person-6.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-juan-short',
    email: 'juan@myglobalhub.com',
    name: 'Juan Zamora',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1046',
    avatar: 'assets/avatars/person-6.jpg',
    password: 'Password123!',
  },
  {
    id: 'usr-juan-net',
    email: 'juan.zamora@myglobalhub.net',
    name: 'Juan Zamora',
    role: 'employee',
    entity: 'MGH Dominicana SRL',
    employee_id: 'MGH-1046',
    avatar: 'assets/avatars/person-6.jpg',
    password: 'Password123!',
  },
];

const INITIAL_ORGS = [
  {
    id: 'MGH Dominicana SRL',
    short_name: 'Dominicana',
    country: 'Dominican Republic',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
    language: 'es',
    locale: 'es-DO',
    hour12: 0,
    workdays: 'Mon–Fri',
    payroll_rule: 'Bi-weekly • DGII (ISR + TSS)',
    ot_rule: 'weekly',
    ot_daily_threshold: 8,
    ot_weekly_threshold: 44,
    workflow_steps: [
      { key: 'pm', label: 'PM Review', role: 'pm', review: 'PM Review', description: 'Revisión técnica de actividades, horas y entregables', enabled: true },
      { key: 'owner', label: 'Owner Approval', role: 'admin', review: 'Owner Approval', description: 'Autorización ejecutiva financiera y dispersión de fondos', enabled: true },
    ]
  },
  {
    id: 'MGH USA Inc.',
    short_name: 'USA',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/Chicago',
    language: 'en',
    locale: 'en-US',
    hour12: 1,
    workdays: 'Mon–Fri',
    payroll_rule: 'Bi-weekly • Federal + State',
    ot_rule: 'weekly',
    ot_daily_threshold: 8,
    ot_weekly_threshold: 40,
    workflow_steps: [
      { key: 'pm', label: 'PM Review', role: 'pm', review: 'PM Review', description: 'Revisión técnica de actividades, horas y entregables', enabled: true },
      { key: 'owner', label: 'Owner Approval', role: 'admin', review: 'Owner Approval', description: 'Autorización ejecutiva financiera y dispersión de fondos', enabled: true },
    ]
  },
  {
    id: 'MGH UK Ltd.',
    short_name: 'UK',
    country: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London',
    language: 'en',
    locale: 'en-GB',
    hour12: 0,
    workdays: 'Mon–Fri',
    payroll_rule: 'Bi-weekly • HMRC PAYE',
    ot_rule: 'weekly',
    ot_daily_threshold: 8,
    ot_weekly_threshold: 40,
    workflow_steps: [
      { key: 'pm', label: 'PM Review', role: 'pm', review: 'PM Review', description: 'Revisión técnica de actividades, horas y entregables', enabled: true },
      { key: 'owner', label: 'Owner Approval', role: 'admin', review: 'Owner Approval', description: 'Autorización ejecutiva financiera y dispersión de fondos', enabled: true },
    ]
  }
];

const INITIAL_HOLIDAYS = [
  { id: 'H1', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-01-01', desc: "New Year's Day", paid: 1, working: 0 },
  { id: 'H2', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-01-06', desc: 'Epiphany', paid: 1, working: 0 },
  { id: 'H3', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-01-21', desc: 'Our Lady of Altagracia', paid: 1, working: 0 },
  { id: 'H4', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-01-27', desc: 'Duarte Day (observed)', paid: 1, working: 0 },
  { id: 'H5', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-02-27', desc: 'Independence Day', paid: 1, working: 0 },
  { id: 'H6', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-04-18', desc: 'Good Friday', paid: 1, working: 0 },
  { id: 'H7', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-05-05', desc: 'Labor Day (observed)', paid: 1, working: 0 },
  { id: 'H8', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-06-19', desc: 'Corpus Christi', paid: 1, working: 0 },
  { id: 'H9', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-08-16', desc: 'Restoration Day', paid: 1, working: 0 },
  { id: 'H10', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-09-24', desc: 'Our Lady of Mercedes', paid: 1, working: 0 },
  { id: 'H11', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-11-10', desc: 'Constitution Day (observed)', paid: 1, working: 0 },
  { id: 'H12', org: 'MGH Dominicana SRL', country: 'Dominican Republic', region: 'National', date: '2025-12-25', desc: 'Christmas Day', paid: 1, working: 0 },
  { id: 'H13', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-01-01', desc: "New Year's Day", paid: 1, working: 0 },
  { id: 'H14', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-05-26', desc: 'Memorial Day', paid: 1, working: 0 },
  { id: 'H15', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-07-04', desc: 'Independence Day', paid: 1, working: 0 },
  { id: 'H16', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-09-01', desc: 'Labor Day', paid: 1, working: 0 },
  { id: 'H17', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-11-27', desc: 'Thanksgiving', paid: 1, working: 0 },
  { id: 'H18', org: 'MGH USA Inc.', country: 'United States', region: 'Federal', date: '2025-12-25', desc: 'Christmas Day', paid: 1, working: 0 },
  { id: 'H19', org: 'MGH UK Ltd.', country: 'United Kingdom', region: 'England', date: '2025-04-18', desc: 'Good Friday', paid: 1, working: 0 },
  { id: 'H20', org: 'MGH UK Ltd.', country: 'United Kingdom', region: 'England', date: '2025-04-21', desc: 'Easter Monday', paid: 1, working: 0 },
  { id: 'H21', org: 'MGH UK Ltd.', country: 'United Kingdom', region: 'England', date: '2025-05-05', desc: 'Early May bank holiday', paid: 1, working: 0 },
  { id: 'H22', org: 'MGH UK Ltd.', country: 'United Kingdom', region: 'England', date: '2025-12-25', desc: 'Christmas Day', paid: 1, working: 0 },
];

const INITIAL_LEAVE = [];

const INITIAL_TIMESHEETS = [
  { id: 'TS-2025-08-MGH-1042', emp: 'MGH-1042', name: 'Joshua Hernandez', period: 'PP-2025-08', status: 'Draft', step: 0, reg: 0, ot: 0, pto: 0, hol: 0, tot: 0 },
  { id: 'TS-2025-09-MGH-1042', emp: 'MGH-1042', name: 'Joshua Hernandez', period: 'PP-2025-09', status: 'Draft', step: 0, reg: 0, ot: 0, pto: 0, hol: 0, tot: 0 },
  { id: 'TS-2025-08-MGH-1043', emp: 'MGH-1043', name: 'Zain Rondon', period: 'PP-2025-08', status: 'Draft', step: 0, reg: 0, ot: 0, pto: 0, hol: 0, tot: 0 },
  { id: 'TS-2025-08-MGH-1044', emp: 'MGH-1044', name: 'Luis Rodriguez', period: 'PP-2025-08', status: 'Draft', step: 0, reg: 0, ot: 0, pto: 0, hol: 0, tot: 0 },
];

function seedDatabaseIfEmpty() {
  const periodCount = getOne('SELECT COUNT(*) as count FROM pay_periods').count;
  if (periodCount === 0) {
    transaction(() => {
      // 1. Pay periods for 2025 & 2026
      const periods = [...buildPeriods(2025), ...buildPeriods(2026)];
      for (const p of periods) {
        execute(
          `INSERT INTO pay_periods (id, year, period_number, start_date, end_date, pay_date, cutoff, status, is_locked)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.id.includes('2026') ? 2026 : 2025, p.n, p.start, p.end, p.payDate, p.cutoff, p.status, p.locked ? 1 : 0]
        );
      }

      // Initial audit entry
      execute(
        `INSERT INTO audit_logs (actor, action, entity_type, entity_id, new_values)
         VALUES ('System', 'DATABASE_INITIALIZED', 'system', 'init', '{"status":"ok","version":"1.0"}')`
      );
    });
    console.log('[db] Seeded initial pay periods.');
  }

  // Ensure all employees in INITIAL_EMPLOYEES exist and are synced
  transaction(() => {
    for (const e of INITIAL_EMPLOYEES) {
      const existingEmp = getOne('SELECT id FROM employees WHERE id = ?', [e.id]);
      if (!existingEmp) {
        execute(
          `INSERT INTO employees (
            id, name, role, dept, type, entity, loc, mgr, project, rate, status, avatar,
            bank, acct, routing, cur, alloc, crypto_wallet, crypto_asset, crypto_network, crypto_alloc, email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id, e.name, e.role, e.dept, e.type, e.entity, e.loc, e.mgr, e.project, e.rate, e.status, e.avatar || null,
            e.bank || null, e.acct || null, e.routing || null, e.cur || 'USD', e.alloc ?? 100,
            e.crypto_wallet || null, e.crypto_asset || null, e.crypto_network || null, e.crypto_alloc ?? 0, e.email
          ]
        );
      } else {
        execute(
          `UPDATE employees SET
            name = ?, role = ?, dept = ?, type = ?, entity = ?, loc = ?, mgr = ?, project = ?, rate = ?, status = ?, email = ?
           WHERE id = ?`,
          [e.name, e.role, e.dept, e.type, e.entity, e.loc, e.mgr, e.project, e.rate, e.status, e.email, e.id]
        );
      }
    }
  });

  const employeeCount = getOne('SELECT COUNT(*) as count FROM employees').count;
  if (employeeCount === INITIAL_EMPLOYEES.length) {
    transaction(() => {
      // 3. Initial adjustments
      for (const a of INITIAL_ADJUSTMENTS) {
        const existingAdj = getOne('SELECT id FROM payroll_adjustments WHERE id = ? AND type = ?', [a.id, a.type]);
        if (!existingAdj) {
          execute(
            `INSERT INTO payroll_adjustments (id, name, role, avatar, type, cat, kind, amt, tax, taxTone, target, by_user, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [a.id, a.name, a.role, a.avatar || null, a.type, a.cat || null, a.kind, a.amt, a.tax || null, a.taxTone || 'info', a.target || null, a.by_user || null, a.status]
          );
        }
      }

      // 4. Initial worklogs
      for (const w of INITIAL_WORKLOGS) {
        const existingWl = getOne('SELECT id FROM worklogs WHERE id = ?', [w.id]);
        if (!existingWl) {
          execute(
            `INSERT INTO worklogs (id, issue_key, title, desc, hrs, employee_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [w.id, w.issue_key, w.title, w.desc, w.hrs, w.employee_id]
          );
        }
      }
    });
    console.log('[db] Seeded initial employees, adjustments, and worklogs.');
  }

  // Ensure corporate users exist for all employees and admins
  const { generateSalt, hashPassword } = require('../utils/crypto');
  transaction(() => {
    for (const u of INITIAL_USERS) {
      const existing = getOne('SELECT id FROM users WHERE LOWER(email) = ?', [u.email.toLowerCase()]);
      const salt = generateSalt();
      const hash = hashPassword(u.password, salt);
      if (existing) {
        execute(
          `UPDATE users SET
             password_hash = ?, salt = ?, name = ?, role = ?, entity = ?,
             employee_id = ?, avatar = COALESCE(?, avatar), updated_at = datetime('now')
           WHERE id = ?`,
          [hash, salt, u.name, u.role, u.entity, u.employee_id || null, u.avatar || null, existing.id]
        );
      } else {
        execute(
          `INSERT INTO users (id, email, password_hash, salt, name, role, entity, employee_id, avatar, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [u.id, u.email, hash, salt, u.name, u.role, u.entity, u.employee_id || null, u.avatar || null]
        );
      }
    }
  });
  console.log('[db] Seeded/synchronized corporate users.');

  // Ensure organization configs exist (Multi-HQ: DR, US, UK)
  const orgCount = getOne('SELECT COUNT(*) as count FROM organization_configs').count;
  if (orgCount === 0) {
    transaction(() => {
      for (const o of INITIAL_ORGS) {
        execute(
          `INSERT INTO organization_configs (id, short_name, country, currency, timezone, language, locale, hour12, workdays, payroll_rule, ot_rule, ot_daily_threshold, ot_weekly_threshold, workflow_steps_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.id, o.short_name, o.country, o.currency, o.timezone, o.language, o.locale, o.hour12, o.workdays, o.payroll_rule, o.ot_rule, o.ot_daily_threshold, o.ot_weekly_threshold, JSON.stringify(o.workflow_steps)]
        );
      }

      for (const h of INITIAL_HOLIDAYS) {
        execute(
          `INSERT INTO holidays (id, org_id, country, region, date, description, is_paid, is_working)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.id, h.org, h.country, h.region, h.date, h.desc, h.paid, h.working]
        );
      }

      for (const l of INITIAL_LEAVE) {
        execute(
          `INSERT INTO leave_requests (id, employee_id, employee_name, type, from_date, to_date, reason, status, history_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [l.id, l.emp, l.name, l.type, l.from, l.to, l.reason, l.status, JSON.stringify([{ at: new Date().toISOString(), actor: l.name, action: 'submitted' }])]
        );
      }

      for (const t of INITIAL_TIMESHEETS) {
        execute(
          `INSERT INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.emp, t.name, t.period, t.status, t.step, t.reg, t.ot, t.pto, t.hol, t.tot, JSON.stringify([{ at: new Date().toISOString(), actor: t.name, action: t.status }])]
        );
      }
    });
    console.log('[db] Seeded initial organizations, holidays, leaves, timesheets, and attendance records.');
  } else {
    // Ensure existing organizations reflect the 2-tier verification workflow (PM Review -> Owner Approval)
    for (const o of INITIAL_ORGS) {
      execute(
        `UPDATE organization_configs SET workflow_steps_json = ? WHERE id = ?`,
        [JSON.stringify(o.workflow_steps), o.id]
      );
    }
  }

  // Ensure progressive rollout stages exist (Dominicana -> USA -> UK)
  const stageCount = getOne('SELECT COUNT(*) as count FROM rollout_stages').count;
  if (stageCount === 0) {
    transaction(() => {
      execute(
        `INSERT INTO rollout_stages (id, phase, org_id, short_name, country, status, effective_date, description)
         VALUES
         ('STAGE-1', 1, 'MGH Dominicana SRL', 'Dominicana', 'Dominican Republic', 'LIVE_ACTIVE', '2025-04-01', 'Fase 1: Piloto completado y en produccion activa con personal de Santiago y Punta Cana'),
         ('STAGE-2', 2, 'MGH USA Inc.', 'USA', 'United States', 'SCHEDULED_STAGE_2', '2025-05-01', 'Fase 2: Segunda etapa para personal corporativo US y contratistas remotos'),
         ('STAGE-3', 3, 'MGH UK Ltd.', 'UK', 'United Kingdom', 'SCHEDULED_STAGE_3', '2025-06-01', 'Fase 3: Tercera etapa para operaciones de Londres y contratistas europeos')`
      );
    });
    console.log('[db] Seeded initial progressive rollout stages.');
  }

  // Ensure initial Jira cache exists for offline / local-first operation
  const jiraCacheCount = getOne('SELECT COUNT(*) as count FROM jira_issues_cache').count;
  if (jiraCacheCount === 0) {
    const SEED_JIRA_ISSUES = [
      { key: 'MSHP-101', project: 'MSHP', summary: 'Configuración inicial del tablero y flujos de trabajo Jira', type: 'Story', status: 'In Progress', assignee: 'Elena Rostova', email: 'elena.rostova@myglobalhub.com', est: 8.0, logged: 3.5, url: 'https://myglobalhub.atlassian.net/browse/MSHP-101' },
      { key: 'MSHP-102', project: 'MSHP', summary: 'Integración de webhooks y sincronización de registros de trabajo', type: 'Task', status: 'In Progress', assignee: 'Carlos Mendez', email: 'carlos.mendez@myglobalhub.com', est: 6.0, logged: 2.0, url: 'https://myglobalhub.atlassian.net/browse/MSHP-102' },
      { key: 'MSHP-105', project: 'MSHP', summary: 'Módulo de conciliación quincenal y alertas de discrepancia', type: 'Feature', status: 'To Do', assignee: 'Sofia Almonte', email: 'sofia.almonte@myglobalhub.com', est: 10.0, logged: 0.0, url: 'https://myglobalhub.atlassian.net/browse/MSHP-105' },
      { key: 'MSH-214', project: 'MSH', summary: 'Implementación del backend relacional SQLite y sesiones', type: 'Story', status: 'Done', assignee: 'Carlos Mendez', email: 'carlos.mendez@myglobalhub.com', est: 8.0, logged: 8.0, url: 'https://myglobalhub.atlassian.net/browse/MSH-214' },
      { key: 'MSH-215', project: 'MSH', summary: 'Módulo de registro por actividades y equivalencia de jornada', type: 'Feature', status: 'In Progress', assignee: 'Carlos Mendez', email: 'carlos.mendez@myglobalhub.com', est: 12.0, logged: 5.5, url: 'https://myglobalhub.atlassian.net/browse/MSH-215' },
      { key: 'ATLAS-412', project: 'ATLAS', summary: 'GraphQL API Optimization & Batching queries', type: 'Task', status: 'In Progress', assignee: 'David Wu', email: 'david.wu@myglobalhub.com', est: 7.5, logged: 4.0, url: 'https://myglobalhub.atlassian.net/browse/ATLAS-412' },
      { key: 'ATLAS-420', project: 'ATLAS', summary: 'Hotfix: Redis Cluster Failover y reconciliación', type: 'Task', status: 'Done', assignee: 'David Wu', email: 'david.wu@myglobalhub.com', est: 4.0, logged: 4.0, url: 'https://myglobalhub.atlassian.net/browse/ATLAS-420' },
    ];
    transaction(() => {
      for (const item of SEED_JIRA_ISSUES) {
        execute(
          `INSERT INTO jira_issues_cache (key, project_key, summary, issue_type, status, assignee_name, assignee_email, estimate_hours, logged_hours, url, jira_created_at, jira_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [item.key, item.project, item.summary, item.type, item.status, item.assignee, item.email, item.est, item.logged, item.url]
        );
      }
      execute(
        `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, total_synced, last_error)
         VALUES ('main', 'MSHP', datetime('now'), 'IDLE', ?, null)`,
        [SEED_JIRA_ISSUES.length]
      );
    });
    console.log('[db] Seeded initial Jira issues cache and sync status.');
  }

  // Ensure initial Jira projects exist
  const projectRow = getOne('SELECT COUNT(*) as count FROM jira_projects');
  const projectCount = projectRow ? projectRow.count : 0;
  if (projectCount === 0) {
    const DEFAULT_PROJECTS = [
      { id: 'ATLAS', key: 'ATLAS', name: 'Atlas Core Platform', lead: 'Elena Rostova', people: 14, budget: 120000, spent: 84200, hrs: 1610, bill: 94.2, st: 'On track' },
      { id: 'PERF', key: 'PERF', name: 'Perf Infrastructure', lead: 'David Wu', people: 6, budget: 60000, spent: 51800, hrs: 940, bill: 88.1, st: 'At risk' },
      { id: 'GHV3', key: 'GHV3', name: 'Global Hub v3', lead: 'Grace Okafor', people: 11, budget: 95000, spent: 40100, hrs: 780, bill: 97.0, st: 'On track' },
      { id: 'LAKE', key: 'LAKE', name: 'Insights Lake', lead: 'Priya Natarajan', people: 5, budget: 48000, spent: 22600, hrs: 410, bill: 91.6, st: 'On track' },
      { id: 'CORE', key: 'CORE', name: 'Core Billing Services', lead: 'Javier Peña', people: 8, budget: 70000, spent: 71900, hrs: 1205, bill: 85.4, st: 'Over budget' },
      { id: 'OPS', key: 'OPS', name: 'Internal Ops', lead: 'Ana Gómez', people: 9, budget: 30000, spent: 14200, hrs: 520, bill: 0, st: 'Non-billable' },
    ];
    transaction(() => {
      for (const p of DEFAULT_PROJECTS) {
        execute(
          `INSERT OR IGNORE INTO jira_projects (id, key, name, lead, people, budget, spent, hrs, bill, st)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.key, p.name, p.lead, p.people, p.budget, p.spent, p.hrs, p.bill, p.st]
        );
      }
    });
    console.log('[db] Seeded initial Jira projects.');
  }

  // Clean up any legacy placeholder contractors from Figma prototypes
  try {
    execute(`DELETE FROM contractor_payments WHERE contractor_id LIKE 'CTR-010%'`);
    execute(`DELETE FROM contractors WHERE id LIKE 'CTR-010%'`);
  } catch (_) { }

  // Ensure real contractors (Zain Rondon MGH-1043) and contractor payments exist
  const INITIAL_CONTRACTORS = [
    {
      id: 'CTR-1043',
      name: 'Zain Rondon',
      role: 'Full Stack Developer',
      country: 'Dominican Republic',
      email: 'zain@myglobalhub.net',
      phone: '+1 809 555 0192',
      start: 'Feb 10, 2024',
      end: '',
      basis: 'Hourly',
      rate: 50,
      cur: 'USD',
      method: 'Coinbase',
      wallet: '0x3aB8…9F12',
      wallet_full: '0x3aB858B5d06456EaFeEfa24e86895315B91a9F12',
      asset: 'USDC',
      network: 'Base',
      delivery: 'Direct Crypto',
      receiver: 'Zain Rondon',
      city: 'Santiago',
      bank: 'Banco BHD León',
      acct: '2039485761',
      pay_cur: 'USD',
      fx: 1.0,
      wu_fee: 0.01,
      status: 'Active',
      entity: 'MGH Dominicana SRL',
      employee_id: 'MGH-1043'
    }
  ];

  const INITIAL_CONTRACTOR_PAYMENTS = [
    {
      id: 'CPAY-2025-08-1043',
      contractor_id: 'CTR-1043',
      period_id: 'PP-2025-08',
      hours: 80,
      amount: 4000,
      fee: 0.01,
      status: 'Paid',
      date: 'Apr 19, 2025',
      cb_id: 'CB-4A92E1B0',
      hash: '0x8f2d9c4b7e1a3508a462b1df983a5420e6c7104b281f9a0c6482d3e5b9f71a02',
      mtcn: '',
      notes: 'Confirmed on-chain (Base USDC). Contractor acknowledged receipt.'
    }
  ];

  transaction(() => {
    for (const c of INITIAL_CONTRACTORS) {
      execute(
        `INSERT OR REPLACE INTO contractors (id, name, role, country, email, phone, start_date, end_date, basis, rate, cur, method, wallet, wallet_full, asset, network, delivery, receiver, city, bank, acct, pay_cur, fx, wu_fee, status, entity, employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id, c.name, c.role, c.country, c.email || null, c.phone || null,
          c.start || null, c.end || null, c.basis || 'Hourly', c.rate || 0, c.cur || 'USD',
          c.method || 'Coinbase', c.wallet || null, c.wallet_full || null, c.asset || null,
          c.network || null, c.delivery || null, c.receiver || null, c.city || null,
          c.bank || null, c.acct || null, c.pay_cur || 'USD', c.fx || 1.0, c.wu_fee || 4.99,
          c.status || 'Active', c.entity || 'MGH Dominicana SRL', c.employee_id || null
        ]
      );
    }

    for (const p of INITIAL_CONTRACTOR_PAYMENTS) {
      execute(
        `INSERT OR REPLACE INTO contractor_payments (id, contractor_id, period_id, hours, amount, fee, status, date, cb_id, hash, mtcn, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.contractor_id, p.period_id, p.hours ?? null, p.amount || 0,
          p.fee || 0, p.status || 'Calculated', p.date || null, p.cb_id || null,
          p.hash || null, p.mtcn || null, p.notes || null
        ]
      );
    }
  });
  console.log('[db] Seeded initial real contractors and contractor payments.');

  // Ensure clean initial timesheets for all employees exist in Draft with 0 hours
  const employees = query('SELECT id, name FROM employees');
  transaction(() => {
    for (const e of employees) {
      for (const pId of ['PP-2025-08', 'PP-2025-09']) {
        execute(
          `INSERT OR REPLACE INTO timesheets (id, employee_id, employee_name, period_id, status, step_index, regular_hours, overtime_hours, pto_hours, holiday_hours, total_hours, history_json)
           VALUES (?, ?, ?, ?, 'Draft', 0, 0, 0, 0, 0, 0, '[]')`,
          [`TS-${pId}-${e.id}`, e.id, e.name, pId]
        );
      }
    }
  });
}

module.exports = { seedDatabaseIfEmpty };

