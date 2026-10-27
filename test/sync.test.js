const test = require('node:test');
const assert = require('node:assert/strict');
const { createSync, createDriveClient, FILE } = require('../www/sync.js');
const CG = require('../www/logic.js');

// GitHub falso em memória, só com as rotas de gist usadas pelo app.
function fakeGitHub({ token = 'tok', gists = {}, truncate = false } = {}) {
  let n = 0;
  const calls = [];
  const json = (status, body) => ({ status, ok: status < 300, json: async () => body, text: async () => JSON.stringify(body) });
  const fetchFn = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push(method + ' ' + url.replace('https://api.github.com', ''));
    if (url.startsWith('https://raw/')) return { ok: true, status: 200, text: async () => gists[url.slice(12)].files[FILE].content };
    if (opts.headers.Authorization !== 'Bearer ' + token) return json(401, {});
    const m = url.match(/\/gists(?:\/(\w+))?/);
    const id = m[1];
    if (method === 'GET' && !id) return json(200, Object.entries(gists).map(([gid, g]) => ({ id: gid, files: { [Object.keys(g.files)[0]]: {} } })));
    if (method === 'POST') { const gid = 'g' + (++n); gists[gid] = JSON.parse(opts.body); return json(201, { id: gid }); }
    if (!gists[id]) return json(404, {});
    if (method === 'PATCH') { Object.assign(gists[id].files, JSON.parse(opts.body).files); return json(200, {}); }
    const f = gists[id].files[FILE];
    return json(200, { files: { [FILE]: truncate ? { truncated: true, raw_url: 'https://raw/' + id } : { content: f.content } } });
  };
  return { fetchFn, gists, calls };
}

function device(gh, data = { logs: {}, custom: {} }, driveAuth) {
  const state = {};
  let saves = 0;
  const sync = createSync({
    state, save: () => saves++, fetchFn: gh.fetchFn, driveAuth,
    snapshot: () => CG.serializeBackup(data.logs, data.custom),
    restore: (t) => { const o = CG.parseBackup(t); if (!o) return false; data.logs = o.logs; data.custom = o.custom; return true; }
  });
  return { sync, state, data, saves: () => saves };
}

test('nuvem: conectar sem backup existente liga o envio automático e cria um gist secreto', async () => {
  const gh = fakeGitHub();
  const d = device(gh, { logs: { '1-upper': { t: 1 } }, custom: {} });
  assert.deepEqual(await d.sync.connect('gist', 'tok'), { found: false });
  assert.equal(d.state.auto, true);
  assert.equal(d.sync.dirty(), true);
  assert.equal(await d.sync.push(false), true);
  const g = gh.gists[d.state.remoteId];
  assert.equal(g.public, false);
  assert.deepEqual(CG.parseBackup(g.files[FILE].content).logs, { '1-upper': { t: 1 } });
  assert.equal(d.sync.dirty(), false);
});

test('nuvem: não reenvia se nada mudou, e atualiza o mesmo gist quando muda', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  await d.sync.connect('gist', 'tok');
  await d.sync.push(false);
  const id = d.state.remoteId;
  assert.equal(await d.sync.push(false), false);
  d.data.logs['2-legs'] = { t: 9 };
  assert.equal(await d.sync.push(false), true);
  assert.equal(d.state.remoteId, id);
  assert.equal(Object.keys(gh.gists).length, 1);
  assert.ok(gh.calls.includes('PATCH /gists/' + id));
});

test('nuvem: conectar com backup existente não sobrescreve sozinho, e baixar restaura os dados', async () => {
  const remote = CG.serializeBackup({ '5-pull': { t: 5 } }, { '5-pull': [] });
  const gh = fakeGitHub({ gists: { abc: { files: { 'outro.txt': {} } }, xyz: { files: { [FILE]: { content: remote } } } } });
  const d = device(gh, { logs: { local: { t: 1 } }, custom: {} });
  assert.deepEqual(await d.sync.connect('gist', 'tok'), { found: true });
  assert.equal(d.state.remoteId, 'xyz');
  assert.equal(d.state.auto, false);
  await d.sync.pull();
  assert.deepEqual(d.data.logs, { '5-pull': { t: 5 } });
  assert.equal(d.state.auto, true);
  assert.equal(d.sync.dirty(), false);
  assert.equal(gh.gists.xyz.files[FILE].content, remote);
});

test('nuvem: baixa o arquivo bruto quando o gist vem truncado', async () => {
  const remote = CG.serializeBackup({ big: { t: 1 } }, {});
  const gh = fakeGitHub({ truncate: true, gists: { big: { files: { [FILE]: { content: remote } } } } });
  const d = device(gh);
  await d.sync.connect('gist', 'tok');
  await d.sync.pull();
  assert.deepEqual(d.data.logs, { big: { t: 1 } });
});

test('nuvem: token inválido não fica salvo', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  await assert.rejects(d.sync.connect('gist', 'errado'), { status: 401 });
  assert.equal(d.sync.connected(), false);
});

test('nuvem: sem internet o erro tem status 0 e os dados locais ficam intactos', async () => {
  const d = device({ fetchFn: async () => { throw new TypeError('Failed to fetch'); } }, { logs: { a: { t: 1 } }, custom: {} });
  d.state.provider = 'gist'; d.state.token = 'tok'; d.state.remoteId = 'x';
  await assert.rejects(d.sync.push(true), { status: 0, message: 'Sem internet' });
  await assert.rejects(d.sync.pull(), { status: 0 });
  assert.deepEqual(d.data.logs, { a: { t: 1 } });
  assert.equal(d.state.hash, undefined);
});

