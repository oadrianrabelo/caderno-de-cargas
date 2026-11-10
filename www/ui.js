// Acabamento da interface: folhas (Progresso, Nuvem, Programas, Versão, Mais) uma por vez, com fundo
// escurecido e botão de fechar; indicador deslizante nas abas dos dias. Só comportamento visual.
(function () {
  const SHEETS = ['progress', 'cloud', 'programs', 'version', 'more'];
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
    // Abriu uma folha: fecha as outras.
    if (changed && !changed.hidden) els().forEach((el) => { if (el !== changed && !el.hidden) hide(el); });
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
  sync();

  // Abas dos dias: um "trilho" com indicador que desliza até o dia escolhido.
  const tabs = document.getElementById('tabs');
  if (tabs) {
    let ind = null;
    const place = (instant) => {
      const sel = tabs.querySelector('.tab[aria-selected="true"]');
      if (!ind || !ind.isConnected) { ind = document.createElement('span'); ind.className = 'tabind'; ind.setAttribute('aria-hidden', 'true'); tabs.prepend(ind); instant = true; }
      if (!sel) { ind.style.opacity = '0'; return; }
      if (instant) ind.style.transition = 'none';
      ind.style.opacity = '1';
      ind.style.width = sel.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + sel.offsetLeft + 'px)';
      if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
    };
    let prevX = null;
    new MutationObserver(() => {
      if (ind && ind.isConnected) return; // só reage quando as abas foram refeitas
      const old = prevX;
      place(true);
      // Anima a partir da posição anterior (troca de dia), em vez de pular.
      const sel = tabs.querySelector('.tab[aria-selected="true"]');
      if (sel && old !== null && old !== sel.offsetLeft) {
        ind.style.transition = 'none'; ind.style.transform = 'translateX(' + old + 'px)'; void ind.offsetWidth;
        ind.style.transition = ''; ind.style.transform = 'translateX(' + sel.offsetLeft + 'px)';
      }
      prevX = sel ? sel.offsetLeft : null;
    }).observe(tabs, { childList: true });
    window.addEventListener('resize', () => place(true));
    place(true);
    const s0 = tabs.querySelector('.tab[aria-selected="true"]'); prevX = s0 ? s0.offsetLeft : null;
  }
})();
