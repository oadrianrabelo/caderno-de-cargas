// Cronômetro de descanso: começa ao marcar uma série como feita, com o descanso do exercício.
// Usa a hora de término (não um contador), então continua certo mesmo com a tela apagada.
(function () {
  const css = document.createElement('style');
  css.textContent = '.timer{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--card);border-top:1px solid var(--line);' +
    'padding:10px max(16px,env(safe-area-inset-right,0px)) max(10px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));' +
    'display:flex;align-items:center;gap:10px;box-shadow:0 -4px 16px rgba(0,0,0,.12)}' +
    '.timer .tl{flex:1;min-width:0}.timer .tl small{display:block;color:var(--mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.timer .tl b{font:700 30px/1 var(--f-display);font-variant-numeric:tabular-nums;letter-spacing:.02em}' +
    '.timer button{min-height:44px;min-width:48px;padding:0 10px;border:1px solid var(--line);background:var(--field);color:var(--ink);border-radius:8px;font:600 14px/1 var(--f-body);cursor:pointer}' +
    '.timer.end{background:var(--accent);border-color:var(--accent)}.timer.end .tl b,.timer.end .tl small{color:var(--accent-ink)}' +
    'body.timing{padding-bottom:96px}';
  document.head.appendChild(css);

  const bar = document.createElement('div'); bar.className = 'timer'; bar.id = 'timer'; bar.hidden = true;
  bar.setAttribute('role', 'timer'); bar.setAttribute('aria-live', 'polite');
  const tl = document.createElement('div'); tl.className = 'tl';
  const lab = document.createElement('small'), big = document.createElement('b');
  tl.append(lab, big);
  const mkb = (t, f, aria) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', f); return b; };
  bar.append(tl, mkb('−15', () => add(-15), 'Menos 15 segundos'), mkb('+15', () => add(15), 'Mais 15 segundos'), mkb('✕', stop, 'Parar descanso'));
  document.body.appendChild(bar);

  let end = 0, tick = null, hideTm = null, rang = false;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
        o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
      });
      setTimeout(() => ac.close && ac.close(), 1200);
    } catch (e) { /* sem áudio */ }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* sem vibração */ }
  }

  function draw() {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    big.textContent = left ? fmt(left) : 'Próxima série!';
    bar.classList.toggle('end', !left);
    if (!left && !rang) {
      rang = true; beep();
      clearTimeout(hideTm); hideTm = setTimeout(stop, 15000);
    }
  }

  function start(seconds, label) {
    if (!seconds) return;
    end = Date.now() + seconds * 1000; rang = false;
    lab.textContent = 'Descanso · ' + label;
    bar.hidden = false; document.body.classList.add('timing');
    clearTimeout(hideTm); clearInterval(tick); tick = setInterval(draw, 250); draw();
  }
  function add(s) { if (!end) return; end = Math.max(Date.now(), end + s * 1000); if (end > Date.now()) rang = false; draw(); }
  function stop() { clearInterval(tick); clearTimeout(hideTm); end = 0; bar.hidden = true; document.body.classList.remove('timing'); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && end) draw(); });

  // Tela acesa só durante o treino: liga ao marcar uma série; desliga ao concluir ou após 30 min sem marcar nada.
  const IDLE_MS = 30 * 60000;
  let lock = null, lastSet = 0, idleTm = null;
  async function wakeOn(keep) {
    if (!keep) { lastSet = Date.now(); clearTimeout(idleTm); idleTm = setTimeout(wakeOff, IDLE_MS); }
    try { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { lock = null; }
  }
  function wakeOff() { clearTimeout(idleTm); lastSet = 0; try { if (lock) lock.release(); } catch (e) { /* já solto */ } lock = null; }
  // O sistema solta a trava quando o app vai para segundo plano: pega de novo ao voltar, se o treino estiver em andamento.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && lastSet && Date.now() - lastSet < IDLE_MS) wakeOn(true); });
  window.CGWake = { on: () => wakeOn(false), off: wakeOff, active: () => !!lastSet };

  window.CGTimer = { start, stop, left: () => (end ? Math.max(0, Math.round((end - Date.now()) / 1000)) : null) };
})();
