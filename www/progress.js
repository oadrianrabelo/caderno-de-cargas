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
    '.pg .r{display:flex;flex-wrap:wrap;gap:8px}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const button = (cls, txt) => { const b = mk('button', cls, txt); b.type = 'button'; return b; };
  const DAY_MS = 86400000;
  const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const shortDate = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const weekday = (t) => new Date(t).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
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

    // Calendário das últimas 5 semanas (segunda a domingo).
    panel.appendChild(mk('h3', null, 'Calendário'));
    const cal = mk('div', 'cal'), marks = CG.calendar(v.logs), today = new Date();
    ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].forEach((d) => cal.appendChild(mk('i', null, d)));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 28);
    for (let i = 0; i < 35; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), iso = CG.isoDay(d.getTime());
      const c = mk('span', (marks[iso] || '') + (iso === CG.isoDay(today.getTime()) ? ' today' : '') + (d > today ? ' out' : ''), String(d.getDate()));
      c.title = d.toLocaleDateString('pt-BR') + (marks[iso] === 'done' ? ': treinou' : marks[iso] === 'skip' ? ': pulou' : '');
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
    const b1 = button('btn pri', 'Imagem do treino (' + v.NAMES[v.day] + ' · S' + v.week + ')'), b2 = button('btn', 'Imagem do progresso');
    b1.addEventListener('click', () => share(workoutCard(v), 'treino-' + CG.isoDay(Date.now()) + '.png'));
    b2.addEventListener('click', () => share(progressCard(v, sum, prog), 'progresso-' + CG.isoDay(Date.now()) + '.png'));
    r.append(b1, b2);
    panel.appendChild(r);
  }

  // ---------- Imagens (canvas) ----------
  const C = { bg: '#0e1217', card: '#171d24', ink: '#eaeef2', mute: '#96a1ad', line: '#2a323b', accent: '#1f4fd8', accent2: '#7b9cff', done: '#5fd593' };
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', COND = '"Roboto Condensed", "Arial Narrow", sans-serif-condensed, ' + FONT;
  const W = 1080, PAD = 64;
  // WebViews antigos não têm roundRect: usa retângulo comum.
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  }

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

  // Desenha em duas passadas: a primeira só mede a altura, a segunda pinta.
  function render(paint) {
    const probe = document.createElement('canvas').getContext('2d');
    const h = paint(probe, false);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Math.ceil(h);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, cv.height);
    paint(ctx, true);
    return cv;
  }

  function header(ctx, on, kicker, title, sub) {
    if (on) {
      ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 260);
      // Nomes longos (programa ou dia) encolhem até caber na largura.
      const fit = (t, weight, size, min) => { do { ctx.font = weight + ' ' + size + 'px ' + COND; size -= 2; } while (ctx.measureText(t).width > W - PAD * 2 && size > min); };
      ctx.fillStyle = 'rgba(255,255,255,.75)'; fit(kicker.toUpperCase(), 700, 30, 18); ctx.fillText(kicker.toUpperCase(), PAD, 82);
      ctx.fillStyle = '#fff'; fit(title.toUpperCase(), 700, 84, 40); ctx.fillText(title.toUpperCase(), PAD, 170);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '500 30px ' + FONT; ctx.fillText(sub, PAD, 222);
    }
    return 260;
  }

  function footer(ctx, on, y, text) {
    if (on) {
      ctx.fillStyle = C.line; ctx.fillRect(PAD, y, W - PAD * 2, 2);
      ctx.fillStyle = C.mute; ctx.font = '500 28px ' + FONT; ctx.fillText(text, PAD, y + 56);
      ctx.fillStyle = C.accent2; ctx.font = '700 28px ' + COND; const b = 'CADERNO DE CARGAS';
      ctx.fillText(b, W - PAD - ctx.measureText(b).width, y + 56);
    }
    return y + 96;
  }

  function workoutCard(v) {
    return render((ctx, on) => {
      const doc = v.doc || { ex: {} }, date = doc.t ? new Date(doc.t) : new Date();
      let y = header(ctx, on, v.program, v.NAMES[v.day], 'Semana ' + v.week + ' · ' + date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }));
      y += 56;
      let total = 0, done = 0, vol = 0;
      if (CG.dayStatus(doc) === 'skip') {
        ctx.font = '600 40px ' + FONT;
        if (on) { ctx.fillStyle = C.mute; ctx.fillText('Treino pulado', PAD, y + 20); }
        y += 80;
      }
      v.list.forEach((ex, i) => {
        const e = doc.ex[ex.id], name = (e && e.used) || ex.n;
        total += ex.s;
        ctx.font = '700 40px ' + FONT;
        const lines = wrap(ctx, name, W - PAD * 2 - 72);
        if (on) {
          ctx.fillStyle = C.card; ctx.beginPath(); ctx.arc(PAD + 24, y + 10, 26, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.mute; ctx.font = '700 28px ' + COND; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), PAD + 24, y + 20); ctx.textAlign = 'left';
          ctx.fillStyle = C.ink; ctx.font = '700 40px ' + FONT;
          lines.forEach((l, j) => ctx.fillText(l, PAD + 72, y + 24 + j * 50));
        }
        y += 24 + (lines.length - 1) * 50 + 22;
        const sets = [];
        for (let s = 0; s < ex.s; s++) {
          const st = e && e.sets[s];
          if (st && st.done) { done++; vol += (parseFloat(String(st.kg).replace(',', '.')) || 0) * (parseFloat(st.reps) || 0); }
          if (st && (st.kg || st.reps)) sets.push(st);
        }
        ctx.font = '500 34px ' + FONT;
        let x = PAD + 72;
        if (!sets.length) {
          const det = CG.exDetails(ex, window.BTS_EXTRA, v.week, v.day), tech = det.tec && window.CGTips && CGTips.TECH[det.tec];
          const info = [ex.s + ' séries · ' + ex.r + ' reps', det.rpeUlt ? 'RPE ' + det.rpeUlt : '', tech ? tech.short : ''].filter(Boolean).join(' · ');
          if (on) { ctx.fillStyle = C.mute; ctx.fillText(info, x, y + 30); }
          y += 52;
        } else {
          y += 4;
          sets.forEach((st) => {
            const t = (st.kg ? String(st.kg).replace('.', ',') + ' kg' : '—') + ' × ' + (st.reps || '—') + (st.done ? '  ✓' : '');
            const w = ctx.measureText(t).width + 36;
            if (x + w > W - PAD) { x = PAD + 72; y += 66; }
            if (on) {
              ctx.fillStyle = st.done ? 'rgba(95,213,147,.14)' : C.card;
              ctx.beginPath(); ctx.roundRect(x, y, w, 54, 12); ctx.fill();
              ctx.fillStyle = st.done ? C.done : C.mute; ctx.fillText(t, x + 18, y + 38);
            }
            x += w + 12;
          });
          y += 66;
        }
        y += 26;
      });
      y += 10;
      return footer(ctx, on, y, done + ' de ' + total + ' séries' + (vol ? ' · ' + Math.round(vol).toLocaleString('pt-BR') + ' kg de volume' : ''));
    });
  }

  function progressCard(v, sum, prog) {
    return render((ctx, on) => {
      let y = header(ctx, on, v.program, 'Progresso', new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }));
      y += 48;
      // Números grandes.
      const k = [[sum.done + '/' + sum.total, 'treinos'], [String(sum.skipped), 'pulados'], [String(sum.streak), 'seguidos'], [Math.round((sum.done / sum.total) * 100) + '%', 'concluído']];
      const kw = (W - PAD * 2 - 3 * 20) / 4;
      if (on) k.forEach(([b, t], i) => {
        const x = PAD + i * (kw + 20);
        ctx.fillStyle = C.card; ctx.beginPath(); ctx.roundRect(x, y, kw, 150, 18); ctx.fill();
        ctx.fillStyle = C.ink; ctx.font = '700 60px ' + COND; ctx.fillText(b, x + 24, y + 82);
        ctx.fillStyle = C.mute; ctx.font = '500 28px ' + FONT; ctx.fillText(t, x + 24, y + 124);
      });
      y += 190;
      // Grade semanas × dias.
      const cols = v.ORDER.length, lw = 70, gap = 8, cw = Math.min(220, (W - PAD * 2 - lw - gap * (cols - 1)) / cols), ch = Math.max(18, Math.min(34, 520 / v.WEEKS));
      ctx.font = '600 24px ' + FONT;
      if (on) v.ORDER.forEach((d, i) => {
        ctx.fillStyle = C.mute;
        const t = wrap(ctx, v.NAMES[d], cw)[0];
        ctx.fillText(t.length < v.NAMES[d].length ? t.slice(0, -1) + '…' : t, PAD + lw + i * (cw + gap), y + 20);
      });
      y += 40;
      for (let w = 1; w <= v.WEEKS; w++) {
        if (on) {
          ctx.fillStyle = C.mute; ctx.font = '600 ' + Math.min(24, ch - 4) + 'px ' + FONT; ctx.fillText('S' + w, PAD, y + ch - 6);
          v.ORDER.forEach((d, i) => {
            const st = CG.dayStatus(v.logs[w + '-' + d]), x = PAD + lw + i * (cw + gap);
            ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 6);
            if (st === 'done') { ctx.fillStyle = C.done; ctx.fill(); }
            else if (st === 'skip') { ctx.setLineDash([6, 5]); ctx.strokeStyle = C.mute; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
            else { ctx.fillStyle = C.card; ctx.fill(); }
          });
        }
        y += ch + gap;
      }
      y += 40;
      // Destaques de evolução.
      const top = prog.filter((e) => e.points.length > 1).slice(0, 6);
      if (top.length) {
        if (on) { ctx.fillStyle = C.mute; ctx.font = '700 30px ' + COND; ctx.fillText('EVOLUÇÃO', PAD, y + 24); }
        y += 60;
        top.forEach((e) => {
          const a = e.points[0], z = e.points[e.points.length - 1], d = z.kg - a.kg;
          const right = fmtKg(a.kg) + ' → ' + fmtKg(z.kg) + ' kg' + (d ? ' (' + (d > 0 ? '+' : '') + fmtKg(d) + ')' : '');
          ctx.font = '600 32px ' + FONT;
          const rw = ctx.measureText(right).width;
          ctx.font = '500 32px ' + FONT;
          let name = e.name;
          while (ctx.measureText(name).width > W - PAD * 2 - rw - 30 && name.length > 4) name = name.slice(0, -2);
          if (name !== e.name) name = name.slice(0, -1) + '…';
          if (on) {
            ctx.fillStyle = C.ink; ctx.fillText(name, PAD, y + 30);
            ctx.font = '600 32px ' + FONT; ctx.fillStyle = d > 0 ? C.done : C.mute; ctx.fillText(right, W - PAD - rw, y + 30);
          }
          y += 54;
        });
        y += 20;
      }
      const last = sum.last ? 'Último treino: ' + new Date(sum.last.t).toLocaleDateString('pt-BR') : 'Nenhum treino ainda';
      return footer(ctx, on, y, last);
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

  window.CGProgress = { workoutCard: () => workoutCard(app.view()), progressCard: () => { const v = app.view(); return progressCard(v, CG.summarize(v.logs, v.ORDER, v.WEEKS), CG.exerciseProgress(v.logs)); } };

  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) draw(); });
  app.saved.push(() => { if (!panel.hidden) draw(); });
})();
