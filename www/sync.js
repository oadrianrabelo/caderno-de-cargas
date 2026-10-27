// Salvamento online opcional: Google Drive (só no app Android) ou um Gist secreto do GitHub.
// O caderno continua 100% offline: a nuvem é só uma cópia, enviada quando houver internet.
(function (root) {
  const FILE = 'caderno-de-cargas.json';
  const PROVIDERS = { drive: 'Google Drive', gist: 'GitHub Gist' };

  // Hash curto só para saber se os dados mudaram desde o último envio.
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; }

  class SyncError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  async function request(fetchFn, url, opts) {
    try { return await fetchFn(url, opts); } catch (e) { throw new SyncError('Sem internet', 0); }
  }

  // Cada cliente expõe find/create/update/read sobre um único arquivo. `fetch` é injetado para os testes.
  function createGistClient(token, fetchFn) {
    const API = 'https://api.github.com';
    const call = async (path, opts = {}) => {
      const res = await request(fetchFn, API + path, Object.assign({}, opts, {
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
      }));
      if (res.status === 401) throw new SyncError('Token inválido ou expirado', 401);
      if (res.status === 403 || res.status === 404) throw new SyncError('Token sem permissão de gist ou gist apagado', res.status);
      if (!res.ok) throw new SyncError('GitHub respondeu ' + res.status, res.status);
      return res.json();
    };
    return {
      // Procura um gist do usuário que já tenha o arquivo do caderno.
      async find() {
        for (let page = 1; page <= 10; page++) {
          const list = await call('/gists?per_page=100&page=' + page);
          const g = list.find((x) => x && x.files && x.files[FILE]);
          if (g) return g.id;
          if (list.length < 100) return null;
        }
        return null;
      },
      async create(content) {
        const g = await call('/gists', { method: 'POST', body: JSON.stringify({ description: 'Backup do Caderno de Cargas', public: false, files: { [FILE]: { content } } }) });
        return g.id;
      },
      async update(id, content) { await call('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) }); },
      async read(id) {
        const g = await call('/gists/' + id);
        const f = g.files && g.files[FILE];
        if (!f) throw new SyncError('O gist não tem o arquivo do caderno', 404);
        if (!f.truncated) return f.content;
        const raw = await request(fetchFn, f.raw_url);
        if (!raw.ok) throw new SyncError('Não consegui baixar o arquivo completo', raw.status);
        return raw.text();
      }
    };
  }

  // Google Drive com escopo drive.file: o app só vê o arquivo que ele mesmo criou.
  // `auth` vem do plugin nativo DriveAuth: getToken(interactive) e clearToken(token).
  function createDriveClient(auth, fetchFn) {
    const API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';
    const call = async (url, opts = {}, retry = true) => {
      const token = await auth.getToken(false);
      const res = await request(fetchFn, url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers) }));
      if (res.status === 401 && retry) { await auth.clearToken(token); return call(url, opts, false); }
      if (res.status === 401) throw new SyncError('Entre na conta Google de novo', 401);
      if (res.status === 403) throw new SyncError('O Google Drive recusou o acesso', 403);
      if (res.status === 404) throw new SyncError('Arquivo não encontrado no Drive', 404);
      if (!res.ok) throw new SyncError('Google Drive respondeu ' + res.status, res.status);
      return res;
    };
    return {
      async find() {
        const q = encodeURIComponent("name='" + FILE + "' and trashed=false");
        const r = await (await call(API + '?q=' + q + '&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id)')).json();
        return r.files && r.files[0] ? r.files[0].id : null;
      },
      async create(content) {
        const b = 'cg' + Date.now().toString(36);
        const body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE, mimeType: 'application/json' }) +
          '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + content + '\r\n--' + b + '--';
        const r = await (await call(UP + '?uploadType=multipart&fields=id', { method: 'POST', body, headers: { 'Content-Type': 'multipart/related; boundary=' + b } })).json();
        return r.id;
      },
      async update(id, content) { await call(UP + '/' + id + '?uploadType=media', { method: 'PATCH', body: content, headers: { 'Content-Type': 'application/json' } }); },
      async read(id) { return (await call(API + '/' + id + '?alt=media')).text(); }
    };
  }

  // Regras de envio e recebimento, iguais para os dois provedores. `state` é persistido por quem chama.
  function createSync({ state, save, fetchFn, snapshot, restore, driveAuth }) {
    const client = () => state.provider === 'drive' ? createDriveClient(driveAuth, fetchFn) : createGistClient(state.token, fetchFn);
    const off = () => { if (!state.provider) throw new SyncError('Nuvem desligada', 0); };
    const sync = {
      state,
      connected: () => !!state.provider,
      dirty: () => hash(snapshot()) !== state.hash,
      async connect(provider, token) {
        if (!PROVIDERS[provider]) throw new SyncError('Provedor desconhecido', 0);
        if (provider === 'drive') {
          if (!driveAuth) throw new SyncError('Google Drive só funciona no app Android', 0);
          await driveAuth.getToken(true); // abre a escolha de conta e o pedido de permissão
        }
        const prev = Object.assign({}, state);
        Object.assign(state, { provider, token: provider === 'gist' ? token : null, remoteId: null, hash: null, last: null });
        try {
          state.remoteId = await client().find();
        } catch (e) { Object.keys(state).forEach((k) => delete state[k]); Object.assign(state, prev); throw e; }
        // Se já existe um backup na nuvem, não sobrescreve sozinho: o usuário escolhe enviar ou baixar.
        state.auto = !state.remoteId;
        save();
        return { found: !!state.remoteId };
      },
      disconnect() { Object.keys(state).forEach((k) => delete state[k]); save(); },
      async push(force) {
        off();
        const content = snapshot(), h = hash(content);
        if (!force && h === state.hash) return false;
        const c = client();
        if (state.remoteId) {
          try { await c.update(state.remoteId, content); } catch (e) { if (e.status !== 404) throw e; state.remoteId = null; }
        }
        if (!state.remoteId) state.remoteId = await c.create(content);
        state.hash = h; state.last = Date.now(); state.auto = true;
        save();
        return true;
      },
      async pull() {
        off();
        if (!state.remoteId) state.remoteId = await client().find();
        if (!state.remoteId) throw new SyncError('Nenhum backup na nuvem ainda', 404);
        const text = await client().read(state.remoteId);
        if (!restore(text)) throw new SyncError('O backup da nuvem é inválido', 0);
        state.hash = hash(snapshot()); state.last = Date.now(); state.auto = true;
        save();
        return true;
      }
    };
    return sync;
  }

  const api = { FILE, PROVIDERS, hash, SyncError, createGistClient, createDriveClient, createSync };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CGSync = api;

  // ---------- Interface (só no navegador / WebView) ----------
  const app = root.CGApp;
  const tools = document.querySelector('.tools');
  if (!app || !tools) return;

  // Ponte para o plugin nativo DriveAuth (só existe no app Android).
  const cap = root.Capacitor;
  let driveAuth = null;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.isPluginAvailable && cap.isPluginAvailable('DriveAuth')) {
    const plug = (cap.Plugins && cap.Plugins.DriveAuth) || cap.registerPlugin('DriveAuth');
    const fail = (e) => {
      const code = e && e.code;
      throw new SyncError(code === 'NEEDS_LOGIN' ? 'Entre na conta Google de novo' : code === 'CANCELED' ? 'Login no Google cancelado' : (e && e.message) || 'Erro no login Google', code === 'NEEDS_LOGIN' ? 401 : 0);
    };
    driveAuth = {
      getToken: (interactive) => plug.getToken({ interactive }).then((r) => r.token, fail),
      clearToken: (token) => plug.clearToken({ token }).catch(() => {})
    };
  }

  const KEY = 'cg:sync';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ } };
  const sync = createSync({ state, save, fetchFn: (u, o) => root.fetch(u, o), snapshot: app.snapshot, restore: app.restore, driveAuth });

  const css = document.createElement('style');
  css.textContent = '.cloud{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);display:flex;flex-direction:column;gap:10px;font-size:14px}' +
    '.cloud p{margin:0;color:var(--mute)}.cloud input[type=password]{height:44px;width:100%;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:0 10px;font:500 15px/1 var(--f-body)}' +
    '.cloud .r{display:flex;flex-wrap:wrap;gap:8px}.cloud label.ck2{display:flex;gap:8px;align-items:center;color:var(--ink)}.cloud label.ck2 input{width:20px;height:20px}' +
    '.cloud a{color:var(--accent)}.cloud .st{color:var(--ink);font-weight:600}.cloud details summary{cursor:pointer;color:var(--ink);font-weight:600;min-height:32px}' +
    '.cloud details[open]{display:flex;flex-direction:column;gap:10px}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const button = (cls, txt) => { const b = mk('button', cls, txt); b.type = 'button'; return b; };
  const btn = button('btn', 'Nuvem'); btn.id = 'bcloud';
  tools.appendChild(btn);
  const panel = mk('div', 'cloud'); panel.id = 'cloud'; panel.hidden = true;
  tools.insertAdjacentElement('afterend', panel);
  let msg = '';

  const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' de ' + d.toLocaleDateString('pt-BR'); };
  const say = (t) => { msg = t; draw(); };
  const fail = (e) => say(e && e.message ? e.message : 'Erro na nuvem');
  const connect = (provider, token) => {
    say('Conectando…');
    sync.connect(provider, token).then((r) => {
      if (r.found) say('Achei um backup no ' + PROVIDERS[provider] + '. Toque em "Baixar da nuvem" para usá-lo ou em "Enviar agora" para substituí-lo.');
      else { say('Conectado ao ' + PROVIDERS[provider]); autoPush(); }
    }, fail);
  };

  function drawChooser() {
    panel.appendChild(mk('p', null, 'Guarde uma cópia do caderno na nuvem. O app continua funcionando sem internet; a cópia é enviada quando houver sinal.'));
    if (driveAuth) {
      const gd = button('btn pri', 'Conectar Google Drive');
      gd.addEventListener('click', () => connect('drive'));
      panel.appendChild(gd);
    } else {
      panel.appendChild(mk('p', null, 'Google Drive: disponível no app Android.'));
    }
    const det = mk('details');
    det.appendChild(mk('summary', null, 'Usar GitHub Gist'));
    const p = mk('p'); p.append('Crie um token em ');
    const a = mk('a', null, 'github.com/settings/tokens'); a.href = 'https://github.com/settings/tokens/new?scopes=gist&description=Caderno%20de%20Cargas'; a.target = '_blank'; a.rel = 'noopener';
    p.append(a, ' marcando só a permissão "gist", e cole abaixo.');
    const tk = mk('input'); tk.type = 'password'; tk.placeholder = 'Token do GitHub'; tk.autocomplete = 'off'; tk.setAttribute('aria-label', 'Token do GitHub');
    const ok = button(driveAuth ? 'btn' : 'btn pri', 'Conectar Gist');
    ok.addEventListener('click', () => { const v = tk.value.trim(); if (!v) return say('Cole o token primeiro'); connect('gist', v); });
    det.append(p, tk, ok);
    det.open = !driveAuth;
    panel.appendChild(det);
  }

  function drawConnected() {
    panel.appendChild(mk('p', 'st', PROVIDERS[state.provider] + ' · ' + (state.last ? 'último envio/recebimento ' + hhmm(state.last) : 'ainda sem envio')));
    const lab = mk('label', 'ck2'); const cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!state.auto;
    cb.addEventListener('change', () => { state.auto = cb.checked; save(); if (cb.checked) autoPush(); });
    lab.append(cb, 'Enviar sozinho quando houver internet');
    panel.appendChild(lab);
    const r = mk('div', 'r');
    const up = button('btn pri', 'Enviar agora'), down = button('btn', 'Baixar da nuvem'), offb = button('btn dng', 'Desconectar');
    up.addEventListener('click', () => { say('Enviando…'); sync.push(true).then(() => { say('Enviado'); app.status('Enviado para a nuvem'); }, fail); });
    let armed = false, tm = null;
    down.addEventListener('click', () => {
      if (!armed) { armed = true; down.textContent = 'Toque de novo: substitui os dados deste aparelho'; tm = setTimeout(() => { armed = false; down.textContent = 'Baixar da nuvem'; }, 4000); return; }
      clearTimeout(tm); say('Baixando…');
      sync.pull().then(() => { say('Dados da nuvem carregados'); app.status('Backup da nuvem importado'); }, fail);
    });
    offb.addEventListener('click', () => { sync.disconnect(); say('Desconectado. O backup na nuvem continua lá; este aparelho só parou de enviar.'); });
    r.append(up, down, offb);
    panel.appendChild(r);
    panel.appendChild(mk('p', null, 'Se usar o caderno em dois aparelhos, o último envio vale. Baixe antes de treinar no outro aparelho.'));
  }

  function draw() {
    btn.textContent = sync.connected() ? (sync.dirty() ? 'Nuvem •' : 'Nuvem ✓') : 'Nuvem';
    if (panel.hidden) return;
    panel.textContent = '';
    if (sync.connected()) drawConnected(); else drawChooser();
    if (msg) panel.appendChild(mk('p', 'st', msg));
  }

  let timer = null, busy = false;
  function autoPush() {
    if (!sync.connected() || !state.auto || busy || (root.navigator && root.navigator.onLine === false)) return draw();
    busy = true;
    sync.push(false).then((sent) => { if (sent) msg = 'Enviado automaticamente'; }, (e) => { msg = e.status === 0 && e.message === 'Sem internet' ? 'Sem internet: envio quando voltar o sinal' : e.message; })
      .then(() => { busy = false; draw(); });
  }
  app.saved.push(() => { draw(); clearTimeout(timer); timer = setTimeout(autoPush, 4000); });
  root.addEventListener('online', autoPush);
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; msg = ''; draw(); });
  draw();
  autoPush();
})(typeof globalThis !== 'undefined' ? globalThis : this);
