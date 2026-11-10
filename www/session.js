// Sessão do dia: "Como foi?" (energia 1-5 e anotação), duração do treino e recordes pessoais.
(function () {
  // Formatador de data criado uma vez só (criar a cada redesenho custava tempo no celular).
  const DAYFMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const app = window.CGApp, list = document.getElementById('list');
  if (!app || !list || !window.CG) return;

  const ENERGY = [['😫', 'Péssimo'], ['😕', 'Fraco'], ['😐', 'Normal'], ['🙂', 'Bom'], ['💪', 'Ótimo']];
  const css = document.createElement('style');
  css.textContent = '.sess{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}' +
    '.sess h3{margin:0;font:700 15px/1.2 var(--f-display);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}' +
    '.sess .en{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}' +
    '.sess .en button{height:52px;border:1px solid var(--line);background:var(--field);border-radius:10px;font-size:24px;cursor:pointer;transition:transform .15s,border-color .15s}' +
    '.sess .en button[aria-pressed="true"]{border-color:var(--day,var(--accent));background:transparent;transform:scale(1.06)}' +
    '.sess textarea{width:100%;min-height:64px;resize:vertical;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:10px;font:500 15px/1.4 var(--f-body)}' +
    '.sess .du{color:var(--mute);font-size:14px}.sess .prevnote{background:var(--field);border-left:3px solid var(--day,var(--accent));border-radius:6px;padding:8px 10px;font-size:14px;color:var(--ink)}' +
    '.set.rec .sl::after{content:"🏅";display:block;font-size:14px;line-height:1;margin-top:2px}' +
    '.toast{position:fixed;left:50%;top:max(16px,env(safe-area-inset-top,0px));z-index:70;transform:translate(-50%,-140%);max-width:calc(100% - 32px);' +
    'background:#1d7f4e;color:#fff;border-radius:12px;padding:12px 16px;font:600 15px/1.3 var(--f-body);box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .35s cubic-bezier(.2,.8,.2,1)}' +
    '.toast.on{transform:translate(-50%,0)}@media (prefers-reduced-motion: reduce){.toast{transition:none}}';
  document.head.appendChild(css);

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const kg = (v) => String(v).replace('.', ',');

  function toast(text, tecKey) {
    let t = document.getElementById('toast');
    if (!t) { t = mk('div', 'toast'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'toast' + (tecKey ? ' tech tec-' + tecKey : '');
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('on'), 3500);
  }

  function durText(doc) {
    const m = CG.sessionDuration(doc);
    return m ? 'Duração: ' + (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min') + ' (da primeira à última série)' : '';
  }

  // Cartão no fim da lista (some no modo de edição).
  function card() {
    if (document.querySelector('#list .tip') && !list.querySelector('.ex')) return; // dia vazio
    // O cartão fica depois da lista (não dentro): procura pelo id para não duplicar.
    if (list.querySelector('.ed') || document.getElementById('sess')) return;
    if (!list.querySelector('.ex')) return;
    const doc = app.view().doc;
    const box = mk('section', 'sess'); box.id = 'sess';
    box.appendChild(mk('h3', null, 'Como foi o treino?'));
    const en = mk('div', 'en');
    ENERGY.forEach(([emo, name], i) => {
      const b = mk('button', null, emo); b.type = 'button'; b.title = name; b.setAttribute('aria-label', 'Energia ' + (i + 1) + ': ' + name);
      b.setAttribute('aria-pressed', String(!!doc && doc.energy === i + 1));
      b.addEventListener('click', () => {
        const d = app.doc(); d.energy = d.energy === i + 1 ? 0 : i + 1; app.touch(d);
        en.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(d.energy === j + 1)));
      });
      en.appendChild(b);
    });
    const ta = mk('textarea'); ta.placeholder = 'Anotações: sono, dor, ajuste de banco, o que mudar na próxima…'; ta.setAttribute('aria-label', 'Anotações do treino');
    ta.value = (doc && doc.note) || ''; ta.maxLength = 1000;
    ta.addEventListener('input', () => { const d = app.doc(); d.note = ta.value; app.touch(d); });
    const du = mk('div', 'du', durText(doc)); du.id = 'sessdur';
    // Data do treino (para o calendário): vem das séries marcadas; dá para corrigir se registrou outro dia.
    const dl = mk('div', 'du'); dl.id = 'sessdate';
    const fmtDay = (iso) => DAYFMT.format(new Date(iso + 'T12:00:00'));
    const drawDate = () => {
      dl.textContent = '';
      const cur = app.view().doc, day = cur && CG.dayStatus(cur) ? CG.sessionDay(cur) : '';
      if (!day) return;
      dl.append('Data do treino: ' + fmtDay(day) + ' · ');
      const ch = mk('button', null, 'Alterar'); ch.type = 'button';
      ch.style.cssText = 'border:0;background:none;color:var(--day,var(--accent));font:600 14px/1 var(--f-body);padding:4px 0;cursor:pointer;text-decoration:underline';
      ch.addEventListener('click', () => {
        const inp = mk('input'); inp.type = 'date'; inp.value = day; inp.max = CG.isoDay(Date.now()); inp.setAttribute('aria-label', 'Data do treino');
        inp.style.cssText = 'height:40px;margin-left:6px;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:0 8px';
        inp.addEventListener('change', () => { if (!inp.value) return; const d = app.doc(); d.when = inp.value; app.touch(d); drawDate(); app.status('Data do treino: ' + fmtDay(inp.value)); });
        ch.replaceWith(inp); inp.focus();
      });
      dl.appendChild(ch);
    };
    drawDate();
    box._drawDate = drawDate;
    box.append(en, ta, du, dl);
    const v = app.view(), prev = CG.lastNote(v.logs, v.day, v.week + '-' + v.day);
    if (prev) {
      const pn = mk('div', 'prevnote'); pn.id = 'prevnote';
      pn.textContent = 'Da última vez (semana ' + prev.week + ', ' + new Date(prev.t).toLocaleDateString('pt-BR') + '): ' +
        (prev.energy ? ENERGY[prev.energy - 1][0] + ' ' : '') + (prev.note || ENERGY[prev.energy - 1][1]);
      box.insertBefore(pn, en);
    }
    list.after(box);
  }

  // Recordes: marca 🏅 nas séries feitas que superam as outras sessões do exercício.
  function badges() {
    const v = app.view(), key = v.week + '-' + v.day, doc = v.doc;
    if (!doc) return;
    list.querySelectorAll('.ex').forEach((c, i) => {
      const ex = v.list[i], t = c.querySelector('h2');
      if (!ex || !t) return;
      const e = doc.ex[ex.id];
      c.querySelectorAll('.set:not(.warm)').forEach((row, s) => {
        const st = e && e.sets[s];
        row.classList.toggle('rec', !!(st && st.done && CG.isRecord(v.logs, t.textContent, key, st.kg, st.reps)));
      });
    });
  }

  function refresh() {
    const old = document.getElementById('sess');
    if (old && (!list.querySelector('.ex') || list.querySelector('.ed') || old.dataset.key !== app.view().week + '-' + app.view().day)) old.remove();
    card();
    const s = document.getElementById('sess');
    if (s) s.dataset.key = app.view().week + '-' + app.view().day;
    badges();
  }
  new MutationObserver(refresh).observe(list, { childList: true });

  list.addEventListener('click', (e) => {
    const ck = e.target.closest('.ck');
    if (!ck) return;
    const row = ck.closest('.set'), c = ck.closest('.ex');
    setTimeout(() => {
      const wasPr = row.classList.contains('rec');
      badges();
      const du = document.getElementById('sessdur'); if (du) du.textContent = durText(app.view().doc);
      const sc = document.getElementById('sess'); if (sc && sc._drawDate) sc._drawDate();
      // Marcou a penúltima: avisa qual técnica vem na última série.
      const next = row.nextElementSibling;
      if (row.classList.contains('done') && next && next.classList.contains('last') && !next.classList.contains('done') && window.CGTips) {
        const tk = next.dataset.tec, t = CGTips.TECH[tk];
        if (t) toast('Próxima é a última: ' + t.short.toUpperCase() + ' (toque na etiqueta para lembrar como faz)', tk);
      }
      if (!wasPr && row.classList.contains('rec')) {
        const [k, r] = row.querySelectorAll('input'), name = c.querySelector('h2').textContent;
        const rec = CG.isRecord(app.view().logs, name, app.view().week + '-' + app.view().day, k.value, r.value);
        toast('Recorde pessoal · ' + name + ': ' + kg(k.value) + ' kg × ' + r.value + (rec && !rec.kg ? ' (melhor 1RM estimado)' : ''));
      }
    }, 0);
  });

  window.CGSession = { duration: (doc) => CG.sessionDuration(doc), toast };
  refresh();
})();
