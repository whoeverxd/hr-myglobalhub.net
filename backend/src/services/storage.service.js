const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { logAction } = require('../controllers/audit.controller');

const UPLOADS_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');

// Ensure root and subdirectories exist
function ensureDirectories() {
  const categories = ['evidences', 'proofs', 'paystubs', 'general'];
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  for (const cat of categories) {
    const dir = path.join(UPLOADS_ROOT, cat);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

ensureDirectories();

/**
 * Storage Service - Local provider with pluggable interface for future S3/GCS adapters
 */
const storageService = {
  /**
   * Save a file to secure disk storage and record in database
   */
  saveFile({
    originalName = 'attachment.bin',
    buffer = null,
    dataBase64 = null,
    mimeType = 'application/octet-stream',
    category = 'general',
    user = 'Elena Rostova',
    ip = '127.0.0.1',
  }) {
    ensureDirectories();

    let fileBuffer = buffer;
    if (!fileBuffer && dataBase64) {
      // Strip potential data URL prefix like "data:image/png;base64,"
      const base64Data = dataBase64.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      const err = new Error('No file payload provided');
      err.status = 400;
      throw err;
    }

    // Size limit: 25 MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      const err = new Error('File exceeds maximum size of 25MB');
      err.status = 413;
      throw err;
    }

    const id = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const token = crypto.randomBytes(16).toString('hex');
    const safeExt = path.extname(originalName).slice(0, 10).toLowerCase() || '.bin';
    const storedName = `${id}${safeExt}`;

    const validCategories = ['evidences', 'proofs', 'paystubs', 'general'];
    const safeCat = validCategories.includes(category) ? category : 'general';
    const filePath = path.join(UPLOADS_ROOT, safeCat, storedName);

    // Write file to disk
    fs.writeFileSync(filePath, fileBuffer);

    // Save record to DB
    db.execute(
      `INSERT INTO file_attachments (id, original_name, stored_name, mime_type, file_size, file_path, category, access_token, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, originalName, storedName, mimeType, fileBuffer.length, filePath, safeCat, token, user]
    );

    logAction({
      actor: user,
      action: 'UPLOAD_FILE',
      entityType: 'file_attachment',
      entityId: id,
      newValues: { originalName, size: fileBuffer.length, category: safeCat },
      ip,
    });

    return {
      id,
      originalName,
      mimeType,
      size: fileBuffer.length,
      category: safeCat,
      url: `/api/uploads/${id}`,
      token,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Retrieve file metadata and verify existence
   */
  getFile(idOrToken) {
    const row = db.getOne(
      `SELECT * FROM file_attachments WHERE id = ? OR access_token = ?`,
      [idOrToken, idOrToken]
    );

    if (!row) return null;
    if (!fs.existsSync(row.file_path)) return null;

    return {
      ...row,
      url: `/api/uploads/${row.id}`,
    };
  },

  /**
   * Delete file from disk and database
   */
  deleteFile(id, user = 'Elena Rostova', ip = '127.0.0.1') {
    const row = db.getOne(`SELECT * FROM file_attachments WHERE id = ?`, [id]);
    if (!row) {
      const err = new Error('File not found');
      err.status = 404;
      throw err;
    }

    if (fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path);
      } catch (e) {
        console.warn(`[storage] Could not delete physical file ${row.file_path}:`, e.message);
      }
    }

    db.execute(`DELETE FROM file_attachments WHERE id = ?`, [id]);

    logAction({
      actor: user,
      action: 'DELETE_FILE',
      entityType: 'file_attachment',
      entityId: id,
      oldValues: { originalName: row.original_name, category: row.category },
      ip,
    });

    return { ok: true, deletedId: id };
  },

  /**
   * List files by category
   */
  listFiles({ category, limit = 50 } = {}) {
    let query = `SELECT id, original_name, mime_type, file_size, category, access_token, created_by, created_at FROM file_attachments`;
    const params = [];
    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.query(query, params);
    return rows.map((r) => ({
      ...r,
      url: `/api/uploads/${r.id}`,
    }));
  },
};

module.exports = storageService;
