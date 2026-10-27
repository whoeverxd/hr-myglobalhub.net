const path = require('path');
const fs = require('fs');
const db = require('../db');
const { round2 } = require('../utils/money');
const { logAction } = require('../controllers/audit.controller');

// Asegurar carga de .env para Jira Cloud
if (!process.env.JIRA_API_TOKEN) {
  try {
    const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
    const backendEnv = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(backendEnv)) {
      require('dotenv').config({ path: backendEnv });
    } else if (fs.existsSync(rootEnv)) {
      require('dotenv').config({ path: rootEnv });
    }
  } catch (_) {}
}

const DEFAULT_PROJECTS = [
  { id: 'ATLAS', key: 'ATLAS', name: 'Atlas Core Platform', lead: 'Elena Rostova', people: 14, budget: 120000, spent: 84200, hrs: 1610, bill: 94.2, st: 'On track' },
  { id: 'PERF', key: 'PERF', name: 'Perf Infrastructure', lead: 'David Wu', people: 6, budget: 60000, spent: 51800, hrs: 940, bill: 88.1, st: 'At risk' },
  { id: 'GHV3', key: 'GHV3', name: 'Global Hub v3', lead: 'Grace Okafor', people: 11, budget: 95000, spent: 40100, hrs: 780, bill: 97.0, st: 'On track' },
  { id: 'LAKE', key: 'LAKE', name: 'Insights Lake', lead: 'Priya Natarajan', people: 5, budget: 48000, spent: 22600, hrs: 410, bill: 91.6, st: 'On track' },
  { id: 'CORE', key: 'CORE', name: 'Core Billing Services', lead: 'Javier Peña', people: 8, budget: 70000, spent: 71900, hrs: 1205, bill: 85.4, st: 'Over budget' },
  { id: 'OPS', key: 'OPS', name: 'Internal Ops', lead: 'Ana Gómez', people: 9, budget: 30000, spent: 14200, hrs: 520, bill: 0, st: 'Non-billable' },
];

// Catálogo corporativo de respaldo para modo offline o desarrollo inicial
const DEFAULT_JIRA_ISSUES = [
  { key: 'MSHP-101', summary: 'Configuración inicial del tablero y flujos de trabajo Jira', type: 'Story', status: 'In Progress', estimate: 8.0, assignee: 'Elena Rostova' },
  { key: 'MSHP-102', summary: 'Integración de webhooks y sincronización de registros de trabajo', type: 'Task', status: 'In Progress', estimate: 6.0, assignee: 'Carlos Mendez' },
  { key: 'MSHP-105', summary: 'Módulo de conciliación quincenal y alertas de discrepancia', type: 'Feature', status: 'To Do', estimate: 10.0, assignee: 'Sofia Almonte' },
  { key: 'MSH-201', summary: 'Refactorización del servicio de nómina y deducciones DGII/TSS', type: 'Story', status: 'In Progress', estimate: 8.0, assignee: 'Carlos Mendez' },
  { key: 'MSH-205', summary: 'Diseño e integración de componentes en el Design System', type: 'Task', status: 'In Progress', estimate: 6.0, assignee: 'Sofia Almonte' },
  { key: 'MSH-210', summary: 'Auditoría y optimización de base de datos SQLite', type: 'Story', status: 'In Review', estimate: 5.0, assignee: 'David Wu' },
  { key: 'MSH-214', summary: 'Implementación del backend relacional SQLite y sesiones', type: 'Story', status: 'Done', estimate: 8.0, assignee: 'Carlos Mendez' },
  { key: 'MSH-215', summary: 'Módulo de registro por actividades y equivalencia quincenal', type: 'Feature', status: 'In Progress', estimate: 12.0, assignee: 'Carlos Mendez' },
  { key: 'MSH-220', summary: 'Pruebas unitarias de cálculo de retenciones impositivas', type: 'Test', status: 'To Do', estimate: 4.0, assignee: 'Mariana Reyes' },
  { key: 'MSH-224', summary: 'Generador de archivos NACHA ACH y dispersión electrónica BHD', type: 'Feature', status: 'In Review', estimate: 8.0, assignee: 'Carlos Mendez' },
  { key: 'MSH-230', summary: 'Módulo de evidencias multimedia y vista previa en Lightbox', type: 'Story', status: 'Done', estimate: 6.0, assignee: 'Sofia Almonte' },
  { key: 'ATLAS-412', summary: 'GraphQL API Optimization & query batching', type: 'Task', status: 'In Progress', estimate: 7.5, assignee: 'David Wu' },
  { key: 'ATLAS-420', summary: 'Hotfix: Redis Cluster Failover y reconciliación', type: 'Task', status: 'Done', estimate: 4.0, assignee: 'David Wu' },
];

