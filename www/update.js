// Atualização automática do app Android a partir das Releases do GitHub.
// - Mudou só o app web (quase sempre): baixa o pacote e troca sem reinstalar (plugin nativo WebUpdate).
// - Mudou a parte Android: avisa e oferece o APK novo.
// No navegador este arquivo não faz nada.
(function (root) {
  const REPO = 'oadrianrabelo/caderno-de-cargas';
  const CHECK_EVERY_MS = 6 * 3600 * 1000;
  const ASSET = /^web-(\d+)-([0-9a-f]+)\.json$/;

  // Decide o que fazer com a última Release: 'none', 'web' (atualiza sozinho) ou 'apk' (precisa reinstalar).
  function decide(cur, remote, bad) {
    if (!cur || !remote || !(remote.build > cur.build)) return 'none';
    if (remote.native !== cur.native) return 'apk';
    return remote.build === bad ? 'none' : 'web';
  }

  // Lê a Release: build e hash nativo vêm do nome do pacote web; também acha o APK.
  function parseRelease(rel) {
    let web = null, apk = null;
    for (const a of (rel && rel.assets) || []) {
      const m = ASSET.exec(a.name);
      // api: endereço da API do arquivo, usado com token quando o repositório é privado.
      if (m) web = { build: Number(m[1]), native: m[2], url: a.browser_download_url, api: a.url };
      else if (/\.apk$/.test(a.name)) apk = a.browser_download_url;
    }
    return web ? Object.assign(web, { version: rel.tag_name, apk }) : null;
  }

  // Confere o pacote antes de gravar: precisa ser da versão anunciada e ter os arquivos principais.
  function validBundle(b, remote) {
    return !!(b && b.files && b.build === remote.build && b.native === remote.native &&
      typeof b.files['index.html'] === 'string' && b.files['index.html'].indexOf('<script src="logic.js">') > 0 &&
      typeof b.files['logic.js'] === 'string' && typeof b.files['update.js'] === 'string');
  }

  const api = { decide, parseRelease, validBundle };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  const cap = root.Capacitor, app = root.CGApp;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !cap.isPluginAvailable || !cap.isPluginAvailable('WebUpdate') || !app) return;
  const plugin = (n) => (cap.Plugins && cap.Plugins[n]) || cap.registerPlugin(n);
  const WU = plugin('WebUpdate'), FS = plugin('Filesystem'), HTTP = plugin('CapacitorHttp');
  const KEY = 'cg:update';
  const startedAt = Date.now();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ } };

  // Aviso no topo da tela.
  function banner(text, action, onClick, href) {
    let n = document.getElementById('updnote');
    if (!n) { n = document.createElement('div'); n.id = 'updnote'; n.className = 'note'; document.querySelector('main').prepend(n); }
    n.textContent = text + ' ';
    if (action) {
      const b = document.createElement(href ? 'a' : 'button');
      b.className = 'btn pri'; b.textContent = action; b.style.marginTop = '8px'; b.style.display = 'inline-flex'; b.style.alignItems = 'center'; b.style.textDecoration = 'none';
      if (href) b.href = href; else { b.type = 'button'; b.addEventListener('click', onClick); }
      n.appendChild(document.createElement('br')); n.appendChild(b);
    }
  }

  const apply = (ready) => { app.flush(); return WU.apply({ path: ready.path, build: ready.build }); };
  const auth = (st) => (st.token ? { Authorization: 'Bearer ' + st.token } : {});

  // Repositório privado: pede o arquivo à API com o token e segue o redirecionamento SEM o token
  // (o link temporário do armazenamento do GitHub não aceita o cabeçalho de autorização).
  async function fetchBundle(remote, st) {
    if (!st.token || !remote.api) return HTTP.request({ url: remote.url, method: 'GET', responseType: 'text' });
    const first = await HTTP.request({ url: remote.api, method: 'GET', responseType: 'text', disableRedirects: true, headers: Object.assign({ Accept: 'application/octet-stream' }, auth(st)) });
    if (first.status >= 300 && first.status < 400) {
      const h = first.headers || {}, loc = h.Location || h.location || h.LOCATION;
      if (!loc) throw new Error('sem redirecionamento');
      return HTTP.request({ url: loc, method: 'GET', responseType: 'text' });
    }
    return first;
  }

  async function download(remote, st) {
    const res = await fetchBundle(remote, st);
    const b = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (!validBundle(b, remote)) throw new Error('pacote inválido');
    const dir = 'web/b' + remote.build;
    for (const f of Object.keys(b.files)) {
      if (f.indexOf('..') >= 0 || f.startsWith('/')) throw new Error('caminho inválido');
      await FS.writeFile({ path: dir + '/' + f, data: b.files[f], directory: 'DATA', encoding: 'utf8', recursive: true });
    }
    const { uri } = await FS.getUri({ path: dir, directory: 'DATA' });
    return { build: remote.build, version: remote.version, path: decodeURI(uri.replace(/^file:\/\//, '')) };
  }

  // Apaga pacotes antigos (fica só o que está em uso e o que está pronto para aplicar).
  async function cleanup(keep) {
    try {
      const { files } = await FS.readdir({ path: 'web', directory: 'DATA' });
      for (const f of files) {
        const name = typeof f === 'string' ? f : f.name;
        if (keep.indexOf(name) < 0) await FS.rmdir({ path: 'web/' + name, directory: 'DATA', recursive: true });
      }
    } catch (e) { /* pasta ainda não existe */ }
  }

  async function latestRelease(st) {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: Object.assign({ Accept: 'application/vnd.github+json' }, auth(st)) }).catch(() => null);
    if (!r) return { error: 'Sem internet' };
    if (r.status === 401) return { error: 'Token inválido ou expirado' };
    if (r.status === 404 || r.status === 403) return { error: st.token ? 'O token não tem acesso ao repositório' : 'Repositório privado: cole um token de leitura' };
    return r.ok ? { rel: await r.json() } : { error: 'GitHub respondeu ' + r.status };
  }

  async function run(force) {
    // 1. Esta versão abriu e desenhou a tela: confirma (se for uma atualização recém-aplicada).
    if (document.querySelector('#list') && document.querySelector('.tab')) await WU.confirm().catch(() => null);
    const cur = await fetch('version.json').then((r) => r.json()).catch(() => null);
    if (!cur || !cur.build) return; // build local de desenvolvimento: sem atualização automática
    const info = await WU.info().catch(() => ({ bad: 0 }));
    const st = load();

    // 2. Já baixada numa sessão anterior: aplica logo na abertura do app.
    if (st.ready && st.ready.build > cur.build && st.ready.build !== info.bad) {
      if (Date.now() - startedAt < 4000) { apply(st.ready).catch(() => { delete st.ready; store(st); }); return; }
      banner('Nova versão ' + st.ready.version + ' pronta.', 'Atualizar agora', () => apply(st.ready));
      return;
    }
    if (st.ready && st.ready.build <= cur.build) { delete st.ready; store(st); }
    cleanup(['b' + cur.build]);

    // 3. Procura versão nova (no máximo a cada 6 horas, e só com internet).
    if (!force && (root.navigator.onLine === false || (st.checked && Date.now() - st.checked < CHECK_EVERY_MS))) return;
    const got = await latestRelease(st);
    st.lastResult = got.error || 'ok'; store(st);
    if (!got.rel) return got.error;
    st.checked = Date.now(); store(st);
    const remote = parseRelease(got.rel), what = decide(cur, remote, info.bad);
    if (what === 'apk') {
      banner('Nova versão ' + remote.version + ' do app. Esta precisa instalar o APK: antes, toque em "Exportar backup" para guardar seus dados.', remote.apk ? 'Baixar APK' : null, null, remote.apk);
    } else if (what === 'web') {
      const ready = await download(remote, st).catch(() => null);
      if (!ready) return 'Não consegui baixar a versão ' + remote.version;
      st.ready = ready; store(st);
      banner('Nova versão ' + ready.version + ' baixada. Ela entra sozinha na próxima vez que abrir o app.', 'Atualizar agora', () => apply(ready));
      return 'Versão ' + ready.version + ' baixada';
    }
    return what === 'apk' ? 'Há um APK novo' : 'Você já está na versão mais recente';
  }

  // Painel "Versão": versão instalada, verificar agora e token para repositório privado.
  const tools = document.querySelector('.tools');
  if (tools) {
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const btn = mk('button', 'btn', 'Versão'); btn.type = 'button'; btn.id = 'bver';
    const panel = mk('div', 'pr'); panel.id = 'version'; panel.hidden = true;
    tools.appendChild(btn);
    tools.insertAdjacentElement('afterend', panel);
    let msg = '';
    const draw = async () => {
      const cur = await fetch('version.json').then((r) => r.json()).catch(() => null), st = load();
      panel.textContent = '';
      panel.appendChild(mk('h3', null, 'Versão'));
      panel.appendChild(mk('p', null, cur ? 'Instalada: ' + cur.version + ' (build ' + cur.build + ')' : 'Versão de desenvolvimento'));
      if (st.checked) panel.appendChild(mk('p', null, 'Última verificação: ' + new Date(st.checked).toLocaleString('pt-BR')));
      const chk = mk('button', 'btn pri', 'Verificar atualização agora'); chk.type = 'button';
      chk.addEventListener('click', () => { msg = 'Verificando…'; draw(); run(true).then((m) => { msg = m || ''; draw(); }, () => { msg = 'Erro ao verificar'; draw(); }); });
      panel.appendChild(chk);
      panel.appendChild(mk('h3', null, 'Repositório privado'));
      const p = mk('p'); p.append('Se o repositório for privado, o app precisa de um token só de leitura. Crie em ');
      const a = mk('a', null, 'github.com/settings/personal-access-tokens/new'); a.href = 'https://github.com/settings/personal-access-tokens/new'; a.target = '_blank'; a.rel = 'noopener';
      p.append(a, ' (token fine-grained: acesso só ao repositório caderno-de-cargas, permissão "Contents: Read-only"). Ele fica salvo só neste aparelho.');
      panel.appendChild(p);
      const tk = mk('input'); tk.type = 'password'; tk.placeholder = st.token ? 'Token salvo' : 'Token de leitura do GitHub'; tk.autocomplete = 'off'; tk.setAttribute('aria-label', 'Token de leitura do GitHub');
      const r = mk('div', 'r');
      const save = mk('button', 'btn', 'Salvar token'); save.type = 'button';
      save.addEventListener('click', () => { const v = tk.value.trim(); if (!v) return; const s2 = load(); s2.token = v; delete s2.checked; store(s2); msg = 'Token salvo. Verificando…'; draw(); run(true).then((m) => { msg = m || ''; draw(); }); });
      r.appendChild(save);
      if (st.token) {
        const del = mk('button', 'btn dng', 'Apagar token'); del.type = 'button';
        del.addEventListener('click', () => { const s2 = load(); delete s2.token; store(s2); msg = 'Token apagado'; draw(); });
        r.appendChild(del);
      }
      panel.append(tk, r);
      if (msg) panel.appendChild(mk('p', null, msg));
    };
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; msg = ''; if (!panel.hidden) draw(); });
  }

  root.CGUpdate = { run };
  run().catch(() => { /* sem atualização desta vez */ });
})(typeof globalThis !== 'undefined' ? globalThis : this);