test('nuvem: se o gist foi apagado, cria outro ao enviar', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  d.state.provider = 'gist'; d.state.token = 'tok'; d.state.remoteId = 'sumiu';
  assert.equal(await d.sync.push(true), true);
  assert.notEqual(d.state.remoteId, 'sumiu');
  assert.ok(gh.gists[d.state.remoteId]);
});

test('nuvem: backup inválido na nuvem não apaga os dados locais', async () => {
  const gh = fakeGitHub({ gists: { bad: { files: { [FILE]: { content: '{"lixo":1}' } } } } });
  const d = device(gh, { logs: { a: { t: 1 } }, custom: {} });
  await d.sync.connect('gist', 'tok');
  await assert.rejects(d.sync.pull(), /inválido/);
  assert.deepEqual(d.data.logs, { a: { t: 1 } });
});

test('nuvem: desconectar apaga o token', async () => {
  const d = device(fakeGitHub());
  await d.sync.connect('gist', 'tok');
  d.sync.disconnect();
  assert.equal(d.state.token, undefined);
  assert.equal(d.sync.connected(), false);
});

// Google Drive falso: arquivos em memória e tokens que podem expirar.
function fakeDrive({ files = {} } = {}) {
  let n = 0;
  const valid = new Set(['t1']);
  const calls = [];
  const res = (status, body) => ({ status, ok: status < 300, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const fetchFn = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push(method + ' ' + url.replace(/https:\/\/www.googleapis.com/, ''));
    if (!valid.has((opts.headers.Authorization || '').replace('Bearer ', ''))) return res(401, {});
    const u = new URL(url);
    const id = u.pathname.split('/files')[1].replace('/', '');
    if (method === 'GET' && !id) {
      assert.equal(u.searchParams.get('q'), "name='" + FILE + "' and trashed=false");
      return res(200, { files: Object.keys(files).reverse().map((fid) => ({ id: fid })) });
    }
    if (method === 'POST') {
      const b = opts.headers['Content-Type'].split('boundary=')[1];
      const parts = opts.body.split('--' + b);
      assert.deepEqual(JSON.parse(parts[1].split('\r\n\r\n')[1]), { name: FILE, mimeType: 'application/json' });
      const fid = 'f' + (++n);
      files[fid] = parts[2].split('\r\n\r\n')[1].replace(/\r\n$/, '');
      return res(200, { id: fid });
    }
    if (!(id in files)) return res(404, {});
    if (method === 'PATCH') { assert.equal(u.searchParams.get('uploadType'), 'media'); files[id] = opts.body; return res(200, {}); }
    assert.equal(u.searchParams.get('alt'), 'media');
    return res(200, files[id]);
  };
  const auth = {
    current: 't1', logins: 0, cleared: [],
    async getToken(interactive) { if (interactive) this.logins++; return this.current; },
    async clearToken(t) { this.cleared.push(t); this.current = 't2'; valid.add('t2'); }
  };
  return { fetchFn, files, calls, auth, expire: () => valid.delete('t1') };
}

test('drive: conectar abre o login, cria o arquivo e atualiza o mesmo arquivo depois', async () => {
  const gd = fakeDrive();
  const d = device(gd, { logs: { a: { t: 1 } }, custom: {} }, gd.auth);
  assert.deepEqual(await d.sync.connect('drive'), { found: false });
  assert.equal(gd.auth.logins, 1);
  assert.equal(d.state.provider, 'drive');
  assert.equal(d.state.token, null);
  await d.sync.push(false);
  const id = d.state.remoteId;
  assert.deepEqual(CG.parseBackup(gd.files[id]).logs, { a: { t: 1 } });
  d.data.logs.b = { t: 2 };
  await d.sync.push(false);
  assert.equal(Object.keys(gd.files).length, 1);
  assert.deepEqual(Object.keys(CG.parseBackup(gd.files[id]).logs), ['a', 'b']);
});

test('drive: token expirado é descartado e a chamada é repetida uma vez', async () => {
  const gd = fakeDrive({ files: { old: CG.serializeBackup({ x: { t: 3 } }, {}) } });
  const d = device(gd, undefined, gd.auth);
  assert.deepEqual(await d.sync.connect('drive'), { found: true });
  assert.equal(d.state.auto, false);
  gd.expire();
  await d.sync.pull();
  assert.deepEqual(gd.auth.cleared, ['t1']);
  assert.deepEqual(d.data.logs, { x: { t: 3 } });
});

test('drive: arquivo apagado no Drive é recriado ao enviar', async () => {
  const gd = fakeDrive();
  const d = device(gd, undefined, gd.auth);
  Object.assign(d.state, { provider: 'drive', remoteId: 'sumiu' });
  await d.sync.push(true);
  assert.notEqual(d.state.remoteId, 'sumiu');
  assert.ok(gd.files[d.state.remoteId]);
});

test('drive: sem o plugin nativo (navegador) não conecta', async () => {
  const d = device(fakeDrive());
  await assert.rejects(d.sync.connect('drive'), /só funciona no app Android/);
  assert.equal(d.sync.connected(), false);
});

test('drive: login cancelado não liga a nuvem', async () => {
  const gd = fakeDrive();
  const auth = { getToken: async () => { throw Object.assign(new Error('Login no Google cancelado'), { status: 0 }); }, clearToken: async () => {} };
  const d = device(gd, undefined, auth);
  await assert.rejects(d.sync.connect('drive'), /cancelado/);
  assert.equal(d.sync.connected(), false);
  assert.equal(gd.calls.length, 0);
});

test('drive: sem internet o erro tem status 0', async () => {
  const gd = fakeDrive();
  const c = createDriveClient(gd.auth, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(c.find(), { status: 0, message: 'Sem internet' });
});
