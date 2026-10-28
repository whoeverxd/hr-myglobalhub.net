/**
 * Cloud Firestore Database Adapter for MGH Payroll
 * Provides:
 *  1. Native NoSQL document & collection operations directly on Google Cloud Firestore
 *  2. High-performance document cache synchronized with Cloud Firestore
 *  3. Full SQL query translation for existing controllers & services
 *  4. Complete independence from SQLite disk files
 */
const fs = require('fs');
const path = require('path');
const firebaseService = require('../../services/firebase.service');

const HYDRATION_TIMEOUT_MS = Number(process.env.FIRESTORE_HYDRATION_TIMEOUT_MS || 2500);
const CACHE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'firestore_cache.json');

// Table to Firestore collection mapping
const TABLE_COLLECTION_MAP = {
  organization_configs: 'organizations',
  statutory_holidays: 'holidays',
  payroll_adjustments: 'payroll_adjustments',
  contractor_payments: 'contractor_payments',
  payroll_run_items: 'payroll_run_items',
  payroll_signoffs: 'payroll_signoffs',
  rollout_stages: 'rollout_stages',
  daily_activities: 'daily_activities',
  attendance_punches: 'attendance_punches',
  attendance_exceptions: 'attendance_exceptions',
  leave_requests: 'leave_requests',
  payment_proofs: 'payment_proofs',
  jira_projects: 'jira_projects',
  jira_sync_status: 'jira_sync_status',
  jira_issues_cache: 'jira_issues_cache',
  file_attachments: 'file_attachments',
  project_statuses: 'project_statuses',
  sprints: 'sprints',
  project_tasks: 'project_tasks',
  project_members: 'project_members',
};

function resolveCollection(tableName) {
  if (!tableName) return tableName;
  const clean = tableName.toLowerCase().trim();
  return TABLE_COLLECTION_MAP[clean] || clean;
}

function splitSqlExpressions(clause) {
  if (!clause) return [];
  const values = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < clause.length; i++) {
    const char = clause[i];
    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      if (parenDepth > 0) parenDepth--;
      current += char;
    } else if (char === ',' && !inQuotes && parenDepth === 0) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    values.push(current.trim());
  }
  return values;
}

const parseValuesList = splitSqlExpressions;

function splitTopLevelAnd(clause) {
  const parts = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < clause.length; i++) {
    const char = clause[i];
    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      if (parenDepth > 0) parenDepth--;
      current += char;
    } else if (!inQuotes && parenDepth === 0) {
      if (clause.substring(i, i + 5).toLowerCase() === ' and ') {
        parts.push(current.trim());
        current = '';
        i += 4;
        continue;
      }
      current += char;
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function parseSql(sql) {
  const cleanSql = sql.replace(/[\r\n]+/g, ' ').trim().replace(/;$/, '');
  const lower = cleanSql.toLowerCase();

  // Ignored DDL/Pragmas in Firestore
  if (
    lower.startsWith('pragma') ||
    lower.startsWith('begin') ||
    lower.startsWith('commit') ||
    lower.startsWith('rollback') ||
    lower.startsWith('create table') ||
    lower.startsWith('create index')
  ) {
    return { type: 'NOOP', sql: cleanSql };
  }

  // SELECT ... FROM table ...
  if (lower.startsWith('select')) {
    const joinMatch = cleanSql.match(/select\s+(.+?)\s+from\s+([a-zA-Z0-9_]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+((?:(?:left\s+)?join\s+[a-zA-Z0-9_]+(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+on\s+.+?\s*)+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+|\?))?(?:\s+offset\s+(\d+|\?))?$/i);
    if (joinMatch) {
      const [, fields, table, tableAlias, joinClause, , whereClause, orderClause, limit, offset] = joinMatch;
      return {
        type: 'SELECT_JOIN',
        fields: fields.trim() === '*' ? '*' : fields.split(',').map((f) => f.trim()),
        table: table.trim(),
        tableAlias: tableAlias ? tableAlias.trim() : null,
        joins: joinClause.trim(),
        where: whereClause ? whereClause.trim() : null,
        orderBy: orderClause ? orderClause.trim() : null,
        limit: limit ? (limit === '?' ? '?' : parseInt(limit, 10)) : null,
        offset: offset ? (offset === '?' ? '?' : parseInt(offset, 10)) : null,
      };
    }

    const selectMatch = cleanSql.match(/select\s+(.+?)\s+from\s+([a-zA-Z0-9_]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+|\?))?(?:\s+offset\s+(\d+|\?))?$/i);
    if (selectMatch) {
      const [, fields, table, tableAlias, whereClause, orderClause, limit, offset] = selectMatch;
      return {
        type: 'SELECT',
        fields: fields.trim() === '*' ? '*' : fields.split(',').map((f) => f.trim()),
        table: table.trim(),
        tableAlias: tableAlias ? tableAlias.trim() : null,
        where: whereClause ? whereClause.trim() : null,
        orderBy: orderClause ? orderClause.trim() : null,
        limit: limit ? (limit === '?' ? '?' : parseInt(limit, 10)) : null,
        offset: offset ? (offset === '?' ? '?' : parseInt(offset, 10)) : null,
      };
    }

    // Scalar SELECT 1 as num
    const scalarMatch = cleanSql.match(/select\s+(.+)$/i);
    if (scalarMatch) {
      return {
        type: 'SELECT_SCALAR',
        fields: scalarMatch[1].trim(),
      };
    }
  }

  // INSERT INTO table (cols) VALUES (...)
  if (lower.startsWith('insert into') || lower.startsWith('insert or replace into')) {
    const match = cleanSql.match(/insert(?:\s+or\s+replace)?\s+into\s+([a-zA-Z0-9_]+)\s*\((.+?)\)\s*values\s*\((.+?)\)/i);
    if (match) {
      const [, table, cols, vals] = match;
      // SQLite's ON CONFLICT(cols) DO UPDATE/NOTHING was dropped on the floor here.
      // That silently turned every upsert into a plain insert on Firestore.
      const conflictMatch = cleanSql.match(/on\s+conflict\s*\(([^)]+)\)\s*do\s+(update|nothing)/i);
      return {
        type: 'INSERT',
        table: table.trim(),
        columns: cols.split(',').map((c) => c.trim()),
        valuesClause: vals.trim(),
        conflictColumns: conflictMatch ? conflictMatch[1].split(',').map((c) => c.trim()) : null,
        conflictAction: conflictMatch ? conflictMatch[2].toLowerCase() : null,
      };
    }
  }

  // UPDATE table SET ... WHERE ...
  if (lower.startsWith('update')) {
    const match = cleanSql.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+?)(?:\s+where\s+(.+?))?$/i);
    if (match) {
      const [, table, setClause, whereClause] = match;
      return {
        type: 'UPDATE',
        table: table.trim(),
        setClause: setClause.trim(),
        where: whereClause ? whereClause.trim() : null,
      };
    }
  }

  // DELETE FROM table WHERE ...
  if (lower.startsWith('delete from')) {
    const match = cleanSql.match(/delete\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.+?))?$/i);
    if (match) {
      const [, table, whereClause] = match;
      return {
        type: 'DELETE',
        table: table.trim(),
        where: whereClause ? whereClause.trim() : null,
      };
    }
  }

  return { type: 'RAW', sql: cleanSql };
}

