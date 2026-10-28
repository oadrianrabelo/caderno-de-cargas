// Programas: o do Jeff Nippard (embutido) e os criados pelo usuário.
// Num programa próprio, cada dia tem uma lista de exercícios que vale para todas as semanas,
// editada pelo mesmo "Editar treino" de sempre.
(function () {
  const app = window.CGApp, tools = document.querySelector('.tools');
  if (!app || !tools || !window.CG) return;

  const css = document.createElement('style');
  css.textContent = '.pr{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);display:flex;flex-direction:column;gap:12px;font-size:14px}' +
    '.pr h3{margin:0;font:700 15px/1.2 var(--f-display);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}' +
    '.pr .it{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}.pr .it.on{border-color:var(--accent)}' +
    '.pr .it b{font-size:16px}.pr .it small{color:var(--mute)}.pr .r{display:flex;flex-wrap:wrap;gap:8px}' +
    '.pr label{display:flex;flex-direction:column;gap:4px;color:var(--mute);font-size:13px}' +
    '.pr input{height:44px;width:100%;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:0 10px;font:600 16px/1 var(--f-body)}' +
    '.pr .dr{display:grid;grid-template-columns:1fr 44px;gap:8px}.pr .dr button{height:44px}.pr p{margin:0;color:var(--mute)}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const button = (cls, txt) => { const b = mk('button', cls, txt); b.type = 'button'; return b; };

  const btn = button('btn', 'Programas'); btn.id = 'bprogs';
  tools.insertBefore(btn, tools.querySelector('#bexp'));
  const panel = mk('div', 'pr'); panel.id = 'programs'; panel.hidden = true;
  tools.insertAdjacentElement('afterend', panel);
  let form = null; // { id?: string, name, weeks, days: [{ id?, name }], fromJeff }

  function confirmButton(label, armedLabel, onConfirm, cls) {
    const b = button(cls || 'btn dng', label);
    let armed = false, tm = null;
    b.addEventListener('click', () => {
      if (!armed) { armed = true; b.textContent = armedLabel; tm = setTimeout(() => { armed = false; b.textContent = label; }, 3000); return; }
      clearTimeout(tm); onConfirm();
    });
    return b;
  }

  function item(name, info, active, actions) {
    const it = mk('div', 'it' + (active ? ' on' : ''));
    it.append(mk('b', null, name), mk('small', null, info + (active ? ' · em uso' : '')));
    const r = mk('div', 'r'); actions.forEach((a) => r.appendChild(a)); it.appendChild(r);
    return it;
  }

  function use(id) {
    const p = app.programs();
    if (id) p.active = id; else delete p.active;
    app.setPrograms(p);
    panel.hidden = true;
    app.status('Programa trocado');
  }

  function drawList() {
    const p = app.programs(), bts = app.bts(), list = p.list || {};
    panel.appendChild(mk('h3', null, 'Programas'));
    const u0 = button('btn', 'Usar');
    u0.addEventListener('click', () => use(null));
    panel.appendChild(item(bts.name, bts.order.length + ' dias · ' + bts.weeks + ' semanas · embutido', !p.active || !list[p.active], p.active && list[p.active] ? [u0] : []));
    Object.values(list).forEach((pg) => {
      const active = p.active === pg.id, acts = [];
      if (!active) { const u = button('btn', 'Usar'); u.addEventListener('click', () => use(pg.id)); acts.push(u); }
      const ed = button('btn', 'Editar dias');
      ed.addEventListener('click', () => { form = { id: pg.id, name: pg.name, weeks: pg.weeks, days: pg.days.map((d) => ({ id: d.id, name: d.name })) }; draw(); });
      acts.push(ed);
      acts.push(confirmButton('Excluir', 'Toque de novo para excluir', () => {
        delete p.list[pg.id];
        if (p.active === pg.id) delete p.active;
        app.setPrograms(p);
        app.status('Programa excluído (os registros continuam no backup)');
        draw();
      }));
      panel.appendChild(item(pg.name, pg.days.length + (pg.days.length === 1 ? ' dia' : ' dias') + ' · ' + pg.weeks + ' semanas', active, acts));
    });
    const nw = button('btn pri', '+ Criar meu programa');
    nw.addEventListener('click', () => { form = { name: '', weeks: 12, days: [{ name: 'Treino A' }, { name: 'Treino B' }, { name: 'Treino C' }], fromJeff: false }; draw(); });
    panel.appendChild(nw);
    panel.appendChild(mk('p', null, 'Num programa seu, os exercícios de cada dia valem para todas as semanas. Use "Editar treino" para montar cada dia. Os registros de carga continuam ligados ao nome do exercício, então a "última carga" aparece mesmo trocando de programa.'));
  }

  function drawForm() {
    const editingExisting = !!form.id;
    panel.appendChild(mk('h3', null, editingExisting ? 'Editar programa' : 'Novo programa'));
    const ln = mk('label', null, 'Nome'), nm = mk('input'); nm.value = form.name; nm.placeholder = 'Ex.: Meu ABC'; nm.maxLength = 60;
    nm.addEventListener('input', () => { form.name = nm.value; });
    ln.appendChild(nm);
    const lw = mk('label', null, 'Semanas'), wk = mk('input'); wk.type = 'number'; wk.inputMode = 'numeric'; wk.min = '1'; wk.max = '52'; wk.value = form.weeks;
    wk.addEventListener('input', () => { form.weeks = wk.value; });
    lw.appendChild(wk);
    panel.append(ln, lw);

    panel.appendChild(mk('h3', null, 'Dias de treino'));
    form.days.forEach((d, i) => {
      const row = mk('div', 'dr'), inp = mk('input'); inp.value = d.name; inp.maxLength = 30; inp.setAttribute('aria-label', 'Nome do dia ' + (i + 1));
      inp.addEventListener('input', () => { d.name = inp.value; });
      const rm = button('btn dng', '×'); rm.setAttribute('aria-label', 'Remover dia ' + (i + 1)); rm.disabled = form.days.length === 1;
      rm.addEventListener('click', () => { form.days.splice(i, 1); form.fromJeff = false; draw(); });
      row.append(inp, rm);
      panel.appendChild(row);
    });
    const r1 = mk('div', 'r');
    const add = button('btn', '+ Dia');
    add.disabled = form.days.length >= 7;
    add.addEventListener('click', () => { form.days.push({ name: 'Treino ' + String.fromCharCode(65 + form.days.length) }); form.fromJeff = false; draw(); });
    r1.appendChild(add);
    if (!editingExisting) {
      const jeff = button('btn', 'Partir do treino do Jeff');
      jeff.addEventListener('click', () => {
        const b = app.bts();
        form.days = b.order.map((d) => ({ name: b.names[d], jeff: d })); form.fromJeff = true;
        if (!form.name) form.name = 'Meu Jeff';
        draw();
      });
      r1.appendChild(jeff);
    }
    panel.appendChild(r1);
    if (form.fromJeff) panel.appendChild(mk('p', null, 'Os dias começam com os exercícios do Jeff da semana ' + app.view().week + '. Depois é só editar.'));
    if (editingExisting) panel.appendChild(mk('p', null, 'Dias removidos saem do programa; as cargas já registradas continuam no backup.'));

    const r2 = mk('div', 'r');
    const ok = button('btn pri', editingExisting ? 'Salvar' : 'Criar e usar'), cancel = button('btn', 'Cancelar');
    cancel.addEventListener('click', () => { form = null; draw(); });
    ok.addEventListener('click', save);
    r2.append(ok, cancel);
    panel.appendChild(r2);
  }

  function save() {
    const name = String(form.name || '').trim(), days = form.days.map((d) => Object.assign({}, d, { name: String(d.name || '').trim() }));
    const weeks = Math.max(1, Math.min(52, Math.round(Number(form.weeks)) || 0));
    if (!name) return app.status('Dê um nome ao programa');
    if (!weeks) return app.status('Informe as semanas (1 a 52)');
    if (days.some((d) => !d.name)) return app.status('Todo dia precisa de um nome');
    const p = app.programs();
    p.list = p.list || {};
    if (form.id) {
      const pg = p.list[form.id], old = {};
      pg.days.forEach((d) => { old[d.id] = d; });
      pg.name = name; pg.weeks = weeks;
      pg.days = days.map((d) => (d.id && old[d.id] ? Object.assign(old[d.id], { name: d.name }) : { id: CG.newId('d'), name: d.name, ex: [] }));
      form = null;
      app.setPrograms(p, false, p.active === pg.id);
      app.status('Programa salvo');
      draw();
      return;
    }
    const b = app.bts(), w = Math.min(app.view().week, b.weeks);
    const tpl = form.fromJeff ? days.map((d) => (d.jeff ? CG.baseList(b.P, w, d.jeff) : [])) : null;
    const pg = CG.makeProgram(name, weeks, days.map((d) => d.name), tpl);
    p.list[pg.id] = pg; p.active = pg.id;
    form = null;
    panel.hidden = true;
    const empty = !pg.days[0].ex.length;
    app.setPrograms(p, empty);
    app.status(empty ? 'Programa criado. Adicione os exercícios de ' + pg.days[0].name : 'Programa criado');
  }

  function draw() {
    panel.textContent = '';
    if (form) drawForm(); else drawList();
  }

  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; form = null; if (!panel.hidden) draw(); });
})();
