const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const storageService = require('../src/services/storage.service');
const { getAuditLogs } = require('../src/controllers/audit.controller');

test('Storage Service: Save file, read metadata, and verify physical existence', () => {
  const sampleText = 'Test evidence file content for MGH Payroll activities';
  const base64Data = Buffer.from(sampleText).toString('base64');

  // 1. Save file
  const saved = storageService.saveFile({
    originalName: 'test-evidence.txt',
    dataBase64: `data:text/plain;base64,${base64Data}`,
    mimeType: 'text/plain',
    category: 'evidences',
    user: 'Elena Rostova',
  });

  assert.ok(saved.id.startsWith('att_'));
  assert.equal(saved.originalName, 'test-evidence.txt');
  assert.equal(saved.category, 'evidences');
  assert.ok(saved.size > 0);
  assert.ok(saved.token);
  assert.equal(saved.url, `/api/uploads/${saved.id}`);

  // 2. Retrieve file metadata
  const fileMeta = storageService.getFile(saved.id);
  assert.ok(fileMeta);
  assert.equal(fileMeta.id, saved.id);
  assert.equal(fileMeta.mime_type, 'text/plain');
  assert.ok(fs.existsSync(fileMeta.file_path));

  // Verify content from disk
  const diskContent = fs.readFileSync(fileMeta.file_path, 'utf8');
  assert.equal(diskContent, sampleText);

  // 3. Verify audit log entry
  const audits = getAuditLogs({ entityType: 'file_attachment' });
  const uploadAudit = audits.find((a) => a.entity_id === saved.id && a.action === 'UPLOAD_FILE');
  assert.ok(uploadAudit, 'Audit log must record UPLOAD_FILE');

  // 4. Delete file
  const delRes = storageService.deleteFile(saved.id, 'Elena Rostova');
  assert.equal(delRes.ok, true);
  assert.equal(delRes.deletedId, saved.id);

  // Verify physical file was removed
  assert.equal(fs.existsSync(fileMeta.file_path), false);

  // Verify database record was removed
  const afterMeta = storageService.getFile(saved.id);
  assert.equal(afterMeta, null);
});

test('Storage Service: List files by category', () => {
  const b64 = Buffer.from('Proof screenshot').toString('base64');
  const f1 = storageService.saveFile({
    originalName: 'proof1.jpg',
    dataBase64: b64,
    mimeType: 'image/jpeg',
    category: 'proofs',
  });

  const proofs = storageService.listFiles({ category: 'proofs' });
  assert.ok(proofs.some((p) => p.id === f1.id));

  // Clean up
  storageService.deleteFile(f1.id);
});

test('Storage Service: Validates file payload and rejects empty inputs', () => {
  assert.throws(
    () => {
      storageService.saveFile({ originalName: 'empty.bin' });
    },
    (err) => err.status === 400
  );
});
