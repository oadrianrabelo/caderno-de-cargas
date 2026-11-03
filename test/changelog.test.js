const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render } = require('../scripts/changelog.js');

test('CHANGELOG.md está em dia com www/changelog.js (rode npm run changelog)', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8'), render());
});

test('changelog: versões em ordem decrescente e com itens', () => {
  const ctx = { window: {} };
  require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'www', 'changelog.js'), 'utf8'), ctx);
  const v = ctx.window.CG_CHANGELOG;
  const n = (s) => s.slice(1).split('.').map(Number);
  for (let i = 1; i < v.length; i++) {
    const a = n(v[i - 1].version), b = n(v[i].version);
    assert.ok(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))), v[i - 1].version + ' > ' + v[i].version);
    assert.ok(v[i].items.length > 0);
  }
});
