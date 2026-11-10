// Preferências: Aparência (modo claro/escuro, paleta e fontes) e tela de Novidades depois de cada atualização.
(function () {
  const tools = document.querySelector('.tools');
  if (!tools) return;
  const root = document.documentElement;
  const MODES = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];
  const get = () => { try { return localStorage.getItem('cg:theme') || 'auto'; } catch (e) { return 'auto'; } };
  function apply(t) {
    if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
    try { localStorage.setItem('cg:theme', t); } catch (e) { /* sem armazenamento */ }
    document.dispatchEvent(new CustomEvent('cg:theme'));
  }
  apply(get());

  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'btheme'; btn.textContent = 'Aparência';
  tools.appendChild(btn);
  const L = window.CGLook;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const sheet = el('div', 'look'); sheet.id = 'look'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Aparência');
  document.body.appendChild(sheet);
  let slot = 'title';
  const SLOTS = [['title', 'Títulos'], ['num', 'Números'], ['text', 'Texto']];
  const KINDS = [['sans', 'Sem serifa'], ['serif', 'Com serifa'], ['mono', 'Mono · zero cortado']];

  function render() {
    const v = L ? L.get() : null, mode = get();
    sheet.textContent = '';
    sheet.appendChild(el('h2', '', 'Aparência'));
    // Prévia com as escolhas atuais.
    const pv = el('div', 'lprev');
    pv.append(el('small', '', 'Semana 3 · Push'), el('b', '', 'Supino reto'), el('strong', '', '102,5 kg × 8'), el('p', '', 'Última série até a falha. Descanso de 3 min.'));
    sheet.appendChild(pv);

    sheet.appendChild(el('h3', '', 'Modo'));
    const seg = el('div', 'lseg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Modo');
    MODES.forEach(([k, name]) => {
      const b = el('button', '', name); b.type = 'button'; b.setAttribute('aria-pressed', String(mode === k));
      b.addEventListener('click', () => { apply(k); render(); });
      seg.appendChild(b);
    });
    sheet.appendChild(seg);
    if (!L) return;

    sheet.appendChild(el('h3', '', 'Tema'));
    const pals = el('div', 'lpals');
    L.PALETTES.forEach(([k, name, lc, dc]) => {
      const b = el('button', 'lpal'); b.type = 'button'; b.dataset.palette = k; b.setAttribute('aria-pressed', String(v.palette === k)); b.setAttribute('aria-label', 'Tema ' + name);
      const sw = el('span', 'sw');
      [lc, dc].forEach((c) => { const h = el('i'); h.style.background = c[0]; const d = el('u'); d.style.background = c[2]; d.style.boxShadow = '0 0 0 3px ' + c[1]; h.appendChild(d); sw.appendChild(h); });
      b.append(sw, el('span', 'nm', name));
      b.addEventListener('click', () => { L.set({ palette: k }); render(); });
      pals.appendChild(b);
    });
    sheet.appendChild(pals);

    sheet.appendChild(el('h3', '', 'Fontes'));
    const fs = el('div', 'lseg'); fs.setAttribute('role', 'tablist'); fs.setAttribute('aria-label', 'Onde aplicar a fonte');
    SLOTS.forEach(([k, name]) => {
      const b = el('button', '', name); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(slot === k)); b.setAttribute('aria-pressed', String(slot === k));
      b.addEventListener('click', () => { slot = k; render(); });
      fs.appendChild(b);
    });
    sheet.appendChild(fs);
    KINDS.forEach(([kind, title]) => {
      sheet.appendChild(el('div', 'lkind', title));
      const list = el('div', 'lfonts');
      L.FONTS.filter((f) => f[3] === kind).forEach(([id, name]) => {
        L.load(id);
        const b = el('button', 'lfont'); b.type = 'button'; b.dataset.font = id; b.setAttribute('aria-pressed', String(v[slot] === id));
        b.style.fontFamily = L.stack(id);
        b.append(el('span', 'nm', name), el('span', 'smp', slot === 'num' ? '102,5 × 8' : slot === 'title' ? 'Supino' : 'Aa 0'));
        b.addEventListener('click', () => { const p = {}; p[slot] = id; L.set(p); render(); });
        list.appendChild(b);
      });
      sheet.appendChild(list);
    });
    const rs = el('button', 'btn', 'Restaurar o visual padrão'); rs.type = 'button'; rs.id = 'lreset';
    rs.addEventListener('click', () => { L.reset(); apply('auto'); render(); });
    sheet.appendChild(rs);
  }
  btn.addEventListener('click', () => { render(); sheet.hidden = false; });

  // Novidades: mostra as mudanças das versões que o aparelho ainda não viu.
  const log = window.CG_CHANGELOG || [];
  function show(items, title) {
    let ov = document.getElementById('tipov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'tipov'; ov.id = 'tipov'; ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; }); document.body.appendChild(ov); }
    ov.textContent = '';
    const box = document.createElement('div'); box.className = 'tipbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    items.forEach((v) => {
      const t = document.createElement('h3'); t.textContent = v.version + (v.date ? ' · ' + v.date.split('-').reverse().join('/') : ''); box.appendChild(t);
      const ul = document.createElement('ul'); ul.style.margin = '0 0 8px'; ul.style.paddingLeft = '20px'; ul.style.color = 'var(--mute)';
      v.items.forEach((x) => { const li = document.createElement('li'); li.textContent = x; li.style.marginBottom = '4px'; ul.appendChild(li); });
      box.appendChild(ul);
    });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn pri'; ok.textContent = 'Fechar';
    ok.addEventListener('click', () => { ov.hidden = true; }); box.appendChild(ok);
    ov.appendChild(box); ov.hidden = false;
  }
  const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'btn'; nb.id = 'bnews'; nb.textContent = 'Novidades';
  nb.addEventListener('click', () => show(log, 'Novidades'));
  tools.appendChild(nb);
  if (log.length) {
    let seen = null;
    try { seen = localStorage.getItem('cg:seenVersion'); } catch (e) { /* sem armazenamento */ }
    const idx = seen ? log.findIndex((v) => v.version === seen) : -1;
    // Primeira abertura nesta versão de Novidades: mostra só a mais recente; depois, tudo o que veio desde a última vista.
    const fresh = idx < 0 ? log.slice(0, 1) : log.slice(0, idx);
    try { localStorage.setItem('cg:seenVersion', log[0].version); } catch (e) { /* sem armazenamento */ }
    const hasData = (() => { try { return !!localStorage.getItem('cg:logs'); } catch (e) { return false; } })();
    if (fresh.length && seen !== log[0].version && hasData) setTimeout(() => show(fresh, 'Novidades da atualização'), 400);
  }
})();
