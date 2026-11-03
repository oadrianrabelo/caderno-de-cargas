// Atalhos: repetir as cargas da última vez num toque e exportar a planilha (CSV) do histórico.
(function () {
  const app = window.CGApp, list = document.getElementById('list'), tools = document.querySelector('.tools');
  if (!app || !list || !tools || !window.CG) return;

  // Repetir: preenche carga e reps das séries vazias com os números cinza (última vez ou carga sugerida).
  // Não marca nada como feito: você confere e toca no ✓ de cada série.
  const rep = document.createElement('button'); rep.type = 'button'; rep.className = 'btn'; rep.id = 'brepeat';
  rep.textContent = '↺ Preencher com as cargas da última vez'; rep.hidden = true; rep.style.width = '100%'; rep.style.marginBottom = '12px';
  list.before(rep);
  const rows = () => [...list.querySelectorAll('.set:not(.warm)')];
  function refresh() {
    const rs = rows(), editing = !!list.querySelector('.ed');
    const anyFilled = rs.some((r) => [...r.querySelectorAll('input')].some((i) => i.value));
    const anyHint = rs.some((r) => { const i = r.querySelector('input'); return i && i.placeholder && i.placeholder !== '0'; });
    rep.hidden = editing || !rs.length || anyFilled || !anyHint;
  }
  rep.addEventListener('click', () => {
    let n = 0;
    rows().forEach((r) => r.querySelectorAll('input').forEach((i) => {
      if (!i.value && i.placeholder && i.placeholder !== '0') { i.value = i.placeholder; i.dispatchEvent(new Event('input', { bubbles: true })); n++; }
    }));
    rep.hidden = true;
    app.status(n ? 'Cargas preenchidas: confira e marque cada série' : 'Nada para preencher');
  });
  new MutationObserver(refresh).observe(list, { childList: true });
  list.addEventListener('input', refresh);
  refresh();

  // App vazio (instalou de novo?): oferece importar o backup logo no topo.
  const fresh = document.createElement('div'); fresh.className = 'note'; fresh.id = 'freshnote';
  fresh.textContent = 'Reinstalou o app? Importe o seu backup para recuperar os treinos. ';
  const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'btn pri'; fb.textContent = 'Importar backup'; fb.style.marginTop = '8px';
  fb.addEventListener('click', () => document.getElementById('fimp').click());
  fresh.append(document.createElement('br'), fb);
  rep.before(fresh);
  const showFresh = () => { fresh.hidden = !app.isEmpty(); };
  app.saved.push(showFresh);
  new MutationObserver(showFresh).observe(list, { childList: true });
  showFresh();

  // Planilha CSV com todas as séries registradas (abre no Excel e no Google Sheets).
  const csv = document.createElement('button'); csv.type = 'button'; csv.className = 'btn'; csv.id = 'bcsv'; csv.textContent = 'Exportar planilha';
  csv.addEventListener('click', () => {
    app.flush();
    const v = app.view(), names = Object.assign({}, app.bts().names, v.NAMES);
    (app.programs().list ? Object.values(app.programs().list) : []).forEach((p) => p.days.forEach((d) => { names[d.id] = d.name; }));
    const text = CG.toCSV(v.logs, names), name = 'caderno-de-cargas-' + CG.isoDay(Date.now()) + '.csv';
    if (window.CGNative && CGNative.shareFile) { CGNative.shareFile(name, text, 'Planilha do Caderno de Cargas').then(app.status, () => app.status('Não consegui exportar')); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    app.status('Planilha exportada');
  });
  tools.appendChild(csv);
})();
