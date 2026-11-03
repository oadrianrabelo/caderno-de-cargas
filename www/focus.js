// Modo foco: um exercício por vez, em letras grandes, para usar com o celular apoiado.
(function () {
  const app = window.CGApp, list = document.getElementById('list'), tools = document.querySelector('.tools');
  if (!app || !list || !tools) return;

  const css = document.createElement('style');
  css.textContent = '.fbar{display:none}' +
    'body.focus .fbar{display:flex;gap:8px;align-items:center;margin-bottom:10px}.fbar span{flex:1;text-align:center;color:var(--mute);font:600 14px/1 var(--f-body)}' +
    '.fbar button{min-height:48px;min-width:56px;padding:0 12px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;font:700 16px/1 var(--f-body);cursor:pointer}' +
    'body.focus .list .ex:not(.cur),body.focus #sess,body.focus .tip,body.focus .tabs,body.focus .bar,body.focus .note:not(#skipnote){display:none}' +
    'body.focus .ex.cur{display:block}body.focus .ex.cur.collapsed .sets,body.focus .ex.cur.collapsed .swap,body.focus .ex.cur.collapsed .det,body.focus .ex.cur.collapsed .meta{display:revert}' +
    'body.focus .ex.cur .exn h2{font-size:24px}body.focus .ex.cur .meta{font-size:16px}' +
    'body.focus .fld input{height:72px;font-size:32px}body.focus .ck{height:72px;width:72px}body.focus .ck svg{width:32px;height:32px}' +
    'body.focus .set{grid-template-columns:34px 1fr 14px 1fr 72px}body.focus .sl{font-size:20px}' +
    'body.focus .tools>:not(#bfocus){display:none}';
  document.head.appendChild(css);

  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.id = 'bfocus'; btn.textContent = 'Modo foco';
  const prog = document.getElementById('bprog');
  if (prog && prog.nextSibling) tools.insertBefore(btn, prog.nextSibling); else tools.appendChild(btn);
  const bar = document.createElement('div'); bar.className = 'fbar'; bar.id = 'fbar';
  const prev = document.createElement('button'), pos = document.createElement('span'), next = document.createElement('button');
  prev.type = next.type = 'button'; prev.textContent = '‹'; next.textContent = '›';
  prev.setAttribute('aria-label', 'Exercício anterior'); next.setAttribute('aria-label', 'Próximo exercício');
  bar.append(prev, pos, next);
  list.before(bar);

  let on = false, idx = 0;
  const cards = () => [...list.querySelectorAll('.ex')];
  function show(i) {
    const cs = cards();
    if (!cs.length) { pos.textContent = 'Sem exercícios'; return; }
    idx = Math.max(0, Math.min(cs.length - 1, i));
    cs.forEach((c, j) => c.classList.toggle('cur', j === idx));
    pos.textContent = (idx + 1) + ' de ' + cs.length;
    prev.disabled = idx === 0; next.disabled = idx === cs.length - 1;
  }
  const firstOpen = () => { const cs = cards(), i = cs.findIndex((c) => !c.classList.contains('complete')); return i < 0 ? cs.length - 1 : i; };
  function set(v) {
    on = v;
    document.body.classList.toggle('focus', on);
    btn.textContent = on ? 'Sair do foco' : 'Modo foco';
    if (on) { show(firstOpen()); scrollTo(0, 0); }
    else cards().forEach((c) => c.classList.remove('cur'));
  }
  btn.addEventListener('click', () => set(!on));
  prev.addEventListener('click', () => show(idx - 1));
  next.addEventListener('click', () => show(idx + 1));

  // Lista refeita (trocou de dia, editou): volta ao primeiro exercício que falta.
  new MutationObserver(() => { if (on) show(firstOpen()); }).observe(list, { childList: true });
  // Terminou o exercício atual: passa para o próximo que falta.
  list.addEventListener('click', (e) => {
    if (!on || !e.target.closest('.ck')) return;
    setTimeout(() => {
      const c = cards()[idx];
      if (c && c.classList.contains('complete')) setTimeout(() => show(firstOpen()), 600);
    }, 0);
  });
  window.CGFocus = { set, show };
})();
