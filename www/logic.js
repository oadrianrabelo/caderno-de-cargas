// Lógica pura do caderno: sem DOM e sem estado global, para poder ser testada no Node.
// No navegador vira window.CG; no Node, module.exports.
(function (root) {
  const ORDER = ['upper', 'lower', 'pull', 'push', 'legs'];
  const LAST_WEEK = 12;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s, d) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } };
  const hasDoneSet = (l) => Object.values(l.ex || {}).some((x) => Object.values(x.sets || {}).some((s) => s && s.done));

  function baseList(P, w, d) { return P[w][d].map((e, i) => ({ id: 'o' + i, n: e.n, s: e.s, r: e.r, t: e.t, a: e.a })); }

  // Devolve a lista editável do dia, criando-a a partir do programa base se ainda não existir.
  function editList(custom, P, w, d) {
    const k = w + '-' + d;
    if (!custom[k]) custom[k] = baseList(P, w, d);
    return custom[k];
  }

  // Séries da execução mais recente (por timestamp) do exercício `name`, ignorando o treino `exceptKey`.
  function lastFor(logs, name, exceptKey) {
    let best = null;
    for (const k in logs) {
      if (k === exceptKey || !logs[k] || !logs[k].ex) continue;
      for (const id in logs[k].ex) {
        const x = logs[k].ex[id];
        if (!x || x.used !== name) continue;
        if (!Object.values(x.sets || {}).some((s) => s && (s.kg || s.reps))) continue;
        if (!best || (logs[k].t || 0) > best.t) best = { t: logs[k].t || 0, sets: x.sets };
      }
    }
    return best ? best.sets : null;
  }

  // Próximo treino depois do último com alguma série feita, ou null se ainda não há nenhum.
  function pickStart(logs) {
    let latest = null;
    for (const k in logs) {
      const l = logs[k];
      if (!l || !l.t || !hasDoneSet(l)) continue;
      if (!latest || l.t > latest.t) latest = l;
    }
    if (!latest) return null;
    const idx = ORDER.indexOf(latest.day);
    if (idx < ORDER.length - 1) return { week: latest.week, day: ORDER[idx + 1] };
    return { week: Math.min(LAST_WEEK, latest.week + 1), day: 'upper' };
  }

  // Copia a lista do dia para o mesmo dia de todas as semanas seguintes.
  function copyToNextWeeks(custom, list, week, day) {
    const src = clone(list);
    for (let w = week + 1; w <= LAST_WEEK; w++) custom[w + '-' + day] = clone(src);
    return custom;
  }

  function serializeBackup(logs, custom) { return JSON.stringify({ v: 1, logs, custom }); }

  // Lê um backup. Importar substitui os dados atuais (não mescla). Devolve null se o arquivo for inválido.
  function parseBackup(text) {
    const o = parse(text, null);
    if (!o || typeof o.logs !== 'object') return null;
    return { logs: o.logs, custom: o.custom && typeof o.custom === 'object' ? o.custom : {} };
  }

  function backupFileName(d) {
    return 'caderno-de-cargas-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
  }

  const CG = { ORDER, LAST_WEEK, parse, baseList, editList, lastFor, pickStart, copyToNextWeeks, serializeBackup, parseBackup, backupFileName };
  if (typeof module !== 'undefined' && module.exports) module.exports = CG;
  else root.CG = CG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
