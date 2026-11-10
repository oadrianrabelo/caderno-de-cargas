// Histórico de um exercício: todas as sessões com data, cargas e a evolução do 1RM estimado.
(function () {
  const app = window.CGApp, list = document.getElementById('list');
  if (!app || !list || !window.CG) return;

  const css = document.createElement('style');
  css.textContent = '.hbtn{flex:none;width:36px;height:36px;border:1px solid var(--line);background:var(--field);border-radius:8px;cursor:pointer;font-size:17px;line-height:1;padding:0}' +
    '.hist .hk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 12px}' +
    '.hist .hk div{background:var(--field);border-radius:8px;padding:8px}.hist .hk b{display:block;font:700 20px/1.1 var(--f-display);font-variant-numeric:tabular-nums}' +
    '.hist .hk span{color:var(--mute);font-size:12px}.hist svg{width:100%;height:90px;display:block;margin-bottom:10px}' +
    '.hist ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}' +
    '.hist li{border-top:1px solid var(--line);padding-top:8px}.hist li small{color:var(--mute)}' +
    '.hist .ss{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.hist .ss span{background:var(--field);border-radius:6px;padding:3px 7px;font-size:13px;font-variant-numeric:tabular-nums}' +
    '.hist .ss span.ok{background:var(--done-bg);color:var(--done);font-weight:600}.hist .ss span.w{background:transparent;border:1px dashed var(--line);color:var(--mute)}.hist .ss i{font-style:normal;color:var(--mute);font-size:12px;align-self:center}.hist ol+p{margin-top:14px;font-size:12px}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const kg = (v) => (v === 0 || v ? String(v).replace('.', ',') : '—'); // 0 é valor (ex.: +0 kg), não "vazio"

  function chart(points) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 300 90'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const v = points.map((p) => p.best), min = Math.min(...v), max = Math.max(...v);
    const xy = v.map((y, i) => [v.length === 1 ? 150 : 8 + (i * 284) / (v.length - 1), max === min ? 45 : 80 - ((y - min) * 66) / (max - min)]);
    const area = document.createElementNS(ns, 'polygon');
    area.setAttribute('points', [[xy[0][0], 88]].concat(xy, [[xy[xy.length - 1][0], 88]]).map((p) => p.join(',')).join(' '));
    area.setAttribute('fill', 'var(--day, var(--accent))'); area.setAttribute('opacity', '.12');
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', xy.map((p) => p.join(',')).join(' '));
    line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'var(--day, var(--accent))'); line.setAttribute('stroke-width', '2.5');
    line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(area, line);
    xy.forEach((p) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '3'); c.setAttribute('fill', 'var(--day, var(--accent))'); svg.appendChild(c); });
    return svg;
  }

  function open(name) {
    const v = app.view(), h = CG.exerciseHistory(v.logs, name);
    let ov = document.getElementById('tipov');
    if (!ov) {
      ov = mk('div', 'tipov'); ov.id = 'tipov';
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; });
      document.body.appendChild(ov);
    }
    ov.textContent = '';
    const box = mk('div', 'tipbox hist'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.appendChild(mk('h2', null, name));
    if (!h.length) {
      box.appendChild(mk('p', null, 'Ainda não há cargas registradas para este exercício.'));
    } else {
      // 1RM e gráfico só com sessões que têm séries válidas (o aquecimento não entra).
      const hv = h.filter((x) => x.best), first = hv[hv.length - 1] || h[h.length - 1], last = hv[0] || h[0], best = Math.max(0, ...hv.map((x) => x.best));
      const k = mk('div', 'hk');
      [[String(h.length), h.length === 1 ? 'sessão' : 'sessões'], [kg(best) + ' kg', 'melhor 1RM est.'],
        [(last.best - first.best >= 0 ? '+' : '') + kg(Math.round((last.best - first.best) * 10) / 10) + ' kg', 'desde o início']].forEach(([b, t]) => {
        const d = mk('div'); d.append(mk('b', null, b), mk('span', null, t)); k.appendChild(d);
      });
      box.appendChild(k);
      if (hv.length > 1) box.appendChild(chart(hv.slice().reverse()));
      const ol = mk('ol');
      h.forEach((x) => {
        const li = mk('li');
        const dd = x.date ? new Date(x.date + 'T12:00:00') : x.t ? new Date(x.t) : null;
        li.appendChild(mk('small', null, (dd ? dd.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }) : 'sem data') +
          ' · semana ' + x.week + ' · ' + (v.NAMES[x.day] || x.day) + (x.best ? ' · 1RM est. ' + kg(x.best) + ' kg' : '')));
        const ss = mk('div', 'ss');
        if (x.warm && x.warm.length) {
          ss.appendChild(mk('i', null, 'aquec.'));
          x.warm.forEach((s) => ss.appendChild(mk('span', 'w', kg(s.kg) + ' × ' + (s.reps || '—'))));
          if (x.sets.length) ss.appendChild(mk('i', null, 'válidas'));
        }
        x.sets.forEach((s) => ss.appendChild(mk('span', s.done ? 'ok' : null, kg(s.kg) + ' × ' + (s.reps || '—'))));
        li.appendChild(ss);
        if (x.energy || x.note) li.appendChild(mk('small', null, (x.energy ? ['😫', '😕', '😐', '🙂', '💪'][x.energy - 1] + ' ' : '') + (x.note || '')));
        ol.appendChild(li);
      });
      box.appendChild(ol);
      box.appendChild(mk('p', null, '1RM estimado pela fórmula de Epley (carga × (1 + reps ÷ 30)). Serve para comparar a evolução, não é um teste de carga máxima.'));
    }
    const b = mk('button', 'btn pri', 'Fechar'); b.type = 'button'; b.addEventListener('click', () => { ov.hidden = true; });
    box.appendChild(b);
    ov.appendChild(box); ov.hidden = false;
    b.focus();
  }

  // Botão 📈 em cada exercício (a lista é refeita a cada render).
  function addButtons() {
    list.querySelectorAll('.ex .exh').forEach((h) => {
      if (h.querySelector('.hbtn')) return;
      const t = h.querySelector('h2');
      if (!t) return; // modo de edição
      const b = mk('button', 'hbtn', '📈'); b.type = 'button';
      b.setAttribute('aria-label', 'Histórico de ' + t.textContent);
      b.addEventListener('click', (e) => { e.stopPropagation(); open(t.textContent); });
      h.appendChild(b);
    });
  }
  new MutationObserver(addButtons).observe(list, { childList: true, subtree: true });
  addButtons();

  // No painel de Progresso, tocar num exercício também abre o histórico.
  document.addEventListener('click', (e) => {
    const r = e.target.closest('#progress .exr');
    if (r) open(r.querySelector('b').textContent);
  });

  window.CGHistory = { open };
})();
