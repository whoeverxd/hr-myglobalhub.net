const path = require('path');
const storageService = require('../services/storage.service');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const getUserName = (req) => (req.user && req.user.name) || req.headers['x-user'] || 'Elena Rostova';

function uploadFile(req, res, next) {
  try {
    const {
      filename,
      originalName,
      dataBase64,
      data,
      mimeType,
      type,
      category = 'evidences',
    } = req.body || {};

    const payload = dataBase64 || data;
    const name = originalName || filename || 'upload.bin';
    const mime = mimeType || type || 'application/octet-stream';

    const result = storageService.saveFile({
      originalName: name,
      dataBase64: payload,
      mimeType: mime,
      category,
      user: getUserName(req),
      ip: getClientIp(req),
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

function serveFile(req, res, next) {
  try {
    const { id } = req.params;
    const file = storageService.getFile(id);

    if (!file) {
      return res.status(404).json({ error: `File ${id} not found` });
    }

    // Set correct MIME type and stream file
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self'");
    res.sendFile(path.resolve(file.file_path));
  } catch (err) {
    next(err);
  }
}

function downloadFile(req, res, next) {
  try {
    const { id } = req.params;
    const file = storageService.getFile(id);

    if (!file) {
      return res.status(404).json({ error: `File ${id} not found` });
    }

    res.download(path.resolve(file.file_path), file.original_name);
  } catch (err) {
    next(err);
  }
}

function deleteFile(req, res, next) {
  try {
    const { id } = req.params;
    const result = storageService.deleteFile(id, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function listFiles(req, res, next) {
  try {
    const { category, limit } = req.query;
    const files = storageService.listFiles({ category, limit: Number(limit) || 50 });
    res.json(files);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadFile,
  serveFile,
  downloadFile,
  deleteFile,
  listFiles,
};