class FirestoreAdapter {
  constructor() {
    this.dialect = 'firestore';
    this.cache = new Map(); // collectionName -> Map(docId -> data)
    this.initialized = false;
    this.initPromise = null;
    this.activeWrites = new Set();
    // Where the data currently being served came from. A boot that failed to reach
    // Cloud Firestore still serves the local snapshot, which may be days old; that
    // has to be visible instead of indistinguishable from a healthy boot.
    this.hydration = { source: 'local-snapshot', collections: 0, docs: 0, error: null, at: null };
    this._loadLocalSnapshot();
  }

  _loadLocalSnapshot() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const data = JSON.parse(raw);
        for (const [col, docs] of Object.entries(data)) {
          const colMap = new Map();
          for (const [id, doc] of Object.entries(docs)) {
            colMap.set(String(id), doc);
          }
          this.cache.set(col, colMap);
        }
      }
    } catch (_) {}
  }

  _persistLocalSnapshot() {
    if (this._saveTimeout) return;
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      try {
        const out = {};
        for (const [col, colMap] of this.cache.entries()) {
          out[col] = Object.fromEntries(colMap.entries());
        }
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(out, null, 2), 'utf8');
      } catch (_) {}
    }, 200);
  }

  getDb() {
    return firebaseService.getFirestore();
  }

  getFirestore() {
    return firebaseService.getFirestore();
  }

  /**
   * Initializes the in-memory cache by reading from Cloud Firestore collections.
   */
  async init() {
    if (this.initialized) return;
    if (this.cache.size > 0 && (process.env.NODE_ENV === 'test' || process.env.SKIP_REMOTE_INIT === 'true')) {
      this.initialized = true;
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const firestore = this.getFirestore();
        if (!firestore) {
          this.initialized = true;
          return;
        }

        // The deadline has to cover the document reads too, not just listCollections():
        // a fast listing followed by a hanging col.get() used to hang here forever.
        let timer = null;
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Firestore sync timed out')), HYDRATION_TIMEOUT_MS);
        });

        let fetchedCollections = 0;
        let fetchedDocs = 0;
        // Remote data is read into FRESH maps and only swapped in once the whole hydration succeeded.
        // Merging into the local snapshot used to resurrect documents deleted in Cloud Firestore.
        const fresh = new Map();
        // Local writes made while hydrating are journaled and replayed on top of the fresh data.
        this._hydrationJournal = [];

        try {
          await Promise.race([
            (async () => {
              const collections = await firestore.listCollections();
              await Promise.all(
                collections.map(async (col) => {
                  const colName = col.id;
                  if (colName.startsWith('_system')) return;

                  const colMap = new Map();
                  fresh.set(colName, colMap);

                  const snapshot = await col.get();
                  snapshot.forEach((doc) => {
                    colMap.set(doc.id, { id: doc.id, ...doc.data() });
                  });
                  fetchedCollections += 1;
                  fetchedDocs += snapshot.size;
                })
              );
            })(),
            deadline,
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }

        this._applyHydration(fresh, this._hydrationJournal || []);
        this._hydrationJournal = null;

        this.initialized = true;
        this.hydratedFromRemote = true; // live data (false = running on the local snapshot only)
        this._persistLocalSnapshot();
        this.hydration = {
          source: 'cloud-firestore',
          collections: fetchedCollections,
          docs: fetchedDocs,
          error: null,
          at: new Date().toISOString(),
        };
        // Report what Cloud Firestore actually returned. The old message printed
        // this.cache.size, which also counts collections loaded from the local
        // snapshot file, so it read "Hydrated 31 collections from Cloud Firestore"
        // even when Firestore had returned nothing.
        console.log(
          `[FirestoreAdapter] Hydrated ${fetchedCollections} collections / ${fetchedDocs} docs from Cloud Firestore.`
        );
      } catch (err) {
        // Serving the local snapshot is the graceful fallback, but it is NOT a
        // successful boot: swallowing this silently made a stale-data boot look
        // identical to a healthy one.
        this._hydrationJournal = null; // local writes already live in the cache
        this.hydrationError = err.message;
        this.initialized = true;
        this.hydration = {
          source: 'local-snapshot',
          collections: this.cache.size,
          docs: Array.from(this.cache.values()).reduce((n, m) => n + m.size, 0),
          error: err.message,
          at: new Date().toISOString(),
        };
        console.error(
          `[FirestoreAdapter] HYDRATION FAILED (${err.message}). Serving the local snapshot ` +
            `cache instead: ${this.hydration.collections} collections / ${this.hydration.docs} docs, ` +
            `which may be stale. Writes still go to Cloud Firestore.`
        );
      }
    })();

    return this.initPromise;
  }

  /**
   * Replaces the cache with what Cloud Firestore returned: every remote collection starts from its fresh map,
   * and local-snapshot collections that no longer exist remotely are dropped. Writes made locally while the
   * hydration was running (journal) are replayed on top so they are not lost.
   */
  _applyHydration(fresh, journal = []) {
    for (const colName of Array.from(this.cache.keys())) {
      if (!fresh.has(colName)) this.cache.delete(colName);
    }
    for (const [colName, colMap] of fresh.entries()) {
      this.cache.set(colName, colMap);
    }
    for (const entry of journal) {
      const colMap = this._getCollectionMap(entry.col);
      if (entry.doc === null) colMap.delete(entry.id);
      else colMap.set(entry.id, entry.doc);
    }
  }

  _getCollectionMap(collectionName) {
    const colName = resolveCollection(collectionName);
    let colMap = this.cache.get(colName);
    if (!colMap) {
      colMap = new Map();
      this.cache.set(colName, colMap);
    }
    return colMap;
  }

  /**
   * Native Firestore operations
   */
  async getDoc(collectionName, docId) {
    await this.init();
    const colMap = this._getCollectionMap(collectionName);
    const cached = colMap.get(String(docId));
    if (cached) return { ...cached };

    const db = this.getFirestore();
    if (!db) return null;
    const doc = await db.collection(resolveCollection(collectionName)).doc(String(docId)).get();
    if (!doc.exists) return null;

    const data = { id: doc.id, ...doc.data() };
    colMap.set(doc.id, data);
    return data;
  }

  setDocSync(collectionName, docId, data, options = { merge: true }) {
    const colName = resolveCollection(collectionName);
    const colMap = this._getCollectionMap(colName);

    const docIdStr = String(docId);
    const existing = colMap.get(docIdStr) || {};
    const merged = options && options.merge ? { ...existing, ...data, id: docIdStr } : { ...data, id: docIdStr };
    colMap.set(docIdStr, merged);
    if (this._hydrationJournal) this._hydrationJournal.push({ col: colName, id: docIdStr, doc: merged });

    const db = this.getFirestore();
    if (db) {
      const cleanData = this._cleanData(merged);
      const writePromise = db.collection(colName).doc(docIdStr).set(cleanData, options);
      this.activeWrites.add(writePromise);
      writePromise.finally(() => this.activeWrites.delete(writePromise)).catch((err) => {
        console.error(`[FirestoreAdapter] Write error on ${colName}/${docIdStr}:`, err.message);
      });
    }

    this._persistLocalSnapshot();
    return merged;
  }

  deleteDocSync(collectionName, docId) {
    const colName = resolveCollection(collectionName);
    const colMap = this._getCollectionMap(colName);
    const docIdStr = String(docId);

    colMap.delete(docIdStr);
    if (this._hydrationJournal) this._hydrationJournal.push({ col: colName, id: docIdStr, doc: null });

    const db = this.getFirestore();
    if (db) {
      const writePromise = db.collection(colName).doc(docIdStr).delete();
      this.activeWrites.add(writePromise);
      writePromise.finally(() => this.activeWrites.delete(writePromise)).catch((err) => {
        console.error(`[FirestoreAdapter] Delete error on ${colName}/${docIdStr}:`, err.message);
      });
    }

    this._persistLocalSnapshot();
    return { id: docIdStr, deleted: true };
  }

  async setDoc(collectionName, docId, data, options = { merge: true }) {
    return this.setDocSync(collectionName, docId, data, options);
  }

  async updateDoc(collectionName, docId, data) {
    return this.setDocSync(collectionName, docId, data, { merge: true });
  }

  async deleteDoc(collectionName, docId) {
    return this.deleteDocSync(collectionName, docId);
  }

  /**
   * Direct NoSQL collection helper
   */
  collection(name) {
    const adapter = this;
    const colName = resolveCollection(name);

    return {
      doc(id) {
        return {
          get: () => adapter.getDoc(colName, id),
          set: (data, opts) => adapter.setDoc(colName, id, data, opts),
          update: (data) => adapter.updateDoc(colName, id, data),
          delete: () => adapter.deleteDoc(colName, id),
        };
      },
      get: (id) => adapter.getDoc(colName, id),
      insert: async (data) => {
        const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return adapter.setDoc(colName, id, { ...data, id });
      },
      set: (id, data, opts) => adapter.setDoc(colName, id, data, opts),
      update: (id, data) => adapter.updateDoc(colName, id, data),
      delete: (id) => adapter.deleteDoc(colName, id),
      find: async (filterFn) => {
        const all = await adapter.listDocs(colName);
        return typeof filterFn === 'function' ? all.filter(filterFn) : all;
      },
      findOne: async (filterFn) => {
        const all = await adapter.listDocs(colName);
        return (typeof filterFn === 'function' ? all.find(filterFn) : all[0]) || null;
      },
      list: (opts) => adapter.listDocs(colName, opts),
      count: async () => {
        const colMap = adapter._getCollectionMap(colName);
        return colMap.size;
      },
    };
  }

  async listDocs(collectionName, { where = [], orderBy = null, limit = null } = {}) {
    await this.init();
    const colMap = this._getCollectionMap(collectionName);
    let results = Array.from(colMap.values());

    for (const condition of where) {
      const [field, op, val] = condition;
      results = results.filter((doc) => {
        const v = doc[field];
        if (op === '==' || op === '=') return v == val;
        if (op === '!=') return v != val;
        if (op === '>') return v > val;
        if (op === '>=') return v >= val;
        if (op === '<') return v < val;
        if (op === '<=') return v <= val;
        return true;
      });
    }

    if (orderBy) {
      const [field, direction] = orderBy.split(/\s+/);
      const isDesc = direction && direction.toLowerCase() === 'desc';
      results.sort((a, b) => {
        const va = a[field] ?? '';
        const vb = b[field] ?? '';
        if (va < vb) return isDesc ? 1 : -1;
        if (va > vb) return isDesc ? -1 : 1;
        return 0;
      });
    }

    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  _cleanData(data) {
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        clean[k] = v;
      }
    }
    return clean;
  }

  /**
   * SQL Translation Engine
   */
  exec(sql) {
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of statements) {
      this.execute(s, []);
    }
    return true;
  }

  query(sql, params = []) {
    const parsed = parseSql(sql);

    if (parsed.type === 'NOOP') {
      return [];
    }

    if (parsed.type === 'SELECT_SCALAR') {
      const numMatch = parsed.fields.match(/(\d+)\s+as\s+([a-zA-Z0-9_]+)/i);
      if (numMatch) {
        return [{ [numMatch[2]]: parseInt(numMatch[1], 10) }];
      }
      return [{ val: 1 }];
    }

    if (parsed.type === 'SELECT' || parsed.type === 'SELECT_JOIN') {
      if (parsed.table === 'sqlite_master') {
        const schemaTables = [
          'employees', 'pay_periods', 'timesheets', 'daily_activities',
          'file_attachments', 'payroll_signoffs', 'rollout_stages',
          'contractors', 'contractor_payments', 'schema_migrations',
          'users', 'audit_logs', 'holidays', 'organizations',
          'payroll_adjustments', 'payroll_runs', 'payroll_run_items',
          'sessions', 'project_statuses', 'sprints', 'project_tasks'
        ];
        return schemaTables.map(name => ({ name }));
      }

      const colName = resolveCollection(parsed.table);
      const colMap = this._getCollectionMap(colName);
      let rows = Array.from(colMap.values());

      // If JOIN is present, perform in-memory join
      if (parsed.type === 'SELECT_JOIN') {
        rows = this._performJoin(rows, parsed, params);
      }

      // Filter WHERE
      if (parsed.where) {
        rows = this._filterWhere(rows, parsed.where, params);
      }

      // Aggregate query: COUNT(*), MAX(...), SUM(...)
      if (parsed.fields !== '*' && Array.isArray(parsed.fields) && parsed.fields.length === 1) {
        const f = parsed.fields[0];
        const countMatch = f.match(/count\(\*\)(?:\s+as\s+([a-zA-Z0-9_]+))?/i);
        if (countMatch) {
          const alias = countMatch[1] || 'count';
          return [{ [alias]: rows.length }];
        }

        const maxMatch = f.match(/max\(([a-zA-Z0-9_.]+)\)(?:\s+as\s+([a-zA-Z0-9_]+))?/i);
        if (maxMatch) {
          const col = maxMatch[1].split('.').pop();
          const alias = maxMatch[2] || 'max';
          let maxVal = null;
          for (const r of rows) {
            const val = r[col];
            if (val !== undefined && val !== null) {
              if (maxVal === null || val > maxVal) maxVal = val;
            }
          }
          return [{ [alias]: maxVal }];
        }
      }

      // Sort ORDER BY
      if (parsed.orderBy) {
        rows = this._sortRows(rows, parsed.orderBy);
      }

      // Limit and Offset
      let offset = 0;
      let limit = rows.length;

      if (parsed.offset !== null) {
        offset = parsed.offset === '?' ? Number(params.pop()) : Number(parsed.offset);
      }

      if (parsed.limit !== null) {
        limit = parsed.limit === '?' ? Number(params.pop()) : Number(parsed.limit);
      }

      if (offset > 0 || limit < rows.length) {
        rows = rows.slice(offset, offset + limit);
      }

      // Project fields if not '*'
      if (parsed.fields !== '*' && Array.isArray(parsed.fields)) {
        rows = rows.map((r) => {
          const projected = {};
          for (const rawCol of parsed.fields) {
            const trimmed = rawCol.trim();
            if (trimmed === '*' || trimmed.endsWith('.*')) {
              Object.assign(projected, r);
              continue;
            }
            const [c, alias] = trimmed.split(/\s+as\s+/i);
            const rawField = c.trim();
            const cleanC = rawField.split('.').pop();
            const cleanA = alias ? alias.trim() : cleanC;
            const aliasKey = rawField.includes('.') ? rawField.replace('.', '_') : cleanC;
            const val = r[aliasKey] !== undefined ? r[aliasKey] : (r[cleanC] !== undefined ? r[cleanC] : (r[cleanA] !== undefined ? r[cleanA] : null));
            projected[cleanA] = val;
          }
          return projected;
        });
      }

      return rows;
    }

    return [];
  }

  getOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  execute(sql, params = []) {
    const parsed = parseSql(sql);

    if (parsed.type === 'NOOP') {
      return { changes: 0 };
    }

    if (parsed.type === 'INSERT') {
      const colName = resolveCollection(parsed.table);
      const data = {};
      const valTokens = parseValuesList(parsed.valuesClause);
      let paramIdx = 0;

      parsed.columns.forEach((col, idx) => {
        const token = valTokens[idx];
        if (token === '?') {
          const val = paramIdx < params.length ? params[paramIdx++] : null;
          data[col] = val === undefined ? null : val;
        } else if (token && (token.startsWith("'") || token.startsWith('"'))) {
          data[col] = token.slice(1, -1);
        } else if (token && token.toLowerCase() === "datetime('now')") {
          data[col] = new Date().toISOString();
        } else if (token && token.toLowerCase() === 'null') {
          data[col] = null;
        } else if (token && !isNaN(Number(token))) {
          data[col] = Number(token);
        } else {
          const val = paramIdx < params.length ? params[paramIdx++] : null;
          data[col] = val === undefined ? null : val;
        }
      });

      if (!data.created_at) {
        data.created_at = new Date().toISOString();
      }

      if (colName === 'audit_logs' && !data.id) {
        const colMap = this._getCollectionMap(colName);
        let maxId = 0;
        for (const k of colMap.keys()) {
          const n = parseInt(k, 10);
          if (!isNaN(n) && n > maxId) maxId = n;
        }
        // Two inserts landing in the same tick both resolved to maxId + 1, and the
        // second overwrote the first through the merge write: an audit entry simply
        // disappeared. Walk forward until the id is actually free.
        let next = maxId + 1;
        while (colMap.has(String(next))) next += 1;
        data.id = next;
      }

      // Honor the conflict key: locate the existing document instead of writing a new
      // one. Without this, a table with no `id` column (jira_issues_cache is keyed on
      // `key`) fell through to a random doc id, so re-syncing the same Jira issue
      // created a second document where SQLite would have updated the first.
      if (!data.id && parsed.conflictColumns && parsed.conflictColumns.length) {
        const colMap = this._getCollectionMap(colName);
        const sameKey = (doc) =>
          parsed.conflictColumns.every(
            (c) => doc[c] !== undefined && data[c] !== undefined && String(doc[c]) === String(data[c])
          );

        for (const [existingId, doc] of colMap) {
          if (sameKey(doc)) {
            if (parsed.conflictAction === 'nothing') {
              return { changes: 0, lastInsertRowid: existingId, id: existingId };
            }
            data.id = existingId;
            break;
          }
        }

        if (!data.id) {
          data.id = `${parsed.table}_${parsed.conflictColumns.map((c) => String(data[c])).join('_')}`;
        }
      }

      const docId = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      data.id = docId;

      this.setDocSync(colName, docId, data, { merge: true });

      return {
        changes: 1,
        lastInsertRowid: docId,
        id: docId,
      };
    }

    if (parsed.type === 'UPDATE') {
      const colName = resolveCollection(parsed.table);
      const setParts = splitSqlExpressions(parsed.setClause);
      let paramIdx = 0;

      const setDefinitions = [];
      for (const part of setParts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const col = part.slice(0, eqIdx).trim();
        const expr = part.slice(eqIdx + 1).trim();

        const paramPlaceholders = (expr.match(/\?/g) || []).length;
        const exprParams = [];
        for (let i = 0; i < paramPlaceholders; i++) {
          exprParams.push(params[paramIdx++]);
        }

        setDefinitions.push({ col, expr, exprParams });
      }

      // Filter rows to update
      const colMap = this._getCollectionMap(colName);
      let targets = Array.from(colMap.values());
      if (parsed.where) {
        const remainingParams = params.slice(paramIdx);
        targets = this._filterWhere(targets, parsed.where, remainingParams);
      }

      let changes = 0;
      for (const target of targets) {
        const updateData = {};
        for (const { col, expr, exprParams } of setDefinitions) {
          const lowerExpr = expr.toLowerCase();
          if (expr === '?') {
            updateData[col] = exprParams[0];
          } else if (lowerExpr === "datetime('now')" || lowerExpr === "(datetime('now'))") {
            updateData[col] = new Date().toISOString();
          } else if (lowerExpr === 'null') {
            updateData[col] = null;
          } else if (lowerExpr.startsWith('coalesce(')) {
            if (lowerExpr.includes('+') && exprParams.length === 1) {
              const currentVal = Number(target[col]) || 0;
              const delta = Number(exprParams[0]) || 0;
              updateData[col] = currentVal + delta;
            } else {
              const inner = expr.slice(expr.indexOf('(') + 1, expr.lastIndexOf(')'));
              const args = splitSqlExpressions(inner);
              let val = null;
              let pI = 0;
              for (const a of args) {
                const trA = a.trim();
                let v = null;
                if (trA === '?') {
                  v = exprParams[pI++];
                } else if (trA.startsWith("'") || trA.startsWith('"')) {
                  v = trA.slice(1, -1);
                } else if (!isNaN(Number(trA))) {
                  v = Number(trA);
                } else if (target[trA] !== undefined) {
                  v = target[trA];
                } else if (target[col] !== undefined) {
                  v = target[col];
                }
                if (v !== null && v !== undefined) {
                  val = v;
                  break;
                }
              }
              updateData[col] = val !== null ? val : (target[col] !== undefined ? target[col] : null);
            }
          } else if (lowerExpr.includes('max(0') && lowerExpr.includes('-') && exprParams.length === 1) {
            const currentVal = Number(target[col]) || 0;
            const delta = Number(exprParams[0]) || 0;
            updateData[col] = Math.max(0, currentVal - delta);
          } else if (exprParams.length === 1 && expr.endsWith('?')) {
            updateData[col] = exprParams[0];
          } else if (!isNaN(Number(expr)) && expr.trim() !== '') {
            updateData[col] = Number(expr);
          } else {
            updateData[col] = expr.replace(/^'|'$/g, '');
          }
        }

        this.setDocSync(colName, target.id, { ...target, ...updateData }, { merge: true });
        changes++;
      }

      return { changes };
    }

    if (parsed.type === 'DELETE') {
      const colName = resolveCollection(parsed.table);
      const colMap = this._getCollectionMap(colName);
      let targets = Array.from(colMap.values());

      if (parsed.where) {
        targets = this._filterWhere(targets, parsed.where, params);
      }

      let changes = 0;
      for (const target of targets) {
        this.deleteDocSync(colName, target.id);
        changes++;
      }

      return { changes };
    }

    return { changes: 0 };
  }

  transaction(fn) {
    const rollbackState = new Map();
    for (const [colName, colMap] of this.cache.entries()) {
      rollbackState.set(colName, new Map(colMap));
    }

    try {
      return fn();
    } catch (err) {
      this.cache.clear();
      for (const [colName, colMap] of rollbackState.entries()) {
        this.cache.set(colName, colMap);
      }
      this._persistLocalSnapshot();
      throw err;
    }
  }

  hydrationStatus() {
    return { ...this.hydration, pendingWrites: this.activeWrites.size };
  }

  async flushPendingWrites() {
    if (!this.activeWrites || this.activeWrites.size === 0) return;
    await Promise.allSettled(Array.from(this.activeWrites));
  }

  reset() {
    this.cache.clear();
    this.initialized = false;
    this.initPromise = null;
  }

  _performJoin(rows, parsed, params) {
    const joins = parsed.joins.split(/\s+(?:left\s+)?join\s+/i).filter(Boolean);
    let combined = rows;

    for (const joinPart of joins) {
      const match = joinPart.match(/([a-zA-Z0-9_]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+on\s+(.+)$/i);
      if (!match) continue;

      const [, targetTable, targetAlias, onClause] = match;
      const targetColName = resolveCollection(targetTable);
      const targetRows = Array.from(this._getCollectionMap(targetColName).values());

      const onMatch = onClause.match(/([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/);
      if (!onMatch) continue;

      const [, leftKeyFull, rightKeyFull] = onMatch;
      const leftKey = leftKeyFull.split('.').pop();
      const rightKey = rightKeyFull.split('.').pop();

      combined = combined.map((row) => {
        const matchedTarget = targetRows.find((tr) => tr[rightKey] === row[leftKey] || tr[leftKey] === row[rightKey]);
        const targetProps = {};
        if (matchedTarget) {
          for (const [k, v] of Object.entries(matchedTarget)) {
            targetProps[k] = v;
            if (targetAlias) {
              targetProps[`${targetAlias}_${k}`] = v;
            }
          }
        }
        return { ...targetProps, ...row };
      });
    }

    return combined;
  }

  _filterWhere(rows, whereClause, params) {
    let paramIdx = 0;
    const cleanClause = whereClause.trim();

    return rows.filter((doc) => {
      let localParamIdx = 0;
      return this._evalWhereExpr(doc, cleanClause, params, (idx) => {
        localParamIdx = idx;
      });
    });
  }

  _evalWhereExpr(doc, clause, params, onIdxUpdate) {
    // 1=1 trivial condition
    if (clause === '1=1') return true;

    // Handle AND clauses respecting parentheses
    const andParts = splitTopLevelAnd(clause);
    let pIdx = 0;

    for (const part of andParts) {
      let trimmed = part.trim();
      if (!trimmed || trimmed === '1=1') continue;

      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        trimmed = trimmed.slice(1, -1).trim();
      }

      if (/\s+or\s+/i.test(trimmed)) {
        const orParts = trimmed.split(/\s+or\s+/i);
        let orMatched = false;
        let testIdx = pIdx;

        for (const orPart of orParts) {
          const matched = this._evalSingleCondition(doc, orPart.trim(), params, testIdx);
          if (matched.pass) {
            orMatched = true;
          }
          testIdx = matched.nextIdx;
        }

        pIdx = testIdx;
        if (!orMatched) return false;
        continue;
      }

      const evalRes = this._evalSingleCondition(doc, trimmed, params, pIdx);
      if (!evalRes.pass) return false;
      pIdx = evalRes.nextIdx;
    }

    if (onIdxUpdate) onIdxUpdate(pIdx);
    return true;
  }

  _evalSingleCondition(doc, cond, params, pIdx) {
    let nextIdx = pIdx;

    // Col IS NULL / Col IS NOT NULL
    const isNullMatch = cond.match(/([a-zA-Z0-9_.]+)\s+is\s+(not\s+)?null/i);
    if (isNullMatch) {
      const col = isNullMatch[1].split('.').pop();
      const isNot = Boolean(isNullMatch[2]);
      const val = doc[col];
      const isNull = val === null || val === undefined;
      return { pass: isNot ? !isNull : isNull, nextIdx };
    }

    // Col IS ? / Col IS NOT ?
    const isParamMatch = cond.match(/([a-zA-Z0-9_.]+)\s+is\s+(not\s+)?\?/i);
    if (isParamMatch) {
      const col = isParamMatch[1].split('.').pop();
      const isNot = Boolean(isParamMatch[2]);
      const paramVal = params[nextIdx++];
      const val = doc[col];
      const isParamNull = paramVal === null || paramVal === undefined;
      const isValNull = val === null || val === undefined;
      const match = isParamNull ? isValNull : val == paramVal;
      return { pass: isNot ? !match : match, nextIdx };
    }

    // Col IN ('A', 'B') or Col NOT IN (...) or Col IN (SELECT ...)
    const inMatch = cond.match(/([a-zA-Z0-9_.]+)\s+(not\s+)?in\s*\(([\s\S]+?)\)$/i);
    if (inMatch) {
      const col = inMatch[1].split('.').pop();
      const isNot = Boolean(inMatch[2]);
      const innerContent = inMatch[3].trim();
      const val = doc[col];

      if (innerContent.toLowerCase().startsWith('select')) {
        const subParamCount = (innerContent.match(/\?/g) || []).length;
        const subParams = params.slice(nextIdx, nextIdx + subParamCount);
        nextIdx += subParamCount;
        const subRows = this.query(innerContent, subParams);
        const subValues = subRows.map((r) => Object.values(r)[0]);
        const has = subValues.some((v) => String(v) === String(val));
        return { pass: isNot ? !has : has, nextIdx };
      } else {
        const rawList = innerContent.split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
        const has = rawList.includes(String(val));
        return { pass: isNot ? !has : has, nextIdx };
      }
    }

    // Col LIKE ?
    const likeMatch = cond.match(/([a-zA-Z0-9_()]+)\s+like\s+(\?|'[^']*')/i);
    if (likeMatch) {
      let col = likeMatch[1].split('.').pop();
      const isLower = col.toLowerCase().startsWith('lower(');
      const isUpper = col.toLowerCase().startsWith('upper(');
      if (isLower) {
        col = col.replace(/^lower\(|\)$/gi, '').trim().split('.').pop();
      } else if (isUpper) {
        col = col.replace(/^upper\(|\)$/gi, '').trim().split('.').pop();
      }

      let pattern = likeMatch[2] === '?' ? params[nextIdx++] : likeMatch[2].replace(/^'|'$/g, '');
      pattern = String(pattern).replace(/%/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      let val = String(doc[col] || '');
      return { pass: regex.test(val), nextIdx };
    }

    // Comparison operators: =, !=, <>, >, >=, <, <=
    const compMatch = cond.match(/([a-zA-Z0-9_().]+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)/);
    if (compMatch) {
      let left = compMatch[1].trim();
      const op = compMatch[2];
      let right = compMatch[3].trim();

      const isLower = left.toLowerCase().startsWith('lower(');
      const isUpper = left.toLowerCase().startsWith('upper(');
      if (isLower) {
        left = left.replace(/^lower\(|\)$/gi, '').trim();
      } else if (isUpper) {
        left = left.replace(/^upper\(|\)$/gi, '').trim();
      } else if (left.toLowerCase().startsWith('datetime(')) {
        left = left.replace(/^datetime\(|\)$/gi, '').trim();
      }
      left = left.split('.').pop();

      let val = doc[left];
      let compareVal;

      if (right === '?') {
        compareVal = params[nextIdx++];
      } else if (right.toLowerCase() === "datetime('now')") {
        compareVal = new Date().toISOString();
      } else {
        compareVal = right.replace(/^'|'$/g, '');
      }

      if (isLower) {
        val = val ? String(val).toLowerCase() : '';
        compareVal = compareVal ? String(compareVal).toLowerCase() : '';
      } else if (isUpper) {
        val = val ? String(val).toUpperCase() : '';
        compareVal = compareVal ? String(compareVal).toUpperCase() : '';
      }

      let pass = false;
      if (op === '=' || op === '==') pass = val == compareVal;
      else if (op === '!=' || op === '<>') pass = val != compareVal;
      else if (op === '>') pass = val > compareVal;
      else if (op === '>=') pass = val >= compareVal;
      else if (op === '<') pass = val < compareVal;
      else if (op === '<=') pass = val <= compareVal;

      return { pass, nextIdx };
    }

    return { pass: true, nextIdx };
  }

  _sortRows(rows, orderClause) {
    const parts = orderClause.split(',').map((p) => p.trim());
    return rows.slice().sort((a, b) => {
      for (const part of parts) {
        const [colExpr, dir] = part.split(/\s+/);
        const col = colExpr.split('.').pop();
        const isDesc = dir && dir.toLowerCase() === 'desc';

        const va = a[col] ?? '';
        const vb = b[col] ?? '';

        const numA = Number(va);
        const numB = Number(vb);
        const aIsNum = !isNaN(numA) && String(va).trim() !== '';
        const bIsNum = !isNaN(numB) && String(vb).trim() !== '';

        if (aIsNum && bIsNum) {
          if (numA !== numB) return isDesc ? numB - numA : numA - numB;
        } else if (aIsNum && !bIsNum) {
          return isDesc ? -1 : 1;
        } else if (!aIsNum && bIsNum) {
          return isDesc ? 1 : -1;
        } else {
          const cmp = String(va).localeCompare(String(vb));
          if (cmp !== 0) return isDesc ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  parseSql(sql) {
    return parseSql(sql);
  }
}

const firestoreAdapter = new FirestoreAdapter();
firestoreAdapter.FirestoreAdapter = FirestoreAdapter;
firestoreAdapter.parseSql = parseSql;

module.exports = firestoreAdapter;
