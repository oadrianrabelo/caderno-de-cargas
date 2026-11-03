// Preferências: tema (automático, claro, escuro) e tela de Novidades depois de cada atualização.
(function () {
  const tools = document.querySelector('.tools');
  if (!tools) return;
  const root = document.documentElement;
  const THEMES = [['auto', 'Tema: automático'], ['light', 'Tema: claro'], ['dark', 'Tema: escuro']];
  const get = () => { try { return localStorage.getItem('cg:theme') || 'auto'; } catch (e) { return 'auto'; } };
  function apply(t) {
    if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
    try { localStorage.setItem('cg:theme', t); } catch (e) { /* sem armazenamento */ }
    btn.textContent = THEMES.find((x) => x[0] === t)[1];
    document.dispatchEvent(new CustomEvent('cg:theme'));
  }
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'btheme';
  btn.addEventListener('click', () => { const i = THEMES.findIndex((x) => x[0] === get()); apply(THEMES[(i + 1) % THEMES.length][0]); });
  tools.appendChild(btn);
  apply(get());

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
