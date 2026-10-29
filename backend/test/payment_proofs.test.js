const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const proofs = require('../src/controllers/proofs.controller');

test('Payment proofs belong to one payslip line (transfer + employee + period)', () => {
  db.execute(`DELETE FROM payment_proofs WHERE period_id = 'PP-2099-01'`);
  const base = { transfer: 'bhd', bank: 'Banco Popular', amount: '100.00 DOP', ref: 'Ref: 1', date: '2099-01-20', period: 'PP-2099-01' };
  try {
    assert.throws(() => proofs.saveProof({ ...base, period: undefined, emp: 'MGH-1044' }), (e) => e.status === 400);
    assert.throws(() => proofs.saveProof({ ...base }), (e) => e.status === 400);

    proofs.saveProof({ ...base, id: 'PRF-T1', emp: 'MGH-1044' });
    proofs.saveProof({ ...base, id: 'PRF-T2', emp: 'MGH-1045' });
    let mine = proofs.listProofs().filter((p) => p.period === 'PP-2099-01');
    assert.equal(mine.length, 2, "another employee's proof does not replace this one");

    proofs.saveProof({ ...base, id: 'PRF-T3', emp: 'MGH-1044', ref: 'Ref: 2' });
    mine = proofs.listProofs().filter((p) => p.period === 'PP-2099-01');
    assert.equal(mine.length, 2, 'same line is replaced');
    assert.deepEqual(mine.map((p) => p.id).sort(), ['PRF-T2', 'PRF-T3']);
    assert.equal(mine.find((p) => p.id === 'PRF-T3').emp, 'MGH-1044');
  } finally {
    db.execute(`DELETE FROM payment_proofs WHERE period_id = 'PP-2099-01'`);
  }
});
