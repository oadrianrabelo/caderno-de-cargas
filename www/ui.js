// Acabamento da interface: folhas (Progresso, Nuvem, Programas, Versão, Mais) uma por vez, com fundo
// escurecido e botão de fechar; indicador deslizante nas abas dos dias. Só comportamento visual.
(function () {
  const SHEETS = ['progress', 'cloud', 'programs', 'version', 'look', 'remind', 'more'];
  const els = () => SHEETS.map((id) => document.getElementById(id)).filter(Boolean);

  const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim'; scrim.hidden = true;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'sheetx'; close.id = 'sheetx';
  close.setAttribute('aria-label', 'Fechar'); close.hidden = true;
  document.body.append(scrim, close);

  function hide(el) {
    if (el.id === 'more' && window.CGMenu) CGMenu.close(); else el.hidden = true;
  }
  let syncing = false, last = null;
  function sync(changed) {
    if (syncing) return;
    syncing = true;
    // Abriu uma folha: fecha as outras e qualquer janela de dica que tenha ficado aberta.
    if (changed && !changed.hidden) {
      els().forEach((el) => { if (el !== changed && !el.hidden) hide(el); });
      const tip = document.getElementById('tipov'); if (tip) tip.hidden = true;
    }
    const open = els().filter((el) => !el.hidden);
    const top = open[open.length - 1] || null;
    scrim.hidden = !top; close.hidden = !top || top.id === 'more';
    document.body.classList.toggle('sheet-open', !!top);
    if (top && top !== last) top.scrollTop = 0;
    last = top;
    syncing = false;
  }
  const mo = new MutationObserver((ms) => ms.forEach((m) => sync(m.target)));
  els().forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }));
  const closeAll = () => els().forEach((el) => { if (!el.hidden) hide(el); });
  scrim.addEventListener('click', closeAll);
  close.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  // Botão voltar do Android (APK novo): fecha o que estiver por cima, um de cada vez. Devolve false quando
  // não há nada aberto (aí o app vai para o fundo).
  window.CGBack = () => {
    const tip = document.getElementById('tipov'); if (tip && !tip.hidden) { tip.hidden = true; return true; }
    const cele = document.getElementById('cele'); if (cele) { cele.remove(); return true; }
    if (els().some((el) => !el.hidden)) { closeAll(); return true; }
    if (document.body.classList.contains('focus')) { const f = document.getElementById('bfocus'); if (f) { f.click(); return true; } }
    const ed = document.getElementById('bedit'); if (ed && ed.classList.contains('pri')) { ed.click(); return true; }
    return false;
  };
  // Editar e Modo foco mudam a tela de baixo: fecham a folha aberta para não ficar uma por cima da outra.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#bedit, #bfocus')) return;
    closeAll();
    const tip = document.getElementById('tipov'); if (tip) tip.hidden = true;
  }, true);
  sync();

  // Abas dos dias: um "trilho" com indicador que desliza até o dia escolhido. As abas são uma grade de colunas
  // iguais (3 px de borda interna, 2 px entre elas), então a posição sai por conta, sem medir nada na tela.
  const tabs = document.getElementById('tabs');
  if (tabs) {
    let prev = null;
    const pos = (ind, i, n) => {
      ind.style.width = 'calc((100% - 6px - ' + (n - 1) * 2 + 'px) / ' + n + ')';
      ind.style.transform = 'translateX(calc(' + i + ' * (100% + 2px)))';
    };
    const place = () => {
      if (tabs.querySelector('.tabind')) return; // só quando as abas foram refeitas
      const all = [...tabs.querySelectorAll('.tab')], i = all.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const ind = document.createElement('span'); ind.className = 'tabind'; ind.setAttribute('aria-hidden', 'true');
      ind.style.left = '3px';
      tabs.prepend(ind);
      if (i < 0) { ind.style.opacity = '0'; prev = null; return; }
      const n = all.length;
      // Começa onde estava (troca de dia) e desliza até o novo dia no quadro seguinte.
      if (prev !== null && prev !== i && prev < n) {
        ind.style.transition = 'none'; pos(ind, prev, n);
        requestAnimationFrame(() => requestAnimationFrame(() => { ind.style.transition = ''; pos(ind, i, n); }));
      } else pos(ind, i, n);
      prev = i;
    };
    new MutationObserver(place).observe(tabs, { childList: true });
    place();
  }
  // Campos de carga e reps: o número diminui para caber (ex.: 102,5 numa fonte larga), sem cortar.
  const list = document.getElementById('list');
  if (list) {
    const ctx = document.createElement('canvas').getContext('2d');
    // Lê tudo primeiro e escreve depois (uma vez por quadro), para não forçar o navegador a recalcular a cada campo.
    const fitAll = () => {
      const inputs = [...list.querySelectorAll('.set input')];
      const plan = inputs.map((inp) => {
        const text = inp.value || inp.placeholder || '';
        if (!text) return [inp, ''];
        const cs = getComputedStyle(inp);
        const base = inp.style.fontSize ? parseFloat(inp.dataset.fs) : parseFloat(cs.fontSize);
        const room = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
        if (!base || room <= 0) return [inp, ''];
        ctx.font = cs.fontWeight + ' ' + base + 'px ' + cs.fontFamily;
        const w = ctx.measureText(text).width + (parseFloat(cs.letterSpacing) || 0) * text.length;
        inp.dataset.fs = base;
        return [inp, w > room ? Math.max(14, Math.floor(base * room / w)) + 'px' : ''];
      });
      plan.forEach(([inp, size]) => { if (inp.style.fontSize !== size) inp.style.fontSize = size; });
    };
    let queued = false;
    const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fitAll(); }); };
    list.addEventListener('input', (e) => { if (e.target.matches('.set input')) later(); });
    new MutationObserver(later).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder'] });
    document.addEventListener('cg:theme', later);
    if (document.fonts) { if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', later); document.fonts.ready.then(later); }
    window.addEventListener('resize', later);
    fitAll();
  }
})();
