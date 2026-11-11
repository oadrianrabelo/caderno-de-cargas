// Barra inferior e menu "Mais": à vista só o que se usa no treino (Editar, Progresso, Foco);
// o resto fica numa folha que sobe, em grupos. Roda por último, depois que os scripts criaram seus botões.
(function () {
  const tools = document.querySelector('.tools');
  if (!tools) return;
  const GROUPS = [
    ['Treino', ['bskip', 'bprogs', 'bplates', 'bremind']],
    ['Dados', ['bexp', 'bimp', 'bcsv', 'bcloud']],
    ['App', ['btheme', 'bgloss', 'bnews', 'bver']]
  ];
  // Itens que abrem outra tela: o menu fecha ao tocar neles (todos abrem outra tela).
  const KEEP_OPEN = [];

  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'bmore'; btn.textContent = 'Mais';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'more');
  const box = document.createElement('div'); box.className = 'more'; box.id = 'more'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Mais opções');
  GROUPS.forEach(([title, ids]) => {
    const g = document.createElement('section'); g.className = 'mgroup';
    const h = document.createElement('h3'); h.textContent = title;
    const list = document.createElement('div'); list.className = 'mlist';
    ids.forEach((id) => { const b = document.getElementById(id); if (b) list.appendChild(b); });
    if (list.children.length) { g.append(h, list); box.appendChild(g); }
  });
  const set = (open) => { box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('on', open); };
  btn.addEventListener('click', () => set(box.hidden));
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && KEEP_OPEN.indexOf(b.id) < 0) set(false); });
  tools.appendChild(btn);
  // Fora da barra: a barra usa transform, que prenderia uma folha fixa dentro dela.
  document.body.appendChild(box);
  window.CGMenu = { open: () => set(true), close: () => set(false) };
})();
