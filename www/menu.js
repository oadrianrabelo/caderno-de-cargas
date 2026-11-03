// Menu "Mais": deixa à vista só o que se usa no treino (Editar, Pular, Progresso) e guarda o resto.
// Roda por último, depois que todos os scripts criaram seus botões.
(function () {
  const tools = document.querySelector('.tools');
  if (!tools) return;
  const css = document.createElement('style');
  css.textContent = '.more{display:flex;flex-wrap:wrap;gap:8px;width:100%;padding:10px;border:1px dashed var(--line);border-radius:10px}' +
    '@keyframes cgmore{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}.more:not([hidden]){animation:cgmore .18s ease-out}' +
    '@media (prefers-reduced-motion: reduce){.more:not([hidden]){animation:none}}';
  document.head.appendChild(css);
  const IDS = ['breminder', 'bplates', 'bprogs', 'bexp', 'bimp', 'bcsv', 'bcloud', 'btheme', 'bgloss', 'bnews', 'bver'];
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'bmore';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'more');
  const box = document.createElement('div'); box.className = 'more'; box.id = 'more'; box.hidden = true;
  IDS.forEach((id) => { const b = document.getElementById(id); if (b) box.appendChild(b); });
  const label = () => { btn.textContent = box.hidden ? 'Mais ▾' : 'Menos ▴'; btn.setAttribute('aria-expanded', String(!box.hidden)); };
  btn.addEventListener('click', () => { box.hidden = !box.hidden; label(); });
  tools.appendChild(btn);
  tools.appendChild(box);
  label();
})();
