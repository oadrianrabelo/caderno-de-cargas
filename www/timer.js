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
  bar.append(tl, mkb('−15', () => add(-15), 'Menos 15 segundos'), mkb('+15', () => add(15), 'Mais 15 segundos'), mkb('✕', () => stop(), 'Parar descanso'));
  document.body.appendChild(bar);

  let end = 0, tick = null, hideTm = null, rang = false;
  const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  // Alarme agendado no relógio do próprio áudio quando o descanso começa (e reagendado no −15/+15): toca no
  // fim mesmo que o JavaScript fique lento com a tela apagada. Toque de dois tons, suave.
  let ac = null, alarm = null, sleepTm = null;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (!ac || ac.state === 'closed') ac = new AC(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
    return ac;
  }
  function chime(at, out) {
    [[0, 784], [0.16, 1175], [0.7, 784], [0.86, 1175]].forEach(([t, f]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, at + t); g.gain.exponentialRampToValueAtTime(0.32, at + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + t + 0.5);
      o.start(at + t); o.stop(at + t + 0.55);
    });
  }
  function cancelAlarm() { if (alarm) { try { alarm.disconnect(); } catch (e) { /* já solto */ } alarm = null; } }
  function schedule() {
    cancelAlarm(); clearTimeout(sleepTm);
    const left = (end - Date.now()) / 1000;
    if (left <= 0 || !audio()) return;
    try { alarm = ac.createGain(); alarm.connect(ac.destination); chime(ac.currentTime + left, alarm); } catch (e) { alarm = null; }
  }
  function ring() {
    // Com o alarme nativo (APK novo), o Android já vibra e avisa; aqui só o toque, e só com o app na frente.
    if (nativeRest) {
      if (!document.hidden && audio()) { try { const g = ac.createGain(); g.connect(ac.destination); chime(ac.currentTime + 0.02, g); } catch (e) { /* sem áudio */ } }
      return;
    }
    // Se o agendado não deu (sem áudio ou contexto parado), toca agora.
    if (!alarm || !ac || ac.state !== 'running') { if (audio()) { try { const g = ac.createGain(); g.connect(ac.destination); chime(ac.currentTime + 0.02, g); } catch (e) { /* sem áudio */ } } }
    alarm = null;
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) { /* sem vibração */ }
    clearTimeout(sleepTm); sleepTm = setTimeout(() => { try { if (ac && !end) ac.suspend(); } catch (e) { /* já parado */ } }, 3000);
  }

  function draw() {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    big.textContent = left ? fmt(left) : 'Próxima série!';
    bar.classList.toggle('end', !left);
    if (!left && !rang) {
      rang = true; ring();
      clearTimeout(hideTm); hideTm = setTimeout(() => stop(), 15000);
    }
  }

  // nativeRest: o descanso também está agendado no Android (alarme + notificação com contagem).
  let nativeRest = false, restLabel = '';
  const dev = () => window.CGDevice;
  function arm() {
    nativeRest = !!(dev() && dev().restStart(end, restLabel));
    if (nativeRest) cancelAlarm(); else schedule();
  }
  function start(seconds, label) {
    if (!seconds) return;
    end = Date.now() + seconds * 1000; rang = false; restLabel = label || '';
    lab.textContent = 'Descanso · ' + label;
    bar.hidden = false; document.body.classList.add('timing');
    clearTimeout(hideTm); clearInterval(tick); tick = setInterval(draw, 250); arm(); draw();
  }
  function add(s) { if (!end) return; end = Math.max(Date.now(), end + s * 1000); if (end > Date.now()) { rang = false; arm(); } draw(); }
  function stop(fromNative) {
    if (nativeRest && fromNative !== true && dev()) dev().restCancel();
    nativeRest = false;
    clearInterval(tick); clearTimeout(hideTm); cancelAlarm(); end = 0; bar.hidden = true; document.body.classList.remove('timing');
    try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) { /* já parado */ }
  }
  // O Android avisou: +15 s ou Pular na notificação, ou o alarme tocou. Ao voltar para o app, confere o estado.
  function sync(nativeEnd, finished, onResume) {
    if (!end || !nativeRest) return;
    if (nativeEnd > 0) { if (Math.abs(nativeEnd - end) > 400) { end = nativeEnd; rang = false; draw(); } return; }
    if (finished || end <= Date.now() + 1000) { end = Math.min(end, Date.now()); draw(); return; }
    if (onResume || !finished) stop(true); // pulou pela notificação
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && end) draw(); });

  // Tela acesa só durante o treino: liga ao marcar uma série; desliga ao concluir ou após 30 min sem marcar nada.
  const IDLE_MS = 30 * 60000;
  let lock = null, lastSet = 0, idleTm = null;
  async function wakeOn(keep) {
    if (!keep) { lastSet = Date.now(); clearTimeout(idleTm); idleTm = setTimeout(wakeOff, IDLE_MS); }
    if (window.CGDevice) CGDevice.keepAwake(true);
    try { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { lock = null; }
  }
  function wakeOff() { if (window.CGDevice) CGDevice.keepAwake(false); clearTimeout(idleTm); lastSet = 0; try { if (lock) lock.release(); } catch (e) { /* já solto */ } lock = null; }
  // O sistema solta a trava quando o app vai para segundo plano: pega de novo ao voltar, se o treino estiver em andamento.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && lastSet && Date.now() - lastSet < IDLE_MS) wakeOn(true); });
  window.CGWake = { on: () => wakeOn(false), off: wakeOff, active: () => !!lastSet };

  window.CGTimer = { start, stop: () => stop(), sync, left: () => (end ? Math.max(0, Math.round((end - Date.now()) / 1000)) : null) };
})();
