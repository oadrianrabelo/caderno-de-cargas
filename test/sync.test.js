const test = require('node:test');
const assert = require('node:assert/strict');
const { createSync, FILE } = require('../www/sync.js');
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

function device(gh, data = { logs: {}, custom: {} }) {
  const state = {};
  let saves = 0;
  const sync = createSync({
    state, save: () => saves++, fetchFn: gh.fetchFn,
    snapshot: () => CG.serializeBackup(data.logs, data.custom),
    restore: (t) => { const o = CG.parseBackup(t); if (!o) return false; data.logs = o.logs; data.custom = o.custom; return true; }
  });
  return { sync, state, data, saves: () => saves };
}

test('nuvem: conectar sem backup existente liga o envio automático e cria um gist secreto', async () => {
  const gh = fakeGitHub();
  const d = device(gh, { logs: { '1-upper': { t: 1 } }, custom: {} });
  assert.deepEqual(await d.sync.connect('tok'), { found: false });
  assert.equal(d.state.auto, true);
  assert.equal(d.sync.dirty(), true);
  assert.equal(await d.sync.push(false), true);
  const g = gh.gists[d.state.gistId];
  assert.equal(g.public, false);
  assert.deepEqual(CG.parseBackup(g.files[FILE].content).logs, { '1-upper': { t: 1 } });
  assert.equal(d.sync.dirty(), false);
});

test('nuvem: não reenvia se nada mudou, e atualiza o mesmo gist quando muda', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  await d.sync.connect('tok');
  await d.sync.push(false);
  const id = d.state.gistId;
  assert.equal(await d.sync.push(false), false);
  d.data.logs['2-legs'] = { t: 9 };
  assert.equal(await d.sync.push(false), true);
  assert.equal(d.state.gistId, id);
  assert.equal(Object.keys(gh.gists).length, 1);
  assert.ok(gh.calls.includes('PATCH /gists/' + id));
});

test('nuvem: conectar com backup existente não sobrescreve sozinho, e baixar restaura os dados', async () => {
  const remote = CG.serializeBackup({ '5-pull': { t: 5 } }, { '5-pull': [] });
  const gh = fakeGitHub({ gists: { abc: { files: { 'outro.txt': {} } }, xyz: { files: { [FILE]: { content: remote } } } } });
  const d = device(gh, { logs: { local: { t: 1 } }, custom: {} });
  assert.deepEqual(await d.sync.connect('tok'), { found: true });
  assert.equal(d.state.gistId, 'xyz');
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
  await d.sync.connect('tok');
  await d.sync.pull();
  assert.deepEqual(d.data.logs, { big: { t: 1 } });
});

test('nuvem: token inválido não fica salvo', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  await assert.rejects(d.sync.connect('errado'), { status: 401 });
  assert.equal(d.sync.connected(), false);
});

test('nuvem: sem internet o erro tem status 0 e os dados locais ficam intactos', async () => {
  const d = device({ fetchFn: async () => { throw new TypeError('Failed to fetch'); } }, { logs: { a: { t: 1 } }, custom: {} });
  d.state.token = 'tok'; d.state.gistId = 'x';
  await assert.rejects(d.sync.push(true), { status: 0, message: 'Sem internet' });
  await assert.rejects(d.sync.pull(), { status: 0 });
  assert.deepEqual(d.data.logs, { a: { t: 1 } });
  assert.equal(d.state.hash, undefined);
});

test('nuvem: se o gist foi apagado, cria outro ao enviar', async () => {
  const gh = fakeGitHub();
  const d = device(gh);
  d.state.token = 'tok'; d.state.gistId = 'sumiu';
  assert.equal(await d.sync.push(true), true);
  assert.notEqual(d.state.gistId, 'sumiu');
  assert.ok(gh.gists[d.state.gistId]);
});

test('nuvem: backup inválido na nuvem não apaga os dados locais', async () => {
  const gh = fakeGitHub({ gists: { bad: { files: { [FILE]: { content: '{"lixo":1}' } } } } });
  const d = device(gh, { logs: { a: { t: 1 } }, custom: {} });
  await d.sync.connect('tok');
  await assert.rejects(d.sync.pull(), /inválido/);
  assert.deepEqual(d.data.logs, { a: { t: 1 } });
});

test('nuvem: desconectar apaga o token', async () => {
  const d = device(fakeGitHub());
  await d.sync.connect('tok');
  d.sync.disconnect();
  assert.equal(d.state.token, null);
  assert.equal(d.sync.connected(), false);
});
