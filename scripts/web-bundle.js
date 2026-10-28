#!/usr/bin/env node
// Gera www/version.json (embutido no APK) e o pacote de atualização web-<build>-<nativo>.json.
// Uso: node scripts/web-bundle.js <versão> <build> <pasta de saída>
// "nativo" é um hash de tudo que exige um APK novo (projeto Android, plugins, config do Capacitor):
// se mudar, o app avisa para baixar o APK em vez de se atualizar sozinho.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? base + '/' + e.name : e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
  }).sort();
}

function nativeHash() {
  const h = crypto.createHash('sha1');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  h.update(JSON.stringify(pkg.dependencies || {}));
  h.update(fs.readFileSync(path.join(ROOT, 'capacitor.config.json')));
  // Só arquivos versionados no git: o resto é gerado pelo build ou pelo cap sync.
  const tracked = execFileSync('git', ['ls-files', '-z', 'android'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  for (const f of tracked) { h.update(f); h.update(fs.readFileSync(path.join(ROOT, f))); }
  return h.digest('hex').slice(0, 12);
}

function main([version, build, out]) {
  if (!version || !/^\d+$/.test(String(build)) || !out) {
    console.error('uso: node scripts/web-bundle.js <versão> <build> <pasta de saída>');
    process.exit(2);
  }
  const meta = { version, build: Number(build), native: nativeHash() };
  fs.writeFileSync(path.join(WWW, 'version.json'), JSON.stringify(meta) + '\n');
  const files = {};
  for (const f of walk(WWW)) files[f] = fs.readFileSync(path.join(WWW, f), 'utf8');
  fs.mkdirSync(out, { recursive: true });
  const name = 'web-' + meta.build + '-' + meta.native + '.json';
  fs.writeFileSync(path.join(out, name), JSON.stringify(Object.assign({}, meta, { files })));
  console.log(name);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { nativeHash, walk };
