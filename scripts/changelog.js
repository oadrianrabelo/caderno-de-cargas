#!/usr/bin/env node
// Gera CHANGELOG.md a partir de www/changelog.js (a mesma lista que o app mostra em Novidades).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function render() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'www', 'changelog.js'), 'utf8'), ctx);
  const out = ['# Changelog', '', 'Mudanças do Caderno de Cargas por versão. Gerado de `www/changelog.js` com `npm run changelog`.', ''];
  for (const v of ctx.window.CG_CHANGELOG) {
    out.push('## ' + v.version + (v.date ? ' (' + v.date + ')' : ''), '');
    v.items.forEach((x) => out.push('- ' + x));
    out.push('');
  }
  return out.join('\n');
}

if (require.main === module) fs.writeFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), render());
module.exports = { render };
