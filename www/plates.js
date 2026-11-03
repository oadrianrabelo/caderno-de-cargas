// Calculadora de anilhas: quais anilhas colocar de cada lado da barra para a carga total.
(function () {
  const tools = document.querySelector('.tools');
  if (!tools || !window.CG) return;
  const ALL = [25, 20, 15, 10, 5, 2.5, 1.25];
  const COLOR = { 25: '#d6336c', 20: '#1c7ed6', 15: '#f59f00', 10: '#2f9e44', 5: '#adb5bd', 2.5: '#e8590c', 1.25: '#868e96' };
  const KEY = 'cg:plates';
  const load = () => { try { return Object.assign({ bar: 20, have: ALL }, JSON.parse(localStorage.getItem(KEY))); } catch (e) { return { bar: 20, have: ALL }; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sem armazenamento */ } };
  const kgs = (v) => String(v).replace('.', ',');

  const css = document.createElement('style');
  css.textContent = '.pl label{display:flex;flex-direction:column;gap:4px;color:var(--mute);font-size:13px;margin-bottom:10px}' +
    '.pl input,.pl select{height:48px;width:100%;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;padding:0 10px;font:600 20px/1 var(--f-body)}' +
    '.pl .bar{display:flex;align-items:center;justify-content:center;gap:3px;min-height:120px;margin:8px 0}' +
    '.pl .bar i{display:block;border-radius:4px;color:#fff;font:700 11px/1 var(--f-body);writing-mode:vertical-rl;display:grid;place-items:center}' +
    '.pl .bar .rod{width:46px;height:12px;background:var(--mute);border-radius:3px;writing-mode:horizontal-tb}' +
    '.pl .res{font:700 18px/1.3 var(--f-body);text-align:center;margin:0 0 6px}.pl .warn2{color:var(--danger);text-align:center}' +
    '.pl .have{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.pl .have button{min-height:36px;padding:0 10px;border:1px solid var(--line);background:var(--field);color:var(--mute);border-radius:999px;cursor:pointer;font:600 13px/1 var(--f-body)}' +
    '.pl .have button[aria-pressed="true"]{color:var(--ink);border-color:var(--ink)}';
  document.head.appendChild(css);

  let lastKg = '';
  document.addEventListener('focusin', (e) => { const t = e.target; if (t.matches && t.matches('input[aria-label^="Carga"]')) lastKg = t.value || t.placeholder; });

  function open() {
    const st = load();
    let ov = document.getElementById('tipov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'tipov'; ov.id = 'tipov'; ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; }); document.body.appendChild(ov); }
    ov.textContent = '';
    const box = document.createElement('div'); box.className = 'tipbox pl'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = 'Anilhas';
    const l1 = document.createElement('label'); l1.textContent = 'Carga total (kg)';
    const tot = document.createElement('input'); tot.type = 'number'; tot.inputMode = 'decimal'; tot.step = '0.5'; tot.min = '0'; tot.value = lastKg && lastKg !== '0' ? lastKg : '';
    tot.setAttribute('aria-label', 'Carga total'); l1.appendChild(tot);
    const l2 = document.createElement('label'); l2.textContent = 'Barra';
    const bar = document.createElement('select'); bar.setAttribute('aria-label', 'Peso da barra');
    [[20, 'Olímpica 20 kg'], [15, 'Feminina 15 kg'], [10, 'Curta/EZ 10 kg'], [0, 'Sem barra (só anilhas)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; o.selected = st.bar === v; bar.appendChild(o); });
    l2.appendChild(bar);
    const viz = document.createElement('div'); viz.className = 'bar';
    const res = document.createElement('p'); res.className = 'res';
    const warn = document.createElement('p'); warn.className = 'warn2';
    const hv = document.createElement('div'); hv.className = 'have';
    const hl = document.createElement('p'); hl.textContent = 'Anilhas que a academia tem:'; hl.style.margin = '6px 0 4px'; hl.style.color = 'var(--mute)';
    ALL.forEach((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = kgs(p) + ' kg';
      b.setAttribute('aria-pressed', String(st.have.indexOf(p) >= 0));
      b.addEventListener('click', () => { const i = st.have.indexOf(p); if (i >= 0) st.have.splice(i, 1); else st.have.push(p); b.setAttribute('aria-pressed', String(i < 0)); save(st); calc(); });
      hv.appendChild(b);
    });
    function calc() {
      st.bar = Number(bar.value); save(st);
      viz.textContent = ''; warn.textContent = '';
      const t = parseFloat(String(tot.value).replace(',', '.'));
      if (!t) { res.textContent = 'Digite a carga total'; return; }
      const r = CG.plates(t, st.bar, st.have);
      if (t < st.bar) { res.textContent = 'Menos que a barra (' + st.bar + ' kg)'; return; }
      res.textContent = r.side.length ? 'Cada lado: ' + r.side.map(kgs).join(' + ') + ' kg' : 'Só a barra';
      if (!r.ok) warn.textContent = 'Faltam ' + kgs(Math.round(r.rest * 2 * 100) / 100) + ' kg no total com essas anilhas.';
      const side = r.side.map((p) => { const i = document.createElement('i'); i.style.background = COLOR[p]; i.style.width = (p >= 10 ? 22 : 16) + 'px'; i.style.height = Math.round(40 + p * 3.2) + 'px'; i.textContent = kgs(p); return i; });
      const rod = document.createElement('i'); rod.className = 'rod';
      side.slice().reverse().forEach((x) => viz.appendChild(x));
      viz.appendChild(rod);
      side.forEach((x) => viz.appendChild(x.cloneNode(true)));
    }
    tot.addEventListener('input', calc); bar.addEventListener('change', calc);
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn pri'; ok.textContent = 'Fechar';
    ok.addEventListener('click', () => { ov.hidden = true; });
    const l3 = document.createElement('label'); l3.textContent = 'Incremento da sugestão de carga';
    const inc = document.createElement('select'); inc.setAttribute('aria-label', 'Incremento da sugestão de carga');
    let cur = '2.5'; try { cur = localStorage.getItem('cg:inc') || '2.5'; } catch (e) { /* sem armazenamento */ }
    ['1', '2', '2.5', '5'].forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = '+' + kgs(v) + ' kg'; o.selected = v === cur; inc.appendChild(o); });
    inc.addEventListener('change', () => { try { localStorage.setItem('cg:inc', inc.value); } catch (e) { /* sem armazenamento */ } if (window.CGApp) CGApp.go(CGApp.view().week, CGApp.view().day); });
    l3.appendChild(inc);
    box.append(h, l1, l2, viz, res, warn, hl, hv, l3, ok);
    ov.appendChild(box); ov.hidden = false;
    calc();
    tot.focus();
  }

  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'bplates'; b.textContent = 'Anilhas';
  b.addEventListener('click', open);
  tools.appendChild(b);
  window.CGPlates = { open };
})();
