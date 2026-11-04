const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { decide, parseRelease, validBundle } = require('../www/update.js');

const cur = { build: 10, native: 'aaa' };

test('atualização: só atualiza para build maior', () => {
  assert.equal(decide(cur, { build: 10, native: 'aaa' }, 0), 'none');
  assert.equal(decide(cur, { build: 9, native: 'aaa' }, 0), 'none');
  assert.equal(decide(cur, null, 0), 'none');
  assert.equal(decide(null, { build: 11, native: 'aaa' }, 0), 'none');
});

test('atualização: mesma parte Android atualiza sozinho; Android diferente pede APK', () => {
  assert.equal(decide(cur, { build: 11, native: 'aaa' }, 0), 'web');
  assert.equal(decide(cur, { build: 11, native: 'bbb' }, 0), 'apk');
});

test('atualização: não tenta de novo uma versão que já falhou', () => {
  assert.equal(decide(cur, { build: 11, native: 'aaa' }, 11), 'none');
  assert.equal(decide(cur, { build: 12, native: 'aaa' }, 11), 'web');
});

test('atualização: lê a Release do GitHub', () => {
  const rel = { tag_name: 'v0.3.0', assets: [
    { name: 'caderno-de-cargas-0.3.0-release.apk', browser_download_url: 'https://x/app.apk' },
    { name: 'web-42-0123456789ab.json', browser_download_url: 'https://x/web.json', url: 'https://api/assets/9' },
  ] };
  assert.deepEqual(parseRelease(rel), { build: 42, native: '0123456789ab', url: 'https://x/web.json', api: 'https://api/assets/9', version: 'v0.3.0', apk: 'https://x/app.apk' });
  assert.equal(parseRelease({ tag_name: 'v0.1.0', assets: [{ name: 'a.apk' }] }), null);
  assert.equal(parseRelease(null), null);
});

test('atualização: rejeita pacote de outra versão ou incompleto', () => {
  const remote = { build: 42, native: 'n' };
  const files = { 'index.html': '<html><script src="logic.js"></script>', 'logic.js': '', 'update.js': '' };
  assert.equal(validBundle({ build: 42, native: 'n', files }, remote), true);
  assert.equal(validBundle({ build: 41, native: 'n', files }, remote), false);
  assert.equal(validBundle({ build: 42, native: 'm', files }, remote), false);
  assert.equal(validBundle({ build: 42, native: 'n', files: { 'index.html': 'oi' } }, remote), false);
  assert.equal(validBundle(null, remote), false);
});

test('pacote web: inclui todos os arquivos de www e grava version.json', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bundle-'));
  const versionFile = path.join(__dirname, '..', 'www', 'version.json');
  const before = fs.existsSync(versionFile) ? fs.readFileSync(versionFile) : null;
  try {
    const name = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'web-bundle.js'), 'v9.9.9', '77', out], { encoding: 'utf8' }).trim();
    const m = /^web-77-([0-9a-f]{12})\.json$/.exec(name);
    assert.ok(m, name);
    const b = JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
    assert.equal(b.version, 'v9.9.9');
    assert.equal(b.native, m[1]);
    for (const f of ['index.html', 'logic.js', 'native.js', 'sync.js', 'progress.js', 'programs.js', 'update.js', 'version.json']) assert.equal(typeof b.files[f], 'string', f);
    assert.deepEqual(JSON.parse(b.files['version.json']), { version: 'v9.9.9', build: 77, native: m[1] });
    assert.equal(validBundle(b, { build: 77, native: m[1] }), true);
  } finally {
    if (before) fs.writeFileSync(versionFile, before); else fs.rmSync(versionFile, { force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});


test('atualização: escolhe a versão web compatível mesmo se a mais nova exigir APK', () => {
  const { choose } = require('../www/update.js');
  const rel = (tag, build, native) => ({ tag_name: tag, assets: [{ name: 'web-' + build + '-' + native + '.json', browser_download_url: 'u' + build }, { name: tag + '.apk', browser_download_url: 'a' + build }] });
  const cur = { build: 22, native: 'aaa' };
  // v0.3.0 (build 26) exige APK; v0.3.1 (build 27) volta a ser compatível; v0.2.9 (24) compatível.
  let r = choose(cur, [rel('v0.3.1', 27, 'aaa'), rel('v0.3.0', 26, 'bbb'), rel('v0.2.9', 24, 'aaa'), rel('v0.2.8', 22, 'aaa')], 0);
  assert.equal(r.web.version, 'v0.3.1');
  assert.equal(r.apk, null); // nada mais novo que exija APK
  // Só a mais nova exige APK: ainda assim baixa a web compatível mais nova e avisa do APK.
  r = choose(cur, [rel('v0.3.0', 26, 'bbb'), rel('v0.2.9', 24, 'aaa')], 0);
  assert.equal(r.web.version, 'v0.2.9');
  assert.equal(r.apk.version, 'v0.3.0');
  // Versão que falhou antes é pulada; rascunho é ignorado.
  r = choose(cur, [Object.assign(rel('v0.3.2', 30, 'aaa'), { draft: true }), rel('v0.3.1', 27, 'aaa'), rel('v0.2.9', 24, 'aaa')], 27);
  assert.equal(r.web.version, 'v0.2.9');
  assert.deepEqual(choose(cur, [], 0), { web: null, apk: null });
});
