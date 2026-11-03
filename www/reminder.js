// Lembrete de treino: notificação semanal nos dias e horário escolhidos (plugin @capacitor/local-notifications).
// Só no app Android; no navegador o painel explica isso.
(function (root) {
  // Dias no formato do app (0 = segunda ... 6 = domingo) → agendamentos do plugin (1 = domingo ... 7 = sábado).
  const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  function plan(cfg, body) {
    if (!cfg || !cfg.on) return [];
    const m = /^(\d{1,2}):(\d{2})$/.exec(cfg.time || '');
    if (!m) return [];
    const hour = Math.min(23, Number(m[1])), minute = Math.min(59, Number(m[2]));
    return (cfg.days || []).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b).map((d) => ({
      id: 7100 + d, title: 'Hora do treino 💪', body: body || 'Seu treino de hoje está esperando no Caderno de Cargas.',
      channelId: 'treino', schedule: { on: { weekday: ((d + 1) % 7) + 1, hour, minute }, allowWhileIdle: true }
    }));
  }
  const api = { DAYS, plan };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  const app = root.CGApp, tools = document.querySelector('.tools'), cap = root.Capacitor;
  if (!app || !tools) return;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.isPluginAvailable && cap.isPluginAvailable('LocalNotifications'));
  const LN = native ? ((cap.Plugins && cap.Plugins.LocalNotifications) || cap.registerPlugin('LocalNotifications')) : null;
  const KEY = 'cg:reminder';
  const load = () => { try { return Object.assign({ on: false, time: '18:00', days: [0, 1, 2, 3, 4] }, JSON.parse(localStorage.getItem(KEY))); } catch (e) { return { on: false, time: '18:00', days: [0, 1, 2, 3, 4] }; } };
  const save = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* sem armazenamento */ } };
  // Próximo treino (o mesmo que o app abre): depois do último feito ou pulado.
  const nextText = () => {
    const v = app.view(), n = (window.CG && CG.pickStart(v.logs, v.ORDER, v.WEEKS)) || { week: v.week, day: v.day };
    return 'Hoje: ' + v.NAMES[n.day] + ' · semana ' + n.week + '. Bora!';
  };

  // Reagenda tudo (o texto mostra o próximo treino, então reagendamos a cada abertura e a cada treino salvo).
  async function apply(cfg) {
    if (!LN) return 'Lembrete só funciona no app Android';
    const ids = DAYS.map((_, d) => ({ id: 7100 + d }));
    try { await LN.cancel({ notifications: ids }); } catch (e) { /* nada agendado */ }
    if (!cfg.on) return 'Lembrete desligado';
    let perm = await LN.checkPermissions().catch(() => ({ display: 'denied' }));
    if (perm.display !== 'granted') perm = await LN.requestPermissions().catch(() => ({ display: 'denied' }));
    if (perm.display !== 'granted') return 'Sem permissão para notificações: libere nas configurações do Android';
    try { await LN.createChannel({ id: 'treino', name: 'Lembrete de treino', importance: 4, vibration: true }); } catch (e) { /* canal já existe */ }
    const n = plan(cfg, nextText());
    if (!n.length) return 'Escolha pelo menos um dia';
    await LN.schedule({ notifications: n });
    return 'Lembrete ativo: ' + cfg.days.slice().sort().map((d) => DAYS[d]).join(', ') + ' às ' + cfg.time;
  }

  function open() {
    const cfg = load();
    let ov = document.getElementById('tipov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'tipov'; ov.id = 'tipov'; ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; }); document.body.appendChild(ov); }
    ov.textContent = '';
    const box = document.createElement('div'); box.className = 'tipbox pl'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = 'Lembrete de treino';
    box.appendChild(h);
    if (!native) {
      const p = document.createElement('p'); p.textContent = 'O lembrete usa as notificações do Android e só funciona no app instalado.'; box.appendChild(p);
    }
    const onL = document.createElement('label'); onL.style.flexDirection = 'row'; onL.style.alignItems = 'center'; onL.style.gap = '10px'; onL.style.color = 'var(--ink)';
    const on = document.createElement('input'); on.type = 'checkbox'; on.checked = cfg.on; on.style.width = '22px'; on.style.height = '22px';
    on.setAttribute('aria-label', 'Ligar lembrete');
    onL.append(on, document.createTextNode('Lembrar de treinar'));
    const tl = document.createElement('label'); tl.textContent = 'Horário';
    const tm = document.createElement('input'); tm.type = 'time'; tm.value = cfg.time; tm.setAttribute('aria-label', 'Horário do lembrete'); tl.appendChild(tm);
    const dl = document.createElement('p'); dl.textContent = 'Dias:'; dl.style.margin = '4px 0'; dl.style.color = 'var(--mute)';
    const dv = document.createElement('div'); dv.className = 'have';
    DAYS.forEach((name, d) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.setAttribute('aria-pressed', String(cfg.days.indexOf(d) >= 0));
      b.addEventListener('click', () => { const i = cfg.days.indexOf(d); if (i >= 0) cfg.days.splice(i, 1); else cfg.days.push(d); b.setAttribute('aria-pressed', String(i < 0)); });
      dv.appendChild(b);
    });
    const st = document.createElement('p'); st.className = 'res'; st.id = 'remst'; st.style.fontSize = '15px';
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn pri'; ok.textContent = 'Salvar';
    ok.addEventListener('click', () => {
      cfg.on = on.checked; cfg.time = tm.value || '18:00'; save(cfg);
      st.textContent = 'Salvando…';
      apply(cfg).then((t) => { st.textContent = t; app.status(t); }, () => { st.textContent = 'Não consegui agendar o lembrete'; });
    });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = 'Fechar'; close.style.marginTop = '8px'; close.style.width = '100%';
    close.addEventListener('click', () => { ov.hidden = true; });
    box.append(onL, tl, dl, dv, st, ok, close);
    ov.appendChild(box); ov.hidden = false;
  }

  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'breminder'; b.textContent = 'Lembrete de treino';
  b.addEventListener('click', open);
  tools.appendChild(b);

  // Mantém o texto da notificação com o próximo treino: reagenda ao abrir e ao sair do app (não a cada série).
  const refresh = () => { const c = load(); if (c.on && LN) apply(c).catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) refresh(); });
  setTimeout(refresh, 1500);
  root.CGReminder = { open, apply, plan };
})(typeof globalThis !== 'undefined' ? globalThis : this);
