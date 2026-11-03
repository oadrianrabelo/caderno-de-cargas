// Qualidade de vida: cor por dia, animações, rolar até o próximo exercício e comemoração ao fechar o treino.
// Só observa a tela (MutationObserver e cliques): o app funciona igual sem este arquivo.
(function () {
  const app = window.CGApp, list = document.getElementById('list');
  if (!app || !list) return;

  // Cores por dia (claro / escuro). Programas próprios usam a paleta em sequência.
  const DAY = { upper: 0, lower: 1, pull: 2, push: 3, legs: 4 };
  const PALETTE = [['#1f4fd8', '#7b9cff'], ['#d9480f', '#ff9a5c'], ['#0c8599', '#4fd1e0'], ['#c92a2a', '#ff8787'], ['#7048e8', '#b197fc'], ['#e67700', '#ffc94d'], ['#5c940d', '#a9e34b']];
  const dark = () => window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = ':root{--day:var(--accent)}' +
    '.tab[aria-selected="true"]{background:var(--day);border-color:var(--day)}' +
    '.head h1{box-shadow:inset 0 -4px 0 var(--day);padding-bottom:2px}' +
    '.tag.tec{border-color:var(--day);color:var(--day)}.sl .tq{color:var(--day)}' +
    '.ex{transition:border-color .25s,box-shadow .25s}' +
    '.ex.complete{border-color:var(--done);box-shadow:0 0 0 1px var(--done) inset}' +
    '.ex.complete .idx{background:var(--done);color:#fff}' +
    '.ex{scroll-margin-top:150px}' +
    '.ex.collapsed .swap,.ex.collapsed .det,.ex.collapsed .sets,.ex.collapsed .meta{display:none}' +
    '.ex.complete .exh{cursor:pointer}.ex .sum{display:none;margin-top:3px;color:var(--done);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}' +
    '.ex.collapsed .sum{display:block}.ex.collapsed{padding-bottom:12px}' +
    '.ck{transition:background-color .2s,border-color .2s,color .2s,transform .15s}.ck:active{transform:scale(.92)}' +
    '@keyframes cgpop{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}' +
    '.set.pop .ck{animation:cgpop .32s ease-out}' +
    '@keyframes cgin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.list.enter .ex{animation:cgin .28s ease-out both}' +
    '.list.enter .ex:nth-child(2){animation-delay:.03s}.list.enter .ex:nth-child(3){animation-delay:.06s}.list.enter .ex:nth-child(4){animation-delay:.09s}' +
    '.list.enter .ex:nth-child(n+5){animation-delay:.12s}' +
    '.bar>i{transition:width .45s cubic-bezier(.2,.8,.2,1)}' +
    '.cele{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45)}' +
    '.cele .box{width:100%;max-width:420px;background:var(--card);border-radius:16px;padding:22px 18px;text-align:center;animation:cgin .3s ease-out both}' +
    '.cele h2{margin:4px 0 6px;font:700 30px/1.05 var(--f-display);letter-spacing:.03em;text-transform:uppercase;color:var(--day)}' +
    '.cele p{margin:0 0 14px;color:var(--mute)}.cele .big{font-size:44px;line-height:1}' +
    '.cele .r{display:flex;flex-direction:column;gap:8px}.cele .btn{width:100%}' +
    '.cele i.cf{position:fixed;top:-12px;width:8px;height:14px;border-radius:2px;animation:cgfall linear forwards}' +
    '@keyframes cgfall{to{transform:translateY(105vh) rotate(540deg);opacity:.9}}' +
    '@media (prefers-reduced-motion: reduce){.set.pop .ck,.list.enter .ex,.cele .box{animation:none}.cele i.cf{display:none}.bar>i,.ex,.ck{transition:none}}';
  document.head.appendChild(css);

  function setDayColor() {
    const v = app.view(), i = v.day in DAY ? DAY[v.day] : v.ORDER.indexOf(v.day);
    const c = PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
    document.documentElement.style.setProperty('--day', dark() ? c[1] : c[0]);
  }

  // Exercício completo: todas as séries válidas marcadas.
  const cardDone = (card) => { const s = card.querySelectorAll('.set:not(.warm)'); return s.length > 0 && [...s].every((r) => r.classList.contains('done')); };
  // Exercícios completos ficam recolhidos (uma linha com o resumo); tocar no cabeçalho abre de novo.
  const opened = new Set();
  const cardKey = (c) => { const v = app.view(); return v.week + '-' + v.day + '-' + [...list.querySelectorAll('.ex')].indexOf(c); };
  function summary(c) {
    const rows = [...c.querySelectorAll('.set:not(.warm)')];
    let best = null;
    rows.forEach((r) => {
      const [k, rp] = r.querySelectorAll('input');
      const kgv = parseFloat(String(k.value).replace(',', '.')) || 0, rv = parseFloat(rp.value) || 0;
      if (!best || kgv > best.kg || (kgv === best.kg && rv > best.reps)) best = { kg: kgv, reps: rv, k: k.value, r: rp.value };
    });
    return '✓ ' + rows.length + (rows.length === 1 ? ' série' : ' séries') + (best && (best.k || best.r) ? ' · melhor ' + String(best.k || '—').replace('.', ',') + ' kg × ' + (best.r || '—') : '');
  }
  function markCards() {
    list.querySelectorAll('.ex').forEach((c) => {
      const done = cardDone(c);
      c.classList.toggle('complete', done);
      if (!done) { c.classList.remove('collapsed'); return; }
      let sm = c.querySelector('.sum');
      if (!sm) { sm = document.createElement('div'); sm.className = 'sum'; const n = c.querySelector('.exn'); if (n) n.appendChild(sm); }
      sm.textContent = summary(c);
      c.classList.toggle('collapsed', !opened.has(cardKey(c)));
    });
  }
  list.addEventListener('click', (e) => {
    const h = e.target.closest('.ex.complete .exh');
    if (!h || e.target.closest('button')) return;
    const c = h.closest('.ex'), k = cardKey(c);
    if (c.classList.contains('collapsed')) opened.add(k); else opened.delete(k);
    c.classList.toggle('collapsed');
  });

  function dayStats() {
    const v = app.view(), doc = v.doc || { ex: {} };
    let total = 0, done = 0, vol = 0;
    v.list.forEach((ex) => {
      total += ex.s;
      const e = doc.ex[ex.id];
      for (let s = 0; s < ex.s; s++) {
        const st = e && e.sets[s];
        if (st && st.done) { done++; vol += (parseFloat(String(st.kg).replace(',', '.')) || 0) * (parseFloat(st.reps) || 0); }
      }
    });
    return { total, done, vol, key: v.week + '-' + v.day, name: v.NAMES[v.day], week: v.week };
  }

  // Lista refeita (trocou de dia/semana ou editou): cores, selos e animação de entrada.
  let lastKey = null;
  new MutationObserver(() => {
    setDayColor();
    markCards();
    const v = app.view(), key = v.week + '-' + v.day;
    if (key !== lastKey && lastKey !== null && !reduce()) {
      list.classList.remove('enter'); void list.offsetWidth; list.classList.add('enter');
      setTimeout(() => list.classList.remove('enter'), 600);
    }
    lastKey = key;
  }).observe(list, { childList: true });

  // Depois do clique no ✓ (o app já atualizou a série): animação, selo, rolar e comemorar.
  list.addEventListener('click', (e) => {
    const ck = e.target.closest('.ck');
    if (!ck) return;
    const row = ck.closest('.set'), card = ck.closest('.ex');
    setTimeout(() => {
      if (!row.classList.contains('done')) { markCards(); return; }
      row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop');
      const was = card.classList.contains('complete');
      markCards();
      const st = dayStats();
      if (st.total && st.done === st.total) return celebrate(st);
      if (!was && card.classList.contains('complete')) {
        const next = [...list.querySelectorAll('.ex')].find((c) => !c.classList.contains('complete') && c.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_PRECEDING);
        if (next) setTimeout(() => next.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }), 450);
      }
    }, 0);
  });

  function celebrate(st) {
    let seen = {};
    try { seen = JSON.parse(sessionStorage.getItem('cg:cele')) || {}; } catch (e) { /* sem sessionStorage */ }
    if (seen[st.key]) return;
    seen[st.key] = 1;
    try { sessionStorage.setItem('cg:cele', JSON.stringify(seen)); } catch (e) { /* sem sessionStorage */ }
    if (window.CGTimer) CGTimer.stop();
    const ov = document.createElement('div'); ov.className = 'cele'; ov.id = 'cele';
    const box = document.createElement('div'); box.className = 'box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const big = document.createElement('div'); big.className = 'big'; big.textContent = '🏆';
    const h = document.createElement('h2'); h.textContent = 'Treino concluído!';
    const p = document.createElement('p');
    p.textContent = st.name + ' · semana ' + st.week + ' · ' + st.done + ' séries' + (st.vol ? ' · ' + Math.round(st.vol).toLocaleString('pt-BR') + ' kg de volume' : '');
    const r = document.createElement('div'); r.className = 'r';
    const close = () => ov.remove();
    const sh = document.createElement('button'); sh.type = 'button'; sh.className = 'btn pri'; sh.textContent = 'Compartilhar imagem do treino';
    sh.addEventListener('click', () => { close(); if (window.CGProgress && CGProgress.shareWorkout) CGProgress.shareWorkout(); });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn'; ok.textContent = 'Fechar';
    ok.addEventListener('click', close);
    r.append(sh, ok);
    box.append(big, h, p, r);
    ov.appendChild(box);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    if (!reduce()) {
      const colors = PALETTE.map((c) => c[0]).concat(['#5fd593', '#ffd43b']);
      for (let i = 0; i < 36; i++) {
        const c = document.createElement('i'); c.className = 'cf';
        c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
        c.style.animationDuration = (1.6 + Math.random() * 1.4) + 's'; c.style.animationDelay = Math.random() * 0.4 + 's';
        ov.appendChild(c);
      }
    }
    document.body.appendChild(ov);
    ok.focus();
  }

  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setDayColor); } catch (e) { /* WebView antigo */ } }
  setDayColor();
  markCards();
  lastKey = app.view().week + '-' + app.view().day;
})();
