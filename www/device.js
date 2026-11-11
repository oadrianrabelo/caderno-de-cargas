// Recursos do aparelho (só no APK com o plugin "Caderno"): descanso com alarme e notificação na tela
// bloqueada, vibração, tela acesa, barras do sistema na cor do tema, botão voltar, lembrete de treino,
// atalhos do ícone, salvar na galeria e instalar APK novo. No navegador (ou APK antigo) nada disso existe
// e o app segue como antes.
(function () {
  const cap = window.Capacitor;
  const P = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Caderno;
  const app = window.CGApp;
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  };
  const quiet = (p) => (p && p.catch ? p.catch(() => null) : p);

  const D = {
    available: !!P,
    haptic: (kind) => { if (P) quiet(P.haptic({ kind: kind || 'tap' })); },
    keepAwake: (on) => { if (P) quiet(P.keepAwake({ on: !!on })); },
    // Descanso: o alarme nativo vibra e avisa mesmo com a tela bloqueada.
    restStart(endAt, label) {
      if (!P) return false;
      askNotifications();
      quiet(P.restStart({ endAt: Math.round(endAt), label: label || '' }));
      return true;
    },
    restCancel() { if (P) quiet(P.restCancel()); },
    saveImage: (data, name) => (P ? P.saveImage({ data, name }) : Promise.reject(new Error('unsupported'))),
    installApk: (url, name) => (P ? P.installApk({ url, name }) : Promise.reject(new Error('unsupported'))),
    galleryOk: false
  };
  window.CGDevice = D;
  if (!P) return;
  quiet(P.info().then((i) => { D.galleryOk = !!(i && i.galleryOk); }));

  // Permissão de notificação (Android 13+): pede uma vez, no primeiro descanso ou ao ligar o lembrete.
  function askNotifications(force) {
    if (!force && LS.get('cg:notifAsked')) return Promise.resolve(null);
    LS.set('cg:notifAsked', '1');
    return quiet(P.requestNotifications());
  }
  D.askNotifications = askNotifications;

  // Botões +15 s / Pular da notificação e fim do alarme: o cronômetro da tela acompanha.
  P.addListener('rest', (e) => { if (window.CGTimer && CGTimer.sync) CGTimer.sync(e.endAt, e.finished); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { sendNext(); return; }
    quiet(P.restState().then((s) => { if (s && window.CGTimer && CGTimer.sync) CGTimer.sync(s.endAt, false, true); }));
  });

  // Barras do sistema (status e navegação) na cor do fundo do tema, com ícones claros ou escuros.
  function bars() {
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--bg').trim();
    const t = document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    if (/^#[0-9a-f]{6}$/i.test(bg)) quiet(P.setBars({ color: bg, dark }));
  }
  document.addEventListener('cg:theme', () => setTimeout(bars, 0));
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(bars, 0)); } catch (e) { /* WebView antigo */ } }
  bars();

  // Vibração leve: série marcada, recorde e aviso da técnica da última série.
  const list = document.getElementById('list');
  if (list) {
    list.addEventListener('click', (e) => {
      const ck = e.target.closest('.ck');
      if (!ck) return;
      const row = ck.closest('.set');
      setTimeout(() => {
        if (!row || !row.classList.contains('done')) { D.haptic('tap'); return; }
        D.haptic('confirm');
        sendTrained();
      }, 0);
    });
  }
  // Observa só o aviso (#toast), que é criado na primeira vez que aparece.
  const onToast = (t) => {
    if (!t.classList.contains('on')) return;
    if (/^Recorde/.test(t.textContent)) D.haptic('success');
    else if (t.classList.contains('tech')) D.haptic('warn');
  };
  const watchToast = () => {
    const t = document.getElementById('toast');
    if (!t || t._cgWatch) return;
    t._cgWatch = true;
    new MutationObserver(() => onToast(t)).observe(t, { attributes: true, attributeFilter: ['class'] });
  };
  new MutationObserver(watchToast).observe(document.body, { childList: true });
  watchToast();

  // Lembrete: o aparelho precisa saber o dia do último treino e qual é o próximo (texto da notificação).
  function nextLabel() {
    if (!app) return '';
    const v = app.view(), nx = window.CG && CG.pickStart(v.logs, v.ORDER, v.WEEKS);
    return nx ? v.NAMES[nx.day] + ' · semana ' + nx.week : '';
  }
  function sendTrained() { quiet(P.trained({ day: CG.isoDay(Date.now()), next: nextLabel() })); }
  function sendNext() { quiet(P.trained({ next: nextLabel() })); }
  sendNext();

  // Atalhos do ícone: Treino de hoje, Progresso, Modo foco.
  function shortcut(action) {
    if (!action) return;
    if (window.CGBack) { for (let i = 0; i < 4 && CGBack(); i++) { /* fecha o que estiver aberto */ } }
    if (action === 'hoje' && app) {
      const v = app.view(), nx = CG.pickStart(v.logs, v.ORDER, v.WEEKS);
      if (nx) app.go(nx.week, nx.day);
      scrollTo(0, 0);
    } else if (action === 'progresso') {
      const b = document.getElementById('bprog'), pg = document.getElementById('progress');
      if (b && pg && pg.hidden) b.click();
    } else if (action === 'foco') {
      const b = document.getElementById('bfocus');
      if (b && !document.body.classList.contains('focus')) b.click();
    }
  }
  P.addListener('shortcut', (e) => shortcut(e.action));
  quiet(P.launchAction().then((r) => shortcut(r && r.action)));

  // Lembrete de treino: folha com dias da semana e horário (Mais → Lembrete).
  const tools = document.querySelector('.tools');
  if (tools) {
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const btn = mk('button', 'btn', 'Lembrete de treino'); btn.type = 'button'; btn.id = 'bremind';
    tools.appendChild(btn);
    const sheet = mk('div', 'look remind'); sheet.id = 'remind'; sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Lembrete de treino');
    document.body.appendChild(sheet);
    const NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let st = { on: false, days: [1, 2, 3, 4, 5], hour: 18, minute: 0 };
    const save = () => quiet(P.reminderSet(st).then((r) => { if (r) st = r; render(); }));
    function render() {
      sheet.textContent = '';
      sheet.appendChild(mk('h2', '', 'Lembrete de treino'));
      sheet.appendChild(mk('p', 'lnote', 'Uma notificação no horário escolhido, só nos dias marcados e só se você ainda não treinou no dia.'));
      const seg = mk('div', 'lseg');
      [[false, 'Desligado'], [true, 'Ligado']].forEach(([v, name]) => {
        const b = mk('button', '', name); b.type = 'button'; b.setAttribute('aria-pressed', String(st.on === v));
        b.addEventListener('click', () => {
          st.on = v;
          if (v) askNotifications(true).then(save); else save();
        });
        seg.appendChild(b);
      });
      sheet.appendChild(seg);
      sheet.appendChild(mk('h3', '', 'Dias'));
      const days = mk('div', 'ldays');
      NAMES.forEach((n, i) => {
        const b = mk('button', '', n); b.type = 'button'; b.setAttribute('aria-pressed', String(st.days.indexOf(i) >= 0));
        b.addEventListener('click', () => { st.days = st.days.indexOf(i) >= 0 ? st.days.filter((d) => d !== i) : st.days.concat(i).sort(); save(); });
        days.appendChild(b);
      });
      sheet.appendChild(days);
      sheet.appendChild(mk('h3', '', 'Horário'));
      const time = mk('input', 'ltime'); time.type = 'time';
      time.value = String(st.hour).padStart(2, '0') + ':' + String(st.minute).padStart(2, '0');
      time.addEventListener('change', () => { const [h, m] = time.value.split(':').map(Number); if (h >= 0) { st.hour = h; st.minute = m || 0; save(); } });
      sheet.appendChild(time);
      const nx = nextLabel();
      if (nx) sheet.appendChild(mk('p', 'lnote', 'Próximo treino: ' + nx));
    }
    btn.addEventListener('click', () => quiet(P.reminderGet().then((r) => { if (r) st = r; render(); sheet.hidden = false; })));
  }
})();
