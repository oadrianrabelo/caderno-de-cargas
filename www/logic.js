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

  // Um treino conta como "feito" com pelo menos uma série marcada; "pulado" quando o usuário pulou.
  const dayStatus = (l) => (!l ? '' : hasDoneSet(l) ? 'done' : l.skip ? 'skip' : '');

  // Dia seguinte na ordem do programa; depois do último dia vai para a semana seguinte (até a última).
  function nextDay(week, day, order = ORDER, lastWeek = LAST_WEEK) {
    const idx = order.indexOf(day);
    if (idx < order.length - 1) return { week, day: order[idx + 1] };
    return { week: Math.min(lastWeek, week + 1), day: order[0] };
  }

  // Próximo treino depois do último feito ou pulado (do programa em uso), ou null se ainda não há nenhum.
  function pickStart(logs, order = ORDER, lastWeek = LAST_WEEK) {
    let latest = null;
    for (const k in logs) {
      const l = logs[k];
      if (!l || !l.t || !dayStatus(l) || order.indexOf(l.day) < 0) continue;
      if (!latest || l.t > latest.t) latest = l;
    }
    return latest ? nextDay(latest.week, latest.day, order, lastWeek) : null;
  }

  // Copia a lista do dia para o mesmo dia de todas as semanas seguintes.
  function copyToNextWeeks(custom, list, week, day, lastWeek = LAST_WEEK) {
    const src = clone(list);
    for (let w = week + 1; w <= lastWeek; w++) custom[w + '-' + day] = clone(src);
    return custom;
  }

  // Data local (AAAA-MM-DD) de um timestamp.
  function isoDay(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Resumo do programa: treinos feitos, pulados, total previsto, último treino e sequência atual sem pular.
  function summarize(logs, order = ORDER, weeks = LAST_WEEK) {
    const mine = Object.values(logs).filter((l) => l && l.t && order.indexOf(l.day) >= 0 && l.week >= 1 && l.week <= weeks && dayStatus(l));
    mine.sort((a, b) => a.t - b.t);
    const done = mine.filter((l) => dayStatus(l) === 'done');
    let streak = 0;
    for (let i = mine.length - 1; i >= 0 && dayStatus(mine[i]) === 'done'; i--) streak++;
    const last = done.length ? done[done.length - 1] : null;
    return { done: done.length, skipped: mine.length - done.length, total: order.length * weeks, streak, last: last ? { t: last.t, week: last.week, day: last.day } : null };
  }

  // Situação de cada dia do calendário (pela data em que o treino foi feito ou pulado): 'done' vence 'skip'.
  function calendar(logs) {
    const out = {};
    for (const k in logs) {
      const l = logs[k], st = dayStatus(l);
      if (!st || !l.t) continue;
      const d = isoDay(l.t);
      if (out[d] !== 'done') out[d] = st;
    }
    return out;
  }

  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };

  // Evolução por exercício (nome usado): a melhor série (maior carga, depois mais reps) de cada treino.
  function exerciseProgress(logs) {
    const by = {};
    for (const k in logs) {
      const l = logs[k];
      if (!l || !l.ex) continue;
      for (const id in l.ex) {
        const x = l.ex[id];
        if (!x || !x.used) continue;
        let best = null;
        for (const s of Object.values(x.sets || {})) {
          if (!s || !(s.kg || s.reps)) continue;
          const p = { kg: num(s.kg), reps: num(s.reps) };
          if (!best || p.kg > best.kg || (p.kg === best.kg && p.reps > best.reps)) best = p;
        }
        if (best) (by[x.used] = by[x.used] || []).push({ t: l.t || 0, kg: best.kg, reps: best.reps });
      }
    }
    return Object.keys(by).map((name) => ({ name, points: by[name].sort((a, b) => a.t - b.t) }))
      .sort((a, b) => b.points[b.points.length - 1].t - a.points[a.points.length - 1].t);
  }

  // Programa próprio: dias com nome e uma lista de exercícios que vale para todas as semanas.
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function makeProgram(name, weeks, dayNames, template) {
    const days = dayNames.map((n, i) => ({
      id: newId('d'), name: n,
      ex: template && template[i] ? clone(template[i]).map((e) => Object.assign(e, { id: newId('e') })) : []
    }));
    return { id: newId('p'), name, weeks: Math.max(1, Math.min(52, Math.round(weeks) || 1)), days };
  }

  function serializeBackup(logs, custom, programs) {
    const o = { v: 1, logs, custom };
    if (programs && programs.list && Object.keys(programs.list).length) o.programs = programs;
    return JSON.stringify(o);
  }

  // Lê um backup. Importar substitui os dados atuais (não mescla). Devolve null se o arquivo for inválido.
  // `programs` vem null quando o backup não tem programas próprios (backups antigos).
  function parseBackup(text) {
    const o = parse(text, null);
    if (!o || typeof o.logs !== 'object') return null;
    const programs = o.programs && typeof o.programs === 'object' && o.programs.list && typeof o.programs.list === 'object' ? o.programs : null;
    return { logs: o.logs, custom: o.custom && typeof o.custom === 'object' ? o.custom : {}, programs };
  }

  function backupFileName(d) {
    return 'caderno-de-cargas-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
  }

  const CG = { ORDER, LAST_WEEK, parse, baseList, editList, lastFor, dayStatus, nextDay, pickStart, copyToNextWeeks, isoDay, summarize, calendar, exerciseProgress, newId, makeProgram, serializeBackup, parseBackup, backupFileName };
  if (typeof module !== 'undefined' && module.exports) module.exports = CG;
  else root.CG = CG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
