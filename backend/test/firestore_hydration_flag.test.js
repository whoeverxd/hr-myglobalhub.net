const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// The production scripts (set-user-role, prod-cleanup, clear-placeholder-contractor-data) only write when the
// Firestore adapter says the data came from Cloud Firestore. Guard against losing that flag again.
test('Firestore adapter marks a successful hydration with hydratedFromRemote', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'adapters', 'firestore.adapter.js'), 'utf8');
  const success = src.slice(src.indexOf("source: 'cloud-firestore'") - 400, src.indexOf("source: 'cloud-firestore'"));
  assert.match(success, /this\.hydratedFromRemote = true/);
  for (const script of ['set-user-role.js', 'prod-cleanup.js', 'clear-placeholder-contractor-data.js']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'scripts', script), 'utf8'), /hydratedFromRemote/, script);
  }
});
