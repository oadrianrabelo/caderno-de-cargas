// Acompanhamento do treino (resumo, calendário, grade do programa, evolução por exercício)
// e imagens para compartilhar. Só DOM, SVG e canvas: nenhuma biblioteca.
(function () {
  const app = window.CGApp, tools = document.querySelector('.tools');
  if (!app || !tools || !window.CG) return;

  const css = document.createElement('style');
  css.textContent = '.pg{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);display:flex;flex-direction:column;gap:14px;font-size:14px}' +
    '.pg h3{margin:0;font:700 15px/1.2 var(--f-display);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}' +
    '.pg .kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pg .kpi{background:var(--field);border-radius:8px;padding:10px}' +
    '.pg .kpi b{display:block;font:700 26px/1 var(--f-display);font-variant-numeric:tabular-nums}.pg .kpi span{color:var(--mute);font-size:13px}' +
    '.pg .alert{color:var(--danger);font-weight:600}.pg .ok{color:var(--done);font-weight:600}' +
    '.pg .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}.pg .cal i{font-style:normal;color:var(--mute);font-size:11px}' +
    '.pg .cal span{aspect-ratio:1;display:grid;place-items:center;border-radius:6px;background:var(--field);color:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}' +
    '.pg .cal span.done{background:var(--done);color:#fff;font-weight:700}.pg .cal span.skip{background:transparent;border:1px dashed var(--mute);text-decoration:line-through}' +
    '.pg .cal span.today{outline:2px solid var(--accent)}.pg .cal span.out{opacity:.35}' +
    '.pg .grid{display:grid;gap:3px;font-size:11px;align-items:center}.pg .grid button{height:26px;border:0;border-radius:4px;background:var(--field);padding:0;cursor:pointer}' +
    '.pg .grid button.done{background:var(--done)}.pg .grid button.skip{background:transparent;border:1px dashed var(--mute)}.pg .grid button.cur{outline:2px solid var(--accent)}' +
    '.pg .grid .h{color:var(--mute);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pg .legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--mute);font-size:12px}.pg .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}' +
    '.pg .exl{display:flex;flex-direction:column;gap:8px}.pg .exr{display:grid;grid-template-columns:1fr 84px;gap:8px;align-items:center;border-top:1px solid var(--line);padding-top:8px}' +
    '.pg .exr b{display:block;font-weight:600;overflow-wrap:anywhere}.pg .exr small{color:var(--mute);font-variant-numeric:tabular-nums}.pg .exr svg{width:84px;height:30px}' +
    '.pg .r{display:flex;flex-wrap:wrap;gap:8px}.pg svg.vol{width:100%;height:auto;display:block}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const button = (cls, txt) => { const b = mk('button', cls, txt); b.type = 'button'; return b; };
  const DAY_MS = 86400000;
  const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  // Formatadores criados uma vez (o calendário formata dezenas de datas a cada abertura).
  const F_SHORT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  const F_WD = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
  const F_FULL = new Intl.DateTimeFormat('pt-BR');
  const shortDate = (t) => F_SHORT.format(new Date(t));
  const weekday = (t) => F_WD.format(new Date(t)).replace('.', '');
  const daysAgo = (t) => Math.round((new Date(CG.isoDay(Date.now())) - new Date(CG.isoDay(t))) / DAY_MS);

  const btn = button('btn', 'Progresso'); btn.id = 'bprog';
  tools.insertBefore(btn, tools.querySelector('#bexp'));
  const panel = mk('div', 'pg'); panel.id = 'progress'; panel.hidden = true;
  tools.insertAdjacentElement('afterend', panel);
  let allEx = false;

  function sparkline(points) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 84 30'); svg.setAttribute('aria-hidden', 'true');
    const v = points.map((p) => p.kg || p.reps), min = Math.min(...v), max = Math.max(...v);
    const xy = v.map((y, i) => [v.length === 1 ? 42 : 3 + (i * 78) / (v.length - 1), max === min ? 15 : 26 - ((y - min) * 22) / (max - min)]);
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', xy.map((p) => p.join(',')).join(' '));
    line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'var(--accent)'); line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linejoin', 'round');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', xy[xy.length - 1][0]); dot.setAttribute('cy', xy[xy.length - 1][1]); dot.setAttribute('r', '3'); dot.setAttribute('fill', 'var(--accent)');
    svg.append(line, dot);
    return svg;
  }

  function draw() {
    panel.textContent = '';
    const v = app.view(), sum = CG.summarize(v.logs, v.ORDER, v.WEEKS);

    panel.appendChild(mk('h3', null, 'Resumo · ' + v.program));
    const kpis = mk('div', 'kpis');
    [[sum.done + ' / ' + sum.total, 'treinos feitos'], [String(sum.skipped), sum.skipped === 1 ? 'treino pulado' : 'treinos pulados'],
      [String(sum.streak), 'seguidos sem pular'], [Math.round((sum.done / sum.total) * 100) + '%', 'do programa']].forEach(([b, t]) => {
      const k = mk('div', 'kpi'); k.append(mk('b', null, b), mk('span', null, t)); kpis.appendChild(k);
    });
    panel.appendChild(kpis);
    if (sum.last) {
      const n = daysAgo(sum.last.t);
      const when = n === 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias';
      const p = mk('p', n >= 3 ? 'alert' : 'ok', 'Último treino: ' + when + ' (' + weekday(sum.last.t) + ', ' + shortDate(sum.last.t) + ') · ' + v.NAMES[sum.last.day] + ', semana ' + sum.last.week);
      if (n >= 3) p.textContent += '. Faz ' + n + ' dias sem treinar.';
      panel.appendChild(p);
    } else panel.appendChild(mk('p', null, 'Nenhum treino feito ainda neste programa.'));

    // Esta semana (segunda a domingo).
    const wk = CG.weekSummary(v.logs, Date.now());
    panel.appendChild(mk('h3', null, 'Esta semana · desde ' + shortDate(wk.start)));
    const wks = mk('div', 'kpis'); wks.id = 'weekkpis';
    [[String(wk.sessions), wk.sessions === 1 ? 'treino' : 'treinos'], [wk.volume.toLocaleString('pt-BR') + ' kg', 'volume (' + wk.sets + ' séries)'],
      [String(wk.records), wk.records === 1 ? 'recorde' : 'recordes'], [wk.energy ? String(wk.energy).replace('.', ',') + ' / 5' : '—', 'energia média']].forEach(([b, t]) => {
      const k = mk('div', 'kpi'); k.append(mk('b', null, b), mk('span', null, t)); wks.appendChild(k);
    });
    panel.appendChild(wks);

    // Volume por semana do programa (barras), com a semana atual destacada.
    const vols = CG.volumeByWeek(v.logs, v.ORDER, v.WEEKS), vmax = Math.max(1, ...vols);
    panel.appendChild(mk('h3', null, 'Volume por semana'));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + (v.WEEKS * 24) + ' 110'); svg.setAttribute('class', 'vol'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Volume por semana: ' + vols.map((x, i) => 'S' + (i + 1) + ' ' + x + ' kg').join(', '));
    vols.forEach((x, i) => {
      const h = x ? Math.max(3, (x / vmax) * 80) : 2, r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', i * 24 + 4); r.setAttribute('y', 88 - h); r.setAttribute('width', 16); r.setAttribute('height', h); r.setAttribute('rx', 3);
      r.setAttribute('fill', i + 1 === v.week ? 'var(--day, var(--accent))' : x ? 'var(--done)' : 'var(--line)');
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', i * 24 + 12); t.setAttribute('y', 104); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', 'var(--mute)');
      t.textContent = 'S' + (i + 1);
      const tt = document.createElementNS(ns, 'title'); tt.textContent = 'Semana ' + (i + 1) + ': ' + x.toLocaleString('pt-BR') + ' kg';
      r.appendChild(tt);
      svg.append(r, t);
    });
    panel.appendChild(svg);
    const best = vols.indexOf(Math.max(...vols));
    if (vols[best]) panel.appendChild(mk('p', null, 'Maior volume: semana ' + (best + 1) + ' (' + vols[best].toLocaleString('pt-BR') + ' kg). Semana ' + v.week + ': ' + vols[v.week - 1].toLocaleString('pt-BR') + ' kg.'));

    // Calendário das últimas 5 semanas (segunda a domingo).
    panel.appendChild(mk('h3', null, 'Calendário'));
    const cal = mk('div', 'cal'), marks = CG.calendar(v.logs), today = new Date();
    ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].forEach((d) => cal.appendChild(mk('i', null, d)));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 28);
    for (let i = 0; i < 35; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), iso = CG.isoDay(d.getTime());
      const c = mk('span', (marks[iso] || '') + (iso === CG.isoDay(today.getTime()) ? ' today' : '') + (d > today ? ' out' : ''), String(d.getDate()));
      c.title = F_FULL.format(d) + (marks[iso] === 'done' ? ': treinou' : marks[iso] === 'skip' ? ': pulou' : '');
      cal.appendChild(c);
    }
    panel.appendChild(cal);
    const lg = mk('div', 'legend');
    lg.innerHTML = '<span><i style="background:var(--done)"></i>treinou</span><span><i style="border:1px dashed var(--mute)"></i>pulou</span><span><i style="background:var(--field)"></i>sem registro</span>';
    panel.appendChild(lg);

    // Grade do programa: semanas × dias. Tocar abre o treino.
    panel.appendChild(mk('h3', null, 'Programa'));
    const grid = mk('div', 'grid');
    grid.style.gridTemplateColumns = '28px repeat(' + v.ORDER.length + ', minmax(0, 1fr))';
    grid.appendChild(mk('span'));
    v.ORDER.forEach((d) => grid.appendChild(mk('span', 'h', v.NAMES[d])));
    for (let w = 1; w <= v.WEEKS; w++) {
      grid.appendChild(mk('span', 'h', 'S' + w));
      v.ORDER.forEach((d) => {
        const st = CG.dayStatus(v.logs[w + '-' + d]);
        const b = button(st + (w === v.week && d === v.day ? ' cur' : ''));
        b.setAttribute('aria-label', 'Semana ' + w + ', ' + v.NAMES[d] + (st === 'done' ? ', feito' : st === 'skip' ? ', pulado' : ''));
        b.addEventListener('click', () => { panel.hidden = true; app.go(w, d); });
        grid.appendChild(b);
      });
    }
    panel.appendChild(grid);

    // Evolução por exercício: melhor série de cada treino.
    const prog = CG.exerciseProgress(v.logs);
    panel.appendChild(mk('h3', null, 'Evolução por exercício'));
    if (!prog.length) panel.appendChild(mk('p', null, 'Registre cargas para ver a evolução aqui.'));
    const exl = mk('div', 'exl');
    (allEx ? prog : prog.slice(0, 8)).forEach((e) => {
      const r = mk('div', 'exr'), a = e.points[0], z = e.points[e.points.length - 1], txt = mk('div');
      txt.appendChild(mk('b', null, e.name));
      const diff = z.kg - a.kg;
      txt.appendChild(mk('small', null, e.points.length === 1 ? fmtKg(z.kg) + ' kg × ' + z.reps + ' · 1 treino'
        : fmtKg(a.kg) + ' → ' + fmtKg(z.kg) + ' kg' + (diff ? ' (' + (diff > 0 ? '+' : '') + fmtKg(diff) + ')' : '') + ' · ' + z.reps + ' reps · ' + e.points.length + ' treinos'));
      r.append(txt, sparkline(e.points));
      exl.appendChild(r);
    });
    panel.appendChild(exl);
    if (prog.length > 8) {
      const more = button('btn', allEx ? 'Mostrar menos' : 'Ver todos (' + prog.length + ')');
      more.addEventListener('click', () => { allEx = !allEx; draw(); });
      panel.appendChild(more);
    }

    panel.appendChild(mk('h3', null, 'Compartilhar'));
    const r = mk('div', 'r');
    const b1 = button('btn pri', 'Imagem do treino (' + v.NAMES[v.day] + ' · S' + v.week + ')'), b2 = button('btn', 'Imagem do progresso'), b3 = button('btn', 'Imagem da semana');
    b1.addEventListener('click', () => fontsReady().then(() => share(workoutCard(v), 'treino-' + CG.isoDay(Date.now()) + '.png')));
    b2.addEventListener('click', () => fontsReady().then(() => share(progressCard(v, sum, prog), 'progresso-' + CG.isoDay(Date.now()) + '.png')));
    b3.addEventListener('click', () => fontsReady().then(() => share(weekCard(v, wk), 'semana-' + CG.isoDay(wk.start) + '.png')));
    r.append(b1, b2, b3);
    panel.appendChild(r);
  }

  // ---------- Imagens (canvas) ----------
  // Seguem a Aparência escolhida: cores do tema (claro ou escuro), cor do dia e as fontes de títulos, números e texto.
  const W = 1080, PAD = 72;
  // WebViews antigos não têm roundRect: usa retângulo comum.
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  }
  function theme() {
    const cs = getComputedStyle(document.documentElement), g = (n, f) => cs.getPropertyValue(n).trim() || f;
    const t = document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const accent = g('--accent', '#8f6328');
    return {
      dark, bg: g('--bg', '#f2efe9'), card: g('--card', '#fffdf9'), card2: g('--card2', '#f7f4ee'), ink: g('--ink', '#18191c'),
      mute: g('--mute', '#6b6d73'), faint: g('--faint', '#a3a39f'), line: g('--line2', 'rgba(0,0,0,.14)'), accent,
      done: g('--done', '#2e7a55'), doneBg: g('--done-bg', 'rgba(46,122,85,.14)'), day: g('--day', accent),
      fd: g('--f-display', 'system-ui, sans-serif'), fn: g('--f-num', 'system-ui, sans-serif'), fb: g('--f-body', 'system-ui, sans-serif')
    };
  }
  // Garante as fontes carregadas antes de desenhar (canvas não espera a fonte chegar).
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const th = theme(), sample = 'Aa0123456789×→kg';
    const want = [[700, th.fd], [600, th.fd], [700, th.fn], [600, th.fn], [500, th.fb], [600, th.fb]];
    return Promise.all(want.map(([w, f]) => document.fonts.load(w + ' 40px ' + f, sample).catch(() => null))).then(() => null, () => null);
  }
  const alpha = (c, a) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (!m) return c;
    let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return 'rgba(' + [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
  };
  const spacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function ellipsis(ctx, text, maxW) {
    let t = String(text);
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t.trim() + '…';
  }
  // Tamanho de fonte que cabe na largura.
  function fit(ctx, text, weight, size, min, family, maxW) {
    do { ctx.font = weight + ' ' + size + 'px ' + family; size -= 2; } while (ctx.measureText(text).width > maxW && size > min);
  }
  function box(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  // Desenha em duas passadas: a primeira só mede a altura, a segunda pinta.
  function render(paint) {
    const th = theme();
    const probe = document.createElement('canvas').getContext('2d');
    const h = paint(probe, false, th);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Math.ceil(h);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, cv.height);
    // Brilho suave da cor do dia no topo.
    const g = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 0.9);
    g.addColorStop(0, alpha(th.day, th.dark ? 0.22 : 0.16)); g.addColorStop(1, alpha(th.day, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.min(cv.height, 900));
    ctx.textBaseline = 'alphabetic';
    paint(ctx, true, th);
    return cv;
  }

  function header(ctx, on, th, kicker, title, sub) {
    const y = 96;
    if (on) {
      ctx.font = '600 24px ' + th.fb; spacing(ctx, 5); ctx.fillStyle = th.mute; ctx.fillText('CADERNO DE CARGAS', PAD, y);
      const bw = ctx.measureText('CADERNO DE CARGAS').width;
      spacing(ctx, 0); ctx.font = '500 26px ' + th.fb; ctx.fillStyle = th.faint; ctx.textAlign = 'right';
      ctx.fillText(ellipsis(ctx, kicker, W - PAD * 2 - bw - 40), W - PAD, y); ctx.textAlign = 'left';
      fit(ctx, title, 700, 136, 60, th.fd, W - PAD * 2); spacing(ctx, -2); ctx.fillStyle = th.ink; ctx.fillText(title, PAD, y + 160); spacing(ctx, 0);
      box(ctx, PAD + 2, y + 190, 112, 10, 5, th.day);
      ctx.font = '500 32px ' + th.fb; ctx.fillStyle = th.mute; ctx.fillText(sub, PAD, y + 256);
    }
    return y + 304;
  }

  // Blocos de números (como os do painel), em grade.
  function tiles(ctx, on, th, y, items, cols) {
    const gap = 18, tw = (W - PAD * 2 - gap * (cols - 1)) / cols, h = 172;
    items.forEach(([val, label, color], i) => {
      const x = PAD + (i % cols) * (tw + gap), ty = y + Math.floor(i / cols) * (h + gap);
      if (!on) return;
      box(ctx, x, ty, tw, h, 32, th.card, th.line);
      fit(ctx, val, 700, 68, 34, th.fn, tw - 56); spacing(ctx, -1); ctx.fillStyle = color || th.ink; ctx.fillText(val, x + 28, ty + 92); spacing(ctx, 0);
      ctx.font = '500 26px ' + th.fb; ctx.fillStyle = th.mute; ctx.fillText(ellipsis(ctx, label, tw - 56), x + 28, ty + 138);
    });
    return y + Math.ceil(items.length / cols) * (h + gap) - gap;
  }

  function section(ctx, on, th, y, text) {
    if (on) { ctx.font = '600 23px ' + th.fb; spacing(ctx, 4); ctx.fillStyle = th.mute; ctx.fillText(text.toUpperCase(), PAD, y + 24); spacing(ctx, 0); }
    return y + 50;
  }

  function footer(ctx, on, th, y, text) {
    y += 44;
    if (on) {
      ctx.fillStyle = th.line; ctx.fillRect(PAD, y, W - PAD * 2, 2);
      ctx.font = '500 27px ' + th.fb; ctx.fillStyle = th.mute; ctx.fillText(ellipsis(ctx, text, W - PAD * 2 - 330), PAD, y + 62);
      ctx.font = '700 30px ' + th.fd; spacing(ctx, -0.5); const b = 'Caderno de Cargas', bw = ctx.measureText(b).width;
      ctx.fillStyle = th.ink; ctx.fillText(b, W - PAD - bw, y + 62); spacing(ctx, 0);
      box(ctx, W - PAD - bw - 26, y + 42, 14, 14, 7, th.day);
    }
    return y + 116;
  }

  const kgText = (n) => Math.round(n).toLocaleString('pt-BR') + ' kg';

  function workoutCard(v) {
    return render((ctx, on, th) => {
      const doc = v.doc || { ex: {} }, t = CG.dayStatus(doc) ? CG.sessionTime(doc) : Date.now();
      const date = new Date(t).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      let y = header(ctx, on, th, v.program, v.NAMES[v.day], 'Semana ' + v.week + ' · ' + date);
      let total = 0, done = 0, vol = 0;
      v.list.forEach((ex) => {
        const e = doc.ex[ex.id]; total += ex.s;
        for (let s = 0; s < ex.s; s++) { const st = e && e.sets[s]; if (st && st.done) { done++; vol += (parseFloat(String(st.kg).replace(',', '.')) || 0) * (parseFloat(st.reps) || 0); } }
      });
      const min = CG.sessionDuration(doc);
      const k = [[done + '/' + total, 'séries feitas', done === total && total ? th.done : null], [vol ? kgText(vol) : '—', 'volume']];
      if (min) k.push([min + ' min', 'duração']);
      y = tiles(ctx, on, th, y, k, k.length) + 44;
      if (CG.dayStatus(doc) === 'skip') {
        if (on) { ctx.font = '600 40px ' + th.fd; ctx.fillStyle = th.mute; ctx.fillText('Treino pulado', PAD, y + 40); }
        y += 80;
      }
      y = section(ctx, on, th, y, 'Exercícios');
      // Um cartão com os exercícios em linhas, como na tela: mede primeiro, pinta o cartão e depois o conteúdo.
      const inner = PAD + 36, nameX = inner + 78, maxX = W - PAD - 36;
      const rows = (on, y) => {
        v.list.forEach((ex, i) => {
          const e = doc.ex[ex.id], name = (e && e.used) || ex.n;
          const det = CG.exDetails(ex, window.BTS_EXTRA, v.week, v.day), tech = det.tec && window.CGTips && CGTips.TECH[det.tec];
          const tcol = tech && tech.color ? tech.color[th.dark ? 1 : 0] : th.accent;
          if (i && on) { ctx.fillStyle = th.line; ctx.fillRect(inner, y - 26, maxX - inner, 2); }
          ctx.font = '650 38px ' + th.fd;
          const lines = wrap(ctx, name, maxX - nameX);
          if (on) {
            const full = e && Object.keys(e.sets || {}).length && [...Array(ex.s).keys()].every((s) => e.sets[s] && e.sets[s].done);
            box(ctx, inner, y - 4, 54, 54, 27, full ? th.done : th.card2, full ? null : th.line);
            ctx.font = '700 26px ' + th.fn; ctx.textAlign = 'center'; ctx.fillStyle = full ? th.card : th.mute; ctx.fillText(String(i + 1), inner + 27, y + 32); ctx.textAlign = 'left';
            ctx.font = '650 38px ' + th.fd; spacing(ctx, -0.5); ctx.fillStyle = th.ink;
            lines.forEach((l, j) => ctx.fillText(l, nameX, y + 34 + j * 48)); spacing(ctx, 0);
          }
          y += 34 + (lines.length - 1) * 48 + 26;
          const sets = [];
          for (let s = 0; s < ex.s; s++) { const st = e && e.sets[s]; if (st && (st.kg || st.reps)) sets.push([st, s === ex.s - 1]); }
          if (!sets.length) {
            ctx.font = '500 28px ' + th.fb;
            const info = [ex.s + ' séries · ' + ex.r + ' reps', tech ? 'última: ' + tech.short : ''].filter(Boolean).join(' · ');
            if (on) { ctx.fillStyle = th.mute; ctx.fillText(ellipsis(ctx, info, maxX - nameX), nameX, y + 20); }
            y += 40;
          } else {
            let x = nameX;
            ctx.font = '600 30px ' + th.fn;
            sets.forEach(([st, last]) => {
              const txt = (st.kg ? String(st.kg).replace('.', ',') : '—') + ' × ' + (st.reps || '—');
              const w = ctx.measureText(txt).width + 44;
              if (x + w > maxX) { x = nameX; y += 70; }
              if (on) {
                const lastTec = last && tech;
                box(ctx, x, y - 6, w, 56, 28, st.done ? th.doneBg : th.card2, lastTec ? tcol : null);
                ctx.font = '600 30px ' + th.fn; ctx.fillStyle = st.done ? th.done : th.mute; ctx.fillText(txt, x + 22, y + 32);
              }
              x += w + 12;
            });
            y += 62;
            if (tech && on) { ctx.font = '600 22px ' + th.fb; spacing(ctx, 2); ctx.fillStyle = tcol; ctx.fillText(('Última série · ' + tech.short).toUpperCase(), nameX, y + 18); spacing(ctx, 0); }
            if (tech) y += 34;
          }
          y += 50;
        });
        return y;
      };
      const top = y, bottom = rows(false, y + 36) - 14;
      if (on) box(ctx, PAD, top, W - PAD * 2, bottom - top, 40, th.card, th.line);
      rows(on, y + 36);
      y = bottom;
      // Anotação do treino, inteira (até 4 linhas), num bloco próprio.
      if (doc.note) {
        y += 36;
        ctx.font = '500 32px ' + th.fb;
        const nl = wrap(ctx, String(doc.note).replace(/\s+/g, ' ').trim(), W - PAD * 2 - 64).slice(0, 4);
        const nh = 44 + nl.length * 44 + 20;
        if (on) {
          box(ctx, PAD, y, W - PAD * 2, nh, 32, th.card2, null);
          box(ctx, PAD, y, 8, nh, 4, th.day);
          ctx.fillStyle = th.ink; ctx.font = '500 32px ' + th.fb;
          nl.forEach((l, j) => ctx.fillText((j === 0 ? '“' : '') + l + (j === nl.length - 1 ? '”' : ''), PAD + 40, y + 62 + j * 44));
        }
        y += nh;
      }
      const note = doc.energy ? 'Energia ' + doc.energy + ' / 5' : 'Mais um treino no caderno.';
      return footer(ctx, on, th, y, note);
    });
  }

  function weekCard(v, wk) {
    return render((ctx, on, th) => {
      const end = new Date(wk.start + 6 * 86400000);
      let y = header(ctx, on, th, v.program, 'Minha semana', shortDate(wk.start) + ' a ' + shortDate(end));
      y = tiles(ctx, on, th, y, [[String(wk.sessions), wk.sessions === 1 ? 'treino' : 'treinos'], [String(wk.sets), 'séries'],
        [wk.volume ? kgText(wk.volume) : '—', 'volume'], [String(wk.records), wk.records === 1 ? 'recorde' : 'recordes', wk.records ? th.accent : null]], 2) + 44;
      y = section(ctx, on, th, y, 'Dias');
      const marks = CG.calendar(v.logs), names = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'], h = 210;
      if (on) box(ctx, PAD, y, W - PAD * 2, h, 40, th.card, th.line);
      const cw = (W - PAD * 2 - 48) / 7;
      names.forEach((n, i) => {
        const iso = CG.isoDay(wk.start + i * 86400000 + 12 * 3600000), cx = PAD + 24 + cw * i + cw / 2, st = marks[iso];
        if (!on) return;
        ctx.beginPath(); ctx.arc(cx, y + 86, 40, 0, Math.PI * 2);
        if (st === 'done') { ctx.fillStyle = th.done; ctx.fill(); ctx.strokeStyle = th.card; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 14, y + 87); ctx.lineTo(cx - 3, y + 98); ctx.lineTo(cx + 16, y + 76); ctx.stroke(); }
        else if (st === 'skip') { ctx.setLineDash([7, 6]); ctx.strokeStyle = th.faint; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = th.card2; ctx.fill(); ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.font = '500 25px ' + th.fb; ctx.fillStyle = st === 'done' ? th.ink : th.mute; ctx.textAlign = 'center'; ctx.fillText(n, cx, y + 170); ctx.textAlign = 'left';
      });
      y += h;
      return footer(ctx, on, th, y, wk.energy ? 'Energia média ' + String(wk.energy).replace('.', ',') + ' / 5' : 'Bora pra próxima!');
    });
  }

  // Minigráfico de linha (evolução da carga).
  function spark(ctx, th, pts, x, y, w, h) {
    const vs = pts.map((p) => p.kg), lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo || 1;
    const px = (i) => x + (pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w), py = (kv) => y + h - ((kv - lo) / r) * h;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.kg)) : ctx.moveTo(px(i), py(p.kg))));
    ctx.strokeStyle = th.day; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(px(pts.length - 1), py(vs[vs.length - 1]), 7, 0, Math.PI * 2); ctx.fillStyle = th.day; ctx.fill();
  }

  function progressCard(v, sum, prog) {
    return render((ctx, on, th) => {
      let y = header(ctx, on, th, v.program, 'Progresso', new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }));
      y = tiles(ctx, on, th, y, [[sum.done + '/' + sum.total, 'treinos feitos'], [Math.round((sum.done / sum.total) * 100) + '%', 'do programa', th.accent],
        [String(sum.streak), 'seguidos sem pular'], [String(sum.skipped), 'pulados']], 2) + 44;
      // Grade semanas × dias.
      y = section(ctx, on, th, y, 'Programa');
      const cols = v.ORDER.length, lw = 74, gap = 8, inner = PAD + 32, cw = (W - PAD * 2 - 64 - lw - gap * (cols - 1)) / cols, ch = Math.max(16, Math.min(34, 520 / v.WEEKS));
      const gh = 32 + 44 + v.WEEKS * (ch + gap) - gap + 32;
      if (on) box(ctx, PAD, y, W - PAD * 2, gh, 40, th.card, th.line);
      let gy = y + 32;
      ctx.font = '500 24px ' + th.fb;
      if (on) v.ORDER.forEach((d, i) => { ctx.fillStyle = th.mute; ctx.textAlign = 'center'; ctx.fillText(ellipsis(ctx, v.NAMES[d], cw), inner + lw + i * (cw + gap) + cw / 2, gy + 22); ctx.textAlign = 'left'; });
      gy += 44;
      for (let w = 1; w <= v.WEEKS; w++) {
        if (on) {
          ctx.fillStyle = th.faint; ctx.font = '600 ' + Math.min(22, ch - 2) + 'px ' + th.fn; ctx.fillText('S' + w, inner, gy + ch - 5);
          v.ORDER.forEach((d, i) => {
            const st = CG.dayStatus(v.logs[w + '-' + d]), x = inner + lw + i * (cw + gap);
            ctx.beginPath(); ctx.roundRect(x, gy, cw, ch, Math.min(10, ch / 2));
            if (st === 'done') { ctx.fillStyle = th.done; ctx.fill(); }
            else if (st === 'skip') { ctx.setLineDash([6, 5]); ctx.strokeStyle = th.faint; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
            else { ctx.fillStyle = th.card2; ctx.fill(); }
          });
        }
        gy += ch + gap;
      }
      y += gh + 44;
      // Destaques de evolução, com minigráfico.
      const top = prog.filter((e) => e.points.length > 1).slice(0, 6);
      if (top.length) {
        y = section(ctx, on, th, y, 'Evolução');
        const rh = 104, eh = top.length * rh + 24;
        if (on) box(ctx, PAD, y, W - PAD * 2, eh, 40, th.card, th.line);
        let ey = y + 12;
        top.forEach((e, i) => {
          const a = e.points[0], z = e.points[e.points.length - 1], d = z.kg - a.kg;
          if (on) {
            if (i) { ctx.fillStyle = th.line; ctx.fillRect(PAD + 32, ey, W - PAD * 2 - 64, 2); }
            ctx.font = '700 32px ' + th.fn; const val = fmtKg(z.kg) + ' kg', vw = ctx.measureText(val).width;
            ctx.fillStyle = th.ink; ctx.textAlign = 'right'; ctx.fillText(val, W - PAD - 32, ey + 50);
            ctx.font = '600 24px ' + th.fb; ctx.fillStyle = d > 0 ? th.done : th.mute;
            ctx.fillText(d ? (d > 0 ? '+' : '') + fmtKg(d) + ' kg desde ' + fmtKg(a.kg) : 'manteve ' + fmtKg(a.kg), W - PAD - 32, ey + 84); ctx.textAlign = 'left';
            spark(ctx, th, e.points.slice(-12), W - PAD - 32 - Math.max(vw, 230) - 150, ey + 26, 120, 50);
            ctx.font = '600 30px ' + th.fd; ctx.fillStyle = th.ink;
            ctx.fillText(ellipsis(ctx, e.name, W - PAD * 2 - 64 - Math.max(vw, 230) - 190), PAD + 32, ey + 50);
            ctx.font = '500 24px ' + th.fb; ctx.fillStyle = th.mute; ctx.fillText(e.points.length + ' treinos · ' + z.reps + ' reps', PAD + 32, ey + 84);
          }
          ey += rh;
        });
        y += eh;
      }
      const last = sum.last ? 'Último treino: ' + new Date(sum.last.t).toLocaleDateString('pt-BR') : 'Nenhum treino ainda';
      return footer(ctx, on, th, y, last);
    });
  }

  function share(canvas, name) {
    app.status('Gerando imagem…');
    if (window.CGNative && CGNative.shareImage) {
      CGNative.shareImage(name, canvas.toDataURL('image/png').split(',')[1]).then(app.status, () => app.status('Não consegui compartilhar a imagem'));
      return;
    }
    canvas.toBlob((blob) => {
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Caderno de Cargas' }).then(() => app.status('Imagem compartilhada'), () => app.status('Compartilhamento fechado'));
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      app.status('Imagem salva');
    }, 'image/png');
  }

  window.CGProgress = {
    shareWorkout: () => fontsReady().then(() => share(workoutCard(app.view()), 'treino-' + CG.isoDay(Date.now()) + '.png')),
    fontsReady,
    workoutCard: () => workoutCard(app.view()), progressCard: () => { const v = app.view(); return progressCard(v, CG.summarize(v.logs, v.ORDER, v.WEEKS), CG.exerciseProgress(v.logs)); },
    weekCard: () => { const v = app.view(); return weekCard(v, CG.weekSummary(v.logs, Date.now())); } };

  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) draw(); });
  app.saved.push(() => { if (!panel.hidden) draw(); });
})();