/**
 * Normaliza y obtiene la configuración de Jira Cloud desde las variables de entorno
 */
function getJiraConfig() {
  const hostRaw = (process.env.JIRA_BASE_URL || process.env.JIRA_HOST || 'https://myglobalhub.atlassian.net').trim();
  const host = hostRaw.replace(/\/+$/, '');
  const email = (process.env.JIRA_EMAIL || '').trim();
  const token = (process.env.JIRA_API_TOKEN || '').trim();
  const projectKey = (process.env.JIRA_PROJECT_KEY || 'MSHP').trim();
  const isConfigured = Boolean(token && email);

  return {
    host,
    email,
    maskedEmail: email ? `${email.slice(0, 3)}***@${email.split('@')[1] || 'atlassian.net'}` : 'no-config@myglobalhub.com',
    token,
    projectKey,
    isConfigured,
    syncIntervalMinutes: 30,
    mode: isConfigured ? 'LIVE_OAUTH2_TOKEN' : 'LOCAL_SPRINT_CATALOG',
  };
}

/**
 * Servicio de Integración con Jira Cloud y Caché Local en SQLite
 */
const jiraService = {
  getConfig() {
    const c = getJiraConfig();
    return {
      host: c.host,
      email: c.maskedEmail,
      isConfigured: c.isConfigured,
      projectKey: c.projectKey,
      syncIntervalMinutes: c.syncIntervalMinutes,
      mode: c.mode,
    };
  },

  /**
   * Diagnóstico y prueba de conectividad contra Jira Cloud
   */
  async testConnection() {
    const config = getJiraConfig();
    if (!config.isConfigured) {
      return {
        ok: false,
        status: 'NOT_CONFIGURED',
        message: 'No se ha podido conectar con Jira: Credenciales no configuradas. Verifica JIRA_EMAIL y JIRA_API_TOKEN en el .env.',
        host: config.host,
        projectKey: config.projectKey,
      };
    }

    try {
      const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
      const res = await fetch(`${config.host}/rest/api/3/myself`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        let errorDetail = '';
        if (res.status === 401) {
          errorDetail = 'Credenciales no válidas o API Token no autorizado (HTTP 401). Verifica tu correo y API token.';
        } else if (res.status === 403) {
          errorDetail = 'Sin permisos para acceder al sitio corporativo de Atlassian (HTTP 403).';
        } else if (res.status === 404) {
          errorDetail = 'El sitio de Jira no fue encontrado (HTTP 404). Verifica JIRA_BASE_URL.';
        } else {
          errorDetail = `Jira API devolvió código HTTP ${res.status}.`;
        }

        return {
          ok: false,
          status: 'UNAUTHORIZED',
          code: res.status,
          message: `No se ha podido conectar con Jira: ${errorDetail}`,
          host: config.host,
          projectKey: config.projectKey,
        };
      }

      const user = await res.json();
      return {
        ok: true,
        status: 'CONNECTED_LIVE',
        message: `Conectado exitosamente a Jira Cloud como ${user.displayName || user.emailAddress || config.email}`,
        user: {
          displayName: user.displayName,
          emailAddress: user.emailAddress,
          accountId: user.accountId,
        },
        host: config.host,
        projectKey: config.projectKey,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'NETWORK_ERROR',
        message: `No se ha podido conectar con Jira: Error de red o tiempo de espera agotado (${err.message})`,
        host: config.host,
        projectKey: config.projectKey,
      };
    }
  },

  /**
   * Garantiza que los proyectos base existan en la tabla jira_projects
   */
  ensureDefaultProjects() {
    // Intencionalmente vacío: los proyectos los crea el usuario o se sincronizan desde Jira.
    // Antes sembraba DEFAULT_PROJECTS (datos de demostración) cada vez que la tabla estaba vacía.
  },

  /**
   * Lista los proyectos vinculados en SQLite con enriquecimiento de tareas y última sincronización
   */
  listProjects() {
    this.ensureDefaultProjects();
    try {
      const rows = db.query('SELECT * FROM jira_projects ORDER BY created_at ASC');
      return rows.map((p) => {
        let lastSync = p.last_sync_at;
        if (!lastSync) {
          const syncRow = db.getOne('SELECT last_sync_at FROM jira_sync_status WHERE id = ? OR project_key = ?', [p.key, p.key]);
          if (syncRow && syncRow.last_sync_at) {
            lastSync = syncRow.last_sync_at;
          } else {
            const cacheRow = db.getOne('SELECT MAX(cached_at) as last_cached FROM jira_issues_cache WHERE project_key = ?', [p.key]);
            if (cacheRow && cacheRow.last_cached) {
              lastSync = cacheRow.last_cached;
            }
          }
        }
        const taskCountRow = db.getOne('SELECT COUNT(*) as count FROM jira_issues_cache WHERE project_key = ?', [p.key]);
        const tasksCount = taskCountRow ? taskCountRow.count : 0;

        let peopleCount = p.people || 0;
        try {
          const countRow = db.getOne(
            `SELECT COUNT(*) as count FROM employees WHERE project LIKE ? OR project = ?`,
            [`%${p.name}%`, p.key]
          );
          if (countRow && countRow.count > 0) {
            peopleCount = countRow.count;
          }
        } catch (_) {}

        return {
          id: p.key,
          key: p.key,
          jira_id: p.jira_id || p.id,
          name: p.name,
          lead: p.lead || 'Sin asignar',
          people: peopleCount,
          budget: p.budget || 0,
          spent: p.spent || 0,
          hrs: p.hrs || 0,
          bill: p.bill != null ? p.bill : 0,
          st: p.st || 'On track',
          last_sync_at: lastSync || null,
          tasks_count: tasksCount,
        };
      });
    } catch (e) {
      console.warn('[Jira] listProjects error:', e.message);
      return [];
    }
  },

  /**
   * Crea un nuevo proyecto en SQLite
   */
  createProject({ key, name, lead, budget, bill, st, user = 'Joshua Hernandez', ip = '127.0.0.1' } = {}) {
    this.ensureDefaultProjects();
    const cleanName = (name || '').trim();
    if (!cleanName) {
      const err = new Error('El nombre del proyecto es obligatorio');
      err.status = 400;
      throw err;
    }

    let cleanKey = (key || '').trim().toUpperCase();
    if (!cleanKey) {
      cleanKey = cleanName.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();
      if (!cleanKey) cleanKey = 'PRJ' + Math.floor(100 + Math.random() * 900);
    }
    cleanKey = cleanKey.replace(/[^A-Z0-9]/g, '');

    const existing = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [cleanKey]);
    if (existing) {
      const err = new Error(`Ya existe un proyecto con la clave ${cleanKey}`);
      err.status = 409;
      throw err;
    }

    const leadName = lead || user || 'Joshua Hernandez';
    const numBudget = Number(budget) || 50000;
    const numBill = bill != null ? Number(bill) : 100;
    const status = st || 'On track';

    db.execute(
      `INSERT INTO jira_projects
       (id, key, name, lead, people, budget, spent, hrs, bill, st, jira_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, datetime('now'), datetime('now'))`,
      [cleanKey, cleanKey, cleanName, leadName, numBudget, numBill, status, cleanKey]
    );

    const created = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [cleanKey]);

    logAction({
      actor: user,
      action: 'PROJECT_CREATED',
      entityType: 'project',
      entityId: cleanKey,
      newValues: { key: cleanKey, name: cleanName, lead: leadName, budget: numBudget, bill: numBill, st: status },
      ip,
    });

    return {
      id: created.key,
      key: created.key,
      jira_id: created.jira_id || created.key,
      name: created.name,
      lead: created.lead,
      people: 0,
      budget: created.budget,
      spent: created.spent,
      hrs: created.hrs,
      bill: created.bill,
      st: created.st,
      tasks_count: 0,
    };
  },

  /**
   * Actualiza los datos de un proyecto en SQLite
   */
  updateProject(key, { name, lead, budget, bill, st, user = 'Joshua Hernandez', ip = '127.0.0.1' } = {}) {
    this.ensureDefaultProjects();
    const normKey = (key || '').trim().toUpperCase();
    const existing = db.getOne('SELECT * FROM jira_projects WHERE key = ? OR id = ?', [normKey, normKey]);
    if (!existing) {
      const err = new Error(`Proyecto ${normKey} no encontrado`);
      err.status = 404;
      throw err;
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedLead = lead !== undefined ? lead : existing.lead;
    const updatedBudget = budget !== undefined ? Number(budget) : existing.budget;
    const updatedBill = bill !== undefined ? Number(bill) : existing.bill;
    const updatedSt = st !== undefined ? st : existing.st;

    db.execute(
      `UPDATE jira_projects
       SET name = ?, lead = ?, budget = ?, bill = ?, st = ?, updated_at = datetime('now')
       WHERE key = ?`,
      [updatedName, updatedLead, updatedBudget, updatedBill, updatedSt, existing.key]
    );

    const updated = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [existing.key]);

    logAction({
      actor: user,
      action: 'PROJECT_UPDATED',
      entityType: 'project',
      entityId: existing.key,
      newValues: { name: updatedName, lead: updatedLead, budget: updatedBudget, bill: updatedBill, st: updatedSt },
      ip,
    });

    return {
      id: updated.key,
      key: updated.key,
      jira_id: updated.jira_id || updated.key,
      name: updated.name,
      lead: updated.lead,
      people: updated.people,
      budget: updated.budget,
      spent: updated.spent,
      hrs: updated.hrs,
      bill: updated.bill,
      st: updated.st,
    };
  },

  /**
   * Elimina un proyecto de SQLite
   */
  deleteProject(key, { user = 'Joshua Hernandez', ip = '127.0.0.1' } = {}) {
    this.ensureDefaultProjects();
    const normKey = (key || '').trim().toUpperCase();
    const existing = db.getOne('SELECT * FROM jira_projects WHERE key = ? OR id = ?', [normKey, normKey]);
    if (!existing) {
      const err = new Error(`Proyecto ${normKey} no encontrado`);
      err.status = 404;
      throw err;
    }

    db.execute('DELETE FROM jira_projects WHERE key = ?', [existing.key]);

    logAction({
      actor: user,
      action: 'PROJECT_DELETED',
      entityType: 'project',
      entityId: existing.key,
      newValues: { key: existing.key, name: existing.name },
      ip,
    });

    return { ok: true, deletedKey: existing.key, message: `Proyecto ${existing.name} (${existing.key}) eliminado.` };
  },

  /**
   * Valida la existencia de un proyecto en Jira Cloud y lo vincula en SQLite sin duplicados
   */
  async validateAndLinkProject({ key, user = 'Elena Rostova', ip = '127.0.0.1' }) {
    if (!key || typeof key !== 'string' || !key.trim()) {
      const err = new Error('La clave del proyecto Jira es obligatoria.');
      err.status = 400;
      throw err;
    }

    const normKey = key.trim().toUpperCase();
    const config = getJiraConfig();

    if (!config.isConfigured) {
      const err = new Error('No se ha podido conectar con Jira Cloud: Credenciales no configuradas. Verifica JIRA_EMAIL y JIRA_API_TOKEN.');
      err.status = 503;
      throw err;
    }

    // 1. Consultar Jira Cloud desde el backend para verificar que el proyecto existe y que la cuenta tiene acceso
    const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
    let res;
    try {
      res = await fetch(`${config.host}/rest/api/3/project/${encodeURIComponent(normKey)}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });
    } catch (netErr) {
      const err = new Error(`No se ha podido conectar con Jira: Error de red (${netErr.message})`);
      err.status = 502;
      throw err;
    }

    if (!res.ok) {
      let message;
      if (res.status === 404) {
        message = `No se encuentra un proyecto con la clave '${normKey}' en Jira Cloud. Verifica que la cuenta tenga acceso o escribe la clave real (ej. MSHP o TRES para Treslog).`;
      } else if (res.status === 401) {
        message = 'Credenciales de Jira no válidas o API Token no autorizado (HTTP 401). Verifica tu correo y API token.';
      } else if (res.status === 403) {
        message = `La cuenta de Jira no tiene permisos suficientes para acceder al proyecto '${normKey}' (HTTP 403).`;
      } else {
        message = `Jira API devolvió código HTTP ${res.status} al validar el proyecto.`;
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    // 2. Obtener nombre e ID reales de Jira
    const jiraData = await res.json();
    const realId = jiraData.id || normKey;
    const realKey = (jiraData.key || normKey).toUpperCase();
    const realName = jiraData.name || realKey;
    const realLead = jiraData.lead?.displayName || user || 'Sin asignar';

    // 3. Guardar el vínculo en SQLite sin duplicar proyectos
    this.ensureDefaultProjects();
    const existing = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [realKey]);
    let project;

    if (existing) {
      db.execute(
        `UPDATE jira_projects
         SET name = ?, lead = ?, jira_id = ?, updated_at = datetime('now')
         WHERE key = ?`,
        [realName, realLead, String(realId), realKey]
      );
      project = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [realKey]);
    } else {
      db.execute(
        `INSERT INTO jira_projects
         (id, key, name, lead, people, budget, spent, hrs, bill, st, jira_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 50000, 0, 0, 100, 'On track', ?, datetime('now'), datetime('now'))`,
        [realKey, realKey, realName, realLead, String(realId)]
      );
      project = db.getOne('SELECT * FROM jira_projects WHERE key = ?', [realKey]);
    }

    logAction({
      actor: user,
      action: 'JIRA_PROJECT_LINKED',
      entityType: 'jira_project',
      entityId: realKey,
      newValues: { id: realId, key: realKey, name: realName, lead: realLead },
      ip,
    });

    return {
      ok: true,
      project: {
        id: project.key,
        key: project.key,
        jira_id: project.jira_id || realId,
        name: project.name,
        lead: project.lead,
        people: project.people,
        budget: project.budget,
        spent: project.spent,
        hrs: project.hrs,
        bill: project.bill,
        st: project.st,
        last_sync_at: project.last_sync_at,
      },
      message: `Proyecto '${realName}' (${realKey}) validado y vinculado exitosamente.`,
      offerSync: true,
    };
  },

  /**
   * Obtiene las tareas cacheadas en SQLite para un proyecto individual
   */
  getProjectIssues({ projectKey, query = '', status = null }) {
    if (!projectKey) return { ok: false, error: 'Se requiere clave de proyecto', issues: [] };
    const normKey = projectKey.trim().toUpperCase();
    const qLower = (query || '').toLowerCase().trim();
    const config = getJiraConfig();

    let sql = `SELECT * FROM jira_issues_cache WHERE project_key = ?`;
    const params = [normKey];

    if (status && status !== 'all') {
      sql += ` AND LOWER(status) = ?`;
      params.push(status.toLowerCase().trim());
    }

    if (qLower) {
      sql += ` AND (LOWER(key) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(assignee_name) LIKE ?)`;
      params.push(`%${qLower}%`, `%${qLower}%`, `%${qLower}%`);
    }

    sql += ` ORDER BY cached_at DESC, key ASC`;

    let rows = [];
    try {
      rows = db.query(sql, params);
    } catch (e) {
      console.warn('[Jira] getProjectIssues error:', e.message);
    }

    // Obtener última fecha de sincronización
    let lastSyncAt = null;
    try {
      const syncRow = db.getOne('SELECT last_sync_at FROM jira_sync_status WHERE id = ? OR project_key = ?', [normKey, normKey]);
      if (syncRow && syncRow.last_sync_at) {
        lastSyncAt = syncRow.last_sync_at;
      } else {
        const projRow = db.getOne('SELECT last_sync_at FROM jira_projects WHERE key = ?', [normKey]);
        if (projRow && projRow.last_sync_at) {
          lastSyncAt = projRow.last_sync_at;
        } else {
          const maxRow = db.getOne('SELECT MAX(cached_at) as m FROM jira_issues_cache WHERE project_key = ?', [normKey]);
          if (maxRow && maxRow.m) lastSyncAt = maxRow.m;
        }
      }
    } catch (_) {}

    return {
      ok: true,
      projectKey: normKey,
      lastSyncAt,
      isConfigured: config.isConfigured,
      total: rows.length,
      issues: rows.map((r) => ({
        key: r.key,
        summary: r.summary,
        type: r.issue_type || 'Task',
        status: r.status || 'In Progress',
        assignee: r.assignee_name || 'Sin asignar',
        assigneeEmail: r.assignee_email || null,
        updated: r.jira_updated_at || r.cached_at || null,
        estimate: r.estimate_hours != null ? r.estimate_hours : 4.0,
        logged: r.logged_hours || 0,
        url: r.url || `${config.host}/browse/${r.key}`,
      })),
    };
  },

  /**
   * Cuenta total de tareas cacheadas localmente para un proyecto
   */
  getProjectCachedCount(projectKey) {
    try {
      const row = db.getOne('SELECT COUNT(*) as count FROM jira_issues_cache WHERE project_key = ?', [projectKey]);
      return row ? row.count : 0;
    } catch (_) {
      return 0;
    }
  },

  /**
   * Sincronización desde Jira Cloud a SQLite para un proyecto individual
   * Utiliza el endpoint moderno /rest/api/3/search/jql y paginación basada en cursor (nextPageToken)
   * Corrigiendo el error HTTP 410 (Gone) del endpoint antiguo /rest/api/3/search
   */
  async syncIssuesFromJira({ projectKey = null, limit = 100, user = 'Elena Rostova', ip = '127.0.0.1' } = {}) {
    const config = getJiraConfig();
    const targetProject = (projectKey || config.projectKey || 'MSHP').trim().toUpperCase();

    // 1. Probar conexión
    const conn = await this.testConnection();
    if (!conn.ok) {
      try {
        db.execute(
          `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, last_error, updated_at)
           VALUES (?, ?, datetime('now'), 'ERROR', ?, datetime('now'))`,
          [targetProject, targetProject, conn.message]
        );
      } catch (_) {}

      return {
        ok: false,
        error: conn.message,
        status: conn.status,
        code: conn.code,
        host: config.host,
        projectKey: targetProject,
        cachedCount: this.getProjectCachedCount(targetProject),
      };
    }

    // 2. Consultar Jira Cloud API con /rest/api/3/search/jql y paginación por nextPageToken
    try {
      const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
      const allIssues = [];
      let nextPageToken = null;
      let isLast = false;
      const maxResultsPerPage = Math.min(limit, 50);

      do {
        const payload = {
          jql: `project = "${targetProject}" ORDER BY updated DESC`,
          fields: ['summary', 'status', 'issuetype', 'assignee', 'timeoriginalestimate', 'timespent', 'created', 'updated', 'project'],
          maxResults: maxResultsPerPage,
        };
        if (nextPageToken) {
          payload.nextPageToken = nextPageToken;
        }

        const res = await fetch(`${config.host}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errMsg = `No se ha podido sincronizar con Jira (HTTP ${res.status}).`;
          db.execute(
            `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, last_error, updated_at)
             VALUES (?, ?, datetime('now'), 'ERROR', ?, datetime('now'))`,
            [targetProject, targetProject, errMsg]
          );
          return {
            ok: false,
            error: errMsg,
            cachedCount: this.getProjectCachedCount(targetProject),
          };
        }

        const data = await res.json();
        const pageIssues = Array.isArray(data.issues) ? data.issues : [];
        allIssues.push(...pageIssues);
        nextPageToken = data.nextPageToken || null;
        isLast = data.isLast === true || !nextPageToken || allIssues.length >= limit;
      } while (!isLast && allIssues.length < limit);

      // 3. Guardar en SQLite con transacción ACID (Upsert)
      db.transaction(() => {
        let totalLogged = 0;
        for (const iss of allIssues) {
          const key = iss.key;
          const summary = iss.fields?.summary || key;
          const issueType = iss.fields?.issuetype?.name || 'Task';
          const status = iss.fields?.status?.name || 'In Progress';
          const assigneeName = iss.fields?.assignee?.displayName || null;
          const assigneeEmail = iss.fields?.assignee?.emailAddress || null;
          const assigneeAvatar = iss.fields?.assignee?.avatarUrls?.['48x48'] || null;
          const estimateHours = iss.fields?.timeoriginalestimate
            ? round2(iss.fields.timeoriginalestimate / 3600)
            : 4.0;
          const loggedHours = iss.fields?.timespent
            ? round2(iss.fields.timespent / 3600)
            : 0.0;
          totalLogged += loggedHours;
          const issueUrl = `${config.host}/browse/${key}`;
          const createdAt = iss.fields?.created || new Date().toISOString();
          const updatedAt = iss.fields?.updated || new Date().toISOString();

          db.execute(
            `INSERT INTO jira_issues_cache
             (key, project_key, summary, issue_type, status, assignee_name, assignee_email, assignee_avatar, estimate_hours, logged_hours, url, jira_created_at, jira_updated_at, cached_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
               project_key = excluded.project_key,
               summary = excluded.summary,
               issue_type = excluded.issue_type,
               status = excluded.status,
               assignee_name = excluded.assignee_name,
               assignee_email = excluded.assignee_email,
               assignee_avatar = excluded.assignee_avatar,
               estimate_hours = excluded.estimate_hours,
               logged_hours = excluded.logged_hours,
               url = excluded.url,
               jira_updated_at = excluded.jira_updated_at,
               cached_at = datetime('now')`,
            [
              key,
              targetProject,
              summary,
              issueType,
              status,
              assigneeName,
              assigneeEmail,
              assigneeAvatar,
              estimateHours,
              loggedHours,
              issueUrl,
              createdAt,
              updatedAt,
            ]
          );
        }

        // Actualizar registro de sincronización específico y global
        db.execute(
          `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, total_synced, last_error, updated_at)
           VALUES (?, ?, datetime('now'), 'SUCCESS', ?, null, datetime('now'))`,
          [targetProject, targetProject, allIssues.length]
        );
        db.execute(
          `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, total_synced, last_error, updated_at)
           VALUES ('main', ?, datetime('now'), 'SUCCESS', ?, null, datetime('now'))`,
          [targetProject, allIssues.length]
        );

        // Actualizar proyecto en tabla jira_projects
        db.execute(
          `UPDATE jira_projects
           SET last_sync_at = datetime('now'),
               hrs = CASE WHEN ? > 0 THEN ? ELSE hrs END,
               updated_at = datetime('now')
           WHERE key = ?`,
          [round2(totalLogged), round2(totalLogged), targetProject]
        );
      });

      logAction({
        actor: user,
        action: 'JIRA_ISSUES_SYNCED',
        entityType: 'jira_cache',
        entityId: targetProject,
        newValues: { totalSynced: allIssues.length, project: targetProject },
        ip,
      });

      return {
        ok: true,
        syncedCount: allIssues.length,
        totalIssues: allIssues.length,
        projectKey: targetProject,
        lastSyncAt: new Date().toISOString(),
        message: `Sincronizadas exitosamente ${allIssues.length} tareas de ${targetProject} desde Jira Cloud.`,
      };
    } catch (err) {
      const errMsg = `No se ha podido conectar con Jira: ${err.message}`;
      db.execute(
        `INSERT OR REPLACE INTO jira_sync_status (id, project_key, last_sync_at, status, last_error, updated_at)
         VALUES (?, ?, datetime('now'), 'ERROR', ?, datetime('now'))`,
        [targetProject, targetProject, errMsg]
      );
      return {
        ok: false,
        error: errMsg,
        cachedCount: this.getProjectCachedCount(targetProject),
      };
    }
  },

  /**
   * Cuenta total de tareas cacheadas localmente
   */
  getCachedCount() {
    try {
      const row = db.getOne('SELECT COUNT(*) as count FROM jira_issues_cache');
      return row ? row.count : 0;
    } catch (_) {
      return 0;
    }
  },

  /**
   * Obtiene el estado actual de sincronización
   */
  getSyncStatus() {
    try {
      const row = db.getOne('SELECT * FROM jira_sync_status WHERE id = "main"');
      return row || { status: 'IDLE', last_sync_at: null, total_synced: 0, last_error: null };
    } catch (_) {
      return { status: 'IDLE', last_sync_at: null, total_synced: 0, last_error: null };
    }
  },

  /**
   * Búsqueda local de tareas en SQLite (< 5ms) para autocompletado y selectores
   */
  searchIssues({ query = '', projectKey = null, limit = 20 } = {}) {
    const qLower = (query || '').toLowerCase().trim();
    const config = getJiraConfig();

    try {
      let rows = [];
      if (qLower) {
        rows = db.query(
          `SELECT * FROM jira_issues_cache
           WHERE LOWER(key) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(assignee_name) LIKE ?
           ORDER BY cached_at DESC LIMIT ?`,
          [`%${qLower}%`, `%${qLower}%`, `%${qLower}%`, limit]
        );
      } else {
        rows = db.query(
          `SELECT * FROM jira_issues_cache ORDER BY cached_at DESC LIMIT ?`,
          [limit]
        );
      }

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          key: r.key,
          summary: r.summary,
          type: r.issue_type || 'Task',
          status: r.status || 'In Progress',
          assignee: r.assignee_name || 'Sin asignar',
          assigneeEmail: r.assignee_email,
          estimate: r.estimate_hours != null ? r.estimate_hours : 4.0,
          logged: r.logged_hours || 0,
          url: r.url || `${config.host}/browse/${r.key}`,
          project: r.project_key,
          isLocalCache: true,
        }));
      }
    } catch (e) {
      console.warn('[Jira] SQLite cache query error:', e.message);
    }

    // Sin caché local no hay tareas que mostrar (no se devuelven tareas de demostración)
    return [];
  },

  /**
   * Conciliación de registros de jornada contra estimaciones y registros de Jira
   */
  syncWorklogs({ empId, dateFrom, dateTo, user = 'Elena Rostova', ip = '127.0.0.1' } = {}) {
    let actQuery = `SELECT * FROM daily_activities WHERE 1=1`;
    const params = [];

    if (empId) {
      actQuery += ` AND employee_id = ?`;
      params.push(empId);
    }
    if (dateFrom) {
      actQuery += ` AND date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      actQuery += ` AND date <= ?`;
      params.push(dateTo);
    }

    actQuery += ` ORDER BY date DESC`;
    const activities = db.query(actQuery, params);

    // Mapa de estimaciones combinando SQLite cache y fallback
    const estimatesMap = new Map();
    try {
      const cached = db.query(`SELECT key, estimate_hours FROM jira_issues_cache`);
      cached.forEach((c) => {
        if (c.estimate_hours) estimatesMap.set(c.key, c.estimate_hours);
      });
    } catch (_) {}

    const discrepancies = [];
    let syncedCount = 0;

    activities.forEach((act) => {
      if (!act.jira_key) return;

      syncedCount += 1;
      const loggedHours = Number(act.hours) || 0;
      const estimatedHours = estimatesMap.get(act.jira_key) || 4.0;
      const delta = round2(loggedHours - estimatedHours);

      let flag = 'MATCH';
      let reason = 'Tiempo dedicado acorde al estimado';

      if (loggedHours > round2(estimatedHours * 1.5)) {
        flag = 'OVER_ESTIMATE';
        reason = `Tiempo registrado (${loggedHours}h) excede en +${delta}h (>150%) el estimado de Jira (${estimatedHours}h)`;
      } else if (loggedHours < round2(estimatedHours * 0.4)) {
        flag = 'UNDER_ESTIMATE';
        reason = `Tiempo registrado (${loggedHours}h) muy por debajo del estimado (${estimatedHours}h)`;
      }

      if (flag !== 'MATCH') {
        discrepancies.push({
          activityId: act.id,
          employeeId: act.employee_id,
          date: act.date,
          jiraKey: act.jira_key,
          summary: act.jira_summary || 'Sin título',
          loggedHours,
          estimatedHours,
          deltaHours: delta,
          flag,
          reason,
        });
      }
    });

    logAction({
      actor: user,
      action: 'JIRA_WORKLOG_SYNC',
      entityType: 'jira_sync',
      entityId: `sync-${Date.now()}`,
      newValues: {
        empId,
        activitiesCount: activities.length,
        syncedCount,
        discrepanciesCount: discrepancies.length,
      },
      ip,
    });

    return {
      syncedAt: new Date().toISOString(),
      totalActivities: activities.length,
      syncedCount,
      discrepanciesCount: discrepancies.length,
      discrepancies,
    };
  },
};

module.exports = jiraService;
