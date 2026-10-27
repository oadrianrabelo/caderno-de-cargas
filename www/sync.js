// Salvamento online opcional num Gist secreto do GitHub.
// O caderno continua 100% offline: a nuvem é só uma cópia, enviada quando houver internet.
(function (root) {
  const FILE = 'caderno-de-cargas.json';
  const API = 'https://api.github.com';

  // Hash curto só para saber se os dados mudaram desde o último envio.
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; }

  class SyncError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  // Cliente do Gist. `fetch` é injetado para poder ser testado sem rede.
  function createGistClient(token, fetchFn) {
    const call = async (path, opts = {}) => {
      let res;
      try {
        res = await fetchFn(API + path, Object.assign({}, opts, {
          headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
        }));
      } catch (e) { throw new SyncError('Sem internet', 0); }
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
        const raw = await fetchFn(f.raw_url);
        if (!raw.ok) throw new SyncError('Não consegui baixar o arquivo completo', raw.status);
        return raw.text();
      }
    };
  }

  // Regras de envio e recebimento, sem DOM. `state` é persistido por quem chama.
  function createSync({ state, save, fetchFn, snapshot, restore }) {
    const client = () => createGistClient(state.token, fetchFn);
    const sync = {
      state,
      connected: () => !!state.token,
      dirty: () => hash(snapshot()) !== state.hash,
      async connect(token) {
        const prev = { token: state.token, gistId: state.gistId, auto: state.auto, hash: state.hash };
        state.token = token; state.gistId = null; state.hash = null;
        try {
          state.gistId = await client().find();
        } catch (e) { Object.assign(state, prev); throw e; }
        // Se já existe um backup na nuvem, não sobrescreve sozinho: o usuário escolhe enviar ou baixar.
        state.auto = !state.gistId;
        save();
        return { found: !!state.gistId };
      },
      disconnect() { state.token = null; state.gistId = null; state.hash = null; state.auto = false; state.last = null; save(); },
      async push(force) {
        if (!state.token) throw new SyncError('Nuvem desligada', 0);
        const content = snapshot(), h = hash(content);
        if (!force && h === state.hash) return false;
        const c = client();
        if (state.gistId) {
          try { await c.update(state.gistId, content); } catch (e) { if (e.status !== 404) throw e; state.gistId = null; }
        }
        if (!state.gistId) state.gistId = await c.create(content);
        state.hash = h; state.last = Date.now(); state.auto = true;
        save();
        return true;
      },
      async pull() {
        if (!state.token) throw new SyncError('Nuvem desligada', 0);
        if (!state.gistId) state.gistId = await client().find();
        if (!state.gistId) throw new SyncError('Nenhum backup na nuvem ainda', 404);
        const text = await client().read(state.gistId);
        if (!restore(text)) throw new SyncError('O backup da nuvem é inválido', 0);
        state.hash = hash(snapshot()); state.last = Date.now(); state.auto = true;
        save();
        return true;
      }
    };
    return sync;
  }

  const api = { FILE, hash, SyncError, createGistClient, createSync };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.CGSync = api;

  // ---------- Interface (só no navegador / WebView) ----------
  const app = root.CGApp;
  const tools = document.querySelector('.tools');
  if (!app || !tools) return;

  const KEY = 'cg:sync';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ } };
  const sync = createSync({ state, save, fetchFn: (u, o) => root.fetch(u, o), snapshot: app.snapshot, restore: app.restore });

  const css = document.createElement('style');
  css.textContent = '.cloud{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);display:flex;flex-direction:column;gap:10px;font-size:14px}' +
    '.cloud p{margin:0;color:var(--mute)}.cloud input[type=password]{height:44px;width:100%;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:0 10px;font:500 15px/1 var(--f-body)}' +
    '.cloud .r{display:flex;flex-wrap:wrap;gap:8px}.cloud label.ck2{display:flex;gap:8px;align-items:center;color:var(--ink)}.cloud label.ck2 input{width:20px;height:20px}' +
    '.cloud a{color:var(--accent)}.cloud .st{color:var(--ink);font-weight:600}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const btn = mk('button', 'btn', 'Nuvem'); btn.type = 'button'; btn.id = 'bcloud';
  tools.appendChild(btn);
  const panel = mk('div', 'cloud'); panel.id = 'cloud'; panel.hidden = true;
  tools.insertAdjacentElement('afterend', panel);
  let msg = '';

  const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' de ' + d.toLocaleDateString('pt-BR'); };
  const say = (t) => { msg = t; draw(); };
  const fail = (e) => say(e && e.message ? e.message : 'Erro na nuvem');

  function draw() {
    btn.textContent = sync.connected() ? (sync.dirty() ? 'Nuvem •' : 'Nuvem ✓') : 'Nuvem';
    if (panel.hidden) return;
    panel.textContent = '';
    if (!sync.connected()) {
      panel.appendChild(mk('p', null, 'Guarde uma cópia do caderno num gist secreto do GitHub. O app continua funcionando sem internet; a cópia é enviada quando houver sinal.'));
      const p = mk('p'); p.append('Crie um token em ');
      const a = mk('a', null, 'github.com/settings/tokens'); a.href = 'https://github.com/settings/tokens/new?scopes=gist&description=Caderno%20de%20Cargas'; a.target = '_blank'; a.rel = 'noopener';
      p.append(a, ' marcando só a permissão "gist", e cole abaixo.');
      panel.appendChild(p);
      const tk = mk('input'); tk.type = 'password'; tk.placeholder = 'Token do GitHub'; tk.autocomplete = 'off'; tk.setAttribute('aria-label', 'Token do GitHub');
      const ok = mk('button', 'btn pri', 'Conectar'); ok.type = 'button';
      ok.addEventListener('click', () => {
        const v = tk.value.trim();
        if (!v) return say('Cole o token primeiro');
        say('Conectando…');
        sync.connect(v).then((r) => {
          if (r.found) say('Achei um backup na nuvem. Toque em "Baixar da nuvem" para usá-lo ou em "Enviar agora" para substituí-lo.');
          else { say('Conectado'); autoPush(); }
        }, fail);
      });
      panel.append(tk, ok);
    } else {
      panel.appendChild(mk('p', 'st', state.last ? 'Último envio/recebimento: ' + hhmm(state.last) : 'Conectado, ainda sem envio'));
      const lab = mk('label', 'ck2'); const cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!state.auto;
      cb.addEventListener('change', () => { state.auto = cb.checked; save(); if (cb.checked) autoPush(); });
      lab.append(cb, 'Enviar sozinho quando houver internet');
      panel.appendChild(lab);
      const r = mk('div', 'r');
      const up = mk('button', 'btn pri', 'Enviar agora'), down = mk('button', 'btn', 'Baixar da nuvem'), off = mk('button', 'btn dng', 'Desconectar');
      [up, down, off].forEach((b) => { b.type = 'button'; });
      up.addEventListener('click', () => { say('Enviando…'); sync.push(true).then(() => { say('Enviado'); app.status('Enviado para a nuvem'); }, fail); });
      let armed = false, tm = null;
      down.addEventListener('click', () => {
        if (!armed) { armed = true; down.textContent = 'Toque de novo: substitui os dados deste aparelho'; tm = setTimeout(() => { armed = false; down.textContent = 'Baixar da nuvem'; }, 4000); return; }
        clearTimeout(tm); say('Baixando…');
        sync.pull().then(() => { say('Dados da nuvem carregados'); app.status('Backup da nuvem importado'); }, fail);
      });
      off.addEventListener('click', () => { sync.disconnect(); say('Desconectado. O token foi apagado deste aparelho.'); });
      r.append(up, down, off);
      panel.appendChild(r);
      panel.appendChild(mk('p', null, 'Se usar o caderno em dois aparelhos, o último envio vale. Baixe antes de treinar no outro aparelho.'));
    }
    if (msg) panel.appendChild(mk('p', 'st', msg));
  }

  let timer = null, busy = false;
  function autoPush() {
    if (!sync.connected() || !state.auto || busy || (root.navigator && root.navigator.onLine === false)) return draw();
    busy = true;
    sync.push(false).then((sent) => { if (sent) msg = 'Enviado automaticamente'; }, (e) => { msg = e.status === 0 ? 'Sem internet: envio quando voltar o sinal' : e.message; })
      .then(() => { busy = false; draw(); });
  }
  app.saved.push(() => { draw(); clearTimeout(timer); timer = setTimeout(autoPush, 4000); });
  root.addEventListener('online', autoPush);
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; msg = ''; draw(); });
  draw();
  autoPush();
})(typeof globalThis !== 'undefined' ? globalThis : this);
