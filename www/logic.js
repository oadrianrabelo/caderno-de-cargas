// Lógica pura do caderno: sem DOM e sem estado global, para poder ser testada no Node.
// No navegador vira window.CG; no Node, module.exports.
(function (root) {
  const ORDER = ['upper', 'lower', 'pull', 'push', 'legs'];
  const LAST_WEEK = 12;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s, d) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } };
  const hasDoneSet = (l) => Object.values(l.ex || {}).some((x) => Object.values(x.sets || {}).some((s) => s && s.done));

  // Quando o treino foi feito, sem depender de edições feitas depois (t muda a cada alteração).
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const doneAts = (l) => {
    const a = [];
    Object.values((l && l.ex) || {}).forEach((x) => Object.values((x && x.sets) || {}).forEach((st) => { if (st && st.done && st.at) a.push(st.at); }));
    return a;
  };
  // Para ordenar os treinos: hora da última série marcada; treinos antigos (sem horário) usam a última alteração.
  function sessionTime(l) { const a = doneAts(l); return a.length ? Math.max(...a) : (l && l.t) || 0; }
  // Dia do treino (AAAA-MM-DD): data corrigida à mão > dia da primeira série marcada >
  // dia em que o treino foi aberto (treinos antigos, sem horário nas séries) > dia da última alteração.
  function sessionDay(l) {
    if (!l) return '';
    if (l.when && ISO.test(l.when)) return l.when;
    const a = doneAts(l);
    if (a.length) return isoDay(Math.min(...a));
    if (!l.skip && l.date && ISO.test(l.date) && (!l.t || l.date <= isoDay(l.t))) return l.date;
    return l.t ? isoDay(l.t) : '';
  }

  function baseList(P, w, d) { return P[w][d].map((e, i) => ({ id: 'o' + i, n: e.n, s: e.s, r: e.r, t: e.t, a: e.a })); }

  // Aquecimento, RPE e técnica da última série de um exercício. O que foi editado no exercício vale;
  // o que faltar vem dos detalhes do programa embutido (extra[semana][dia][índice], só para ids "oN").
  const DETAILS = ['aq', 'rpe', 'rpeUlt', 'tec'];
  function exDetails(ex, extra, w, d) {
    const m = /^o(\d+)$/.exec(ex.id || '');
    const base = (m && extra && extra[w] && extra[w][d] && extra[w][d][Number(m[1])]) || {};
    const out = {};
    DETAILS.forEach((k) => {
      const v = ex[k] !== undefined ? ex[k] : base[k];
      if (v !== undefined && v !== null && v !== '' && v !== 0) out[k] = v;
    });
    return out;
  }

  // Séries de aquecimento podem vir como faixa ("2-3"): mostra uma linha por série até o máximo.
  function warmCount(v) {
    const m = String(v == null ? '' : v).match(/\d+/g);
    return m ? Math.min(6, Math.max(...m.map(Number))) : 0;
  }

  // Descanso em segundos a partir do texto do programa ("2-3 min" → 120, "90 s" → 90): usa o menor valor.
  function restSeconds(t) {
    const m = String(t || '').match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return 0;
    const v = parseFloat(m[1].replace(',', '.'));
    return Math.round(/s(eg)?\b|sec/i.test(t) && !/min/i.test(t) ? v : v * 60);
  }

  // Dupla progressão: se na última vez todas as séries válidas bateram o topo da faixa de reps,
  // é hora de subir a carga. Devolve a carga sugerida para comparar ou null.
  function progressHint(lastSets, nSets, repsRange) {
    const top = (String(repsRange || '').match(/\d+/g) || []).map(Number).pop();
    if (!top || !lastSets) return null;
    // Compara com o que foi registrado da última vez (o número de séries pode mudar de um bloco para outro).
    const rec = Object.values(lastSets).filter((x) => x && (x.kg || x.reps));
    const sets = rec.filter((x) => x.done && x.reps);
    if (!sets.length || sets.length < Math.min(nSets, rec.length)) return null;
    if (!rec.every((x) => x.done && num(x.reps) >= top)) return null;
    const kg = Math.max(...sets.map((x) => num(x.kg)));
    return { top, kg };
  }

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
        if (!best || sessionTime(logs[k]) > best.t) best = { t: sessionTime(logs[k]), sets: x.sets };
      }
    }
    return best ? best.sets : null;
  }

  // Aquecimento da execução mais recente do exercício `name` que tenha aquecimento registrado (ignora `exceptKey`).
  function lastWarmFor(logs, name, exceptKey) {
    let best = null;
    for (const k in logs) {
      if (k === exceptKey || !logs[k] || !logs[k].ex) continue;
      for (const id in logs[k].ex) {
        const x = logs[k].ex[id];
        if (!x || x.used !== name || !x.warm) continue;
        if (!Object.values(x.warm).some((s) => s && (s.kg || s.reps))) continue;
        if (!best || sessionTime(logs[k]) > best.t) best = { t: sessionTime(logs[k]), warm: x.warm };
      }
    }
    return best ? best.warm : null;
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
      if (!latest || sessionTime(l) > sessionTime(latest)) latest = l;
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
    mine.sort((a, b) => sessionTime(a) - sessionTime(b));
    const done = mine.filter((l) => dayStatus(l) === 'done');
    let streak = 0;
    for (let i = mine.length - 1; i >= 0 && dayStatus(mine[i]) === 'done'; i--) streak++;
    const last = done.length ? done[done.length - 1] : null;
    return { done: done.length, skipped: mine.length - done.length, total: order.length * weeks, streak, last: last ? { t: sessionTime(last), date: sessionDay(last), week: last.week, day: last.day } : null };
  }

  // Situação de cada dia do calendário (pela data em que o treino foi feito ou pulado): 'done' vence 'skip'.
  function calendar(logs) {
    const out = {};
    for (const k in logs) {
      const l = logs[k], st = dayStatus(l);
      if (!st || !l.t) continue;
      const d = sessionDay(l);
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
        if (best) (by[x.used] = by[x.used] || []).push({ t: sessionTime(l), kg: best.kg, reps: best.reps });
      }
    }
    return Object.keys(by).map((name) => ({ name, points: by[name].sort((a, b) => a.t - b.t) }))
      .sort((a, b) => b.points[b.points.length - 1].t - a.points[a.points.length - 1].t);
  }

  // 1RM estimado (Epley): carga × (1 + reps/30). Só para comparar a evolução, não é um teste de máximo.
  function e1rm(kg, reps) {
    const k = num(kg), r = num(reps);
    if (!k || !r) return 0;
    return r === 1 ? k : Math.round(k * (1 + r / 30) * 10) / 10;
  }

  // Histórico de um exercício (pelo nome usado): sessões da mais recente para a mais antiga.
  function exerciseHistory(logs, name) {
    const out = [];
    for (const k in logs) {
      const l = logs[k];
      if (!l || !l.ex) continue;
      for (const id in l.ex) {
        const x = l.ex[id];
        if (!x || x.used !== name) continue;
        const sets = Object.keys(x.sets || {}).sort((a, b) => a - b).map((i) => x.sets[i]).filter((s) => s && (s.kg || s.reps))
          .map((s) => ({ kg: s.kg, reps: s.reps, done: !!s.done }));
        const warm = Object.keys(x.warm || {}).sort((a, b) => a - b).map((i) => x.warm[i]).filter((s) => s && (s.kg || s.reps))
          .map((s) => ({ kg: s.kg, reps: s.reps }));
        if (!sets.length && !warm.length) continue;
        out.push({ t: sessionTime(l), date: sessionDay(l), week: l.week, day: l.day, sets, warm, best: sets.length ? Math.max(...sets.map((s) => e1rm(s.kg, s.reps))) : 0, note: l.note || '', energy: l.energy || 0 });
      }
    }
    return out.sort((a, b) => b.t - a.t);
  }

  // Duração da sessão em minutos: da primeira à última série marcada (precisa de duas marcações).
  function sessionDuration(doc) {
    const ts = [];
    Object.values((doc && doc.ex) || {}).forEach((x) => Object.values(x.sets || {}).forEach((s) => { if (s && s.done && s.at) ts.push(s.at); }));
    if (ts.length < 2) return null;
    return Math.max(1, Math.round((Math.max(...ts) - Math.min(...ts)) / 60000));
  }

  // Recorde: a série supera a maior carga ou o maior 1RM estimado de todas as outras sessões do exercício.
  // Sem nenhuma sessão anterior não há recorde (a primeira vez não conta).
  function isRecord(logs, name, exceptKey, kg, reps) {
    let maxKg = 0, maxE = 0, any = false;
    for (const k in logs) {
      if (k === exceptKey || !logs[k] || !logs[k].ex) continue;
      for (const id in logs[k].ex) {
        const x = logs[k].ex[id];
        if (!x || x.used !== name) continue;
        Object.values(x.sets || {}).forEach((s) => {
          if (!s || !s.done || !num(s.kg)) return;
          any = true; maxKg = Math.max(maxKg, num(s.kg)); maxE = Math.max(maxE, e1rm(s.kg, s.reps));
        });
      }
    }
    if (!any || !num(kg)) return null;
    const byKg = num(kg) > maxKg, byE = e1rm(kg, reps) > maxE;
    return byKg || byE ? { kg: byKg, e1rm: byE } : null;
  }

  // Anilhas por lado para chegar na carga total, com a barra e as anilhas disponíveis (gulosa, da maior para a menor).
  function plates(total, bar, available) {
    const per = (num(total) - num(bar)) / 2;
    if (!(per > 0)) return { side: [], rest: Math.max(0, Math.round(per * 100) / 100), ok: per === 0 };
    const side = [];
    let left = Math.round(per * 100) / 100;
    available.slice().sort((a, b) => b - a).forEach((p) => { while (left + 1e-9 >= p) { side.push(p); left = Math.round((left - p) * 100) / 100; } });
    return { side, rest: left, ok: left === 0 };
  }

  // Carga sugerida para a próxima vez (dupla progressão): última carga + incremento, no começo da faixa de reps.
  function suggestNext(hint, repsRange, inc) {
    if (!hint || !hint.kg) return null;
    const low = (String(repsRange || '').match(/\d+/g) || []).map(Number)[0] || '';
    return { kg: Math.round((hint.kg + (num(inc) || 2.5)) * 100) / 100, reps: low };
  }

  // Segunda-feira 00:00 da semana de `t` (horário local).
  function weekStart(t) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  }

  // Resumo da semana do calendário (segunda a domingo): treinos, séries, volume, recordes e energia média.
  function weekSummary(logs, now) {
    const a = weekStart(now), z = a + 7 * 86400000;
    const all = Object.keys(logs).map((k) => [k, logs[k]]).filter(([, l]) => l && l.t && l.ex);
    let sessions = 0, sets = 0, vol = 0, records = 0;
    const energy = [];
    all.forEach(([k, l]) => {
      const day = sessionDay(l);
      if (day < isoDay(a) || day > isoDay(z - 1) || dayStatus(l) !== 'done') return;
      sessions++;
      if (l.energy) energy.push(l.energy);
      // Recordes contra as sessões anteriores a esta.
      const before = {};
      all.forEach(([k2, l2]) => { if (k2 !== k && sessionTime(l2) < sessionTime(l)) before[k2] = l2; });
      Object.values(l.ex).forEach((x) => Object.values((x && x.sets) || {}).forEach((st) => {
        if (!st || !st.done) return;
        sets++; vol += num(st.kg) * num(st.reps);
        if (isRecord(before, x.used, k, st.kg, st.reps)) records++;
      }));
    });
    return { start: a, sessions, sets, volume: Math.round(vol), records, energy: energy.length ? Math.round((energy.reduce((p, c) => p + c, 0) / energy.length) * 10) / 10 : 0 };
  }

  // Anotação da última vez que esse mesmo dia foi treinado (outra semana), para lembrar ajustes.
  function lastNote(logs, day, exceptKey) {
    let best = null;
    for (const k in logs) {
      const l = logs[k];
      if (k === exceptKey || !l || l.day !== day || !(l.note || l.energy) || !l.t) continue;
      if (!best || sessionTime(l) > best.t) best = { t: sessionTime(l), week: l.week, note: l.note || '', energy: l.energy || 0 };
    }
    return best;
  }

  // Volume (kg × reps das séries feitas) por semana do programa em uso.
  function volumeByWeek(logs, order = ORDER, weeks = LAST_WEEK) {
    const out = Array.from({ length: weeks }, () => 0);
    Object.values(logs).forEach((l) => {
      if (!l || !l.ex || order.indexOf(l.day) < 0 || !(l.week >= 1 && l.week <= weeks)) return;
      Object.values(l.ex).forEach((x) => Object.values((x && x.sets) || {}).forEach((s) => { if (s && s.done) out[l.week - 1] += num(s.kg) * num(s.reps); }));
    });
    return out.map(Math.round);
  }

  // Variação escolhida da última vez para esse exercício do dia (mesmo id), se ainda for uma opção válida.
  function preferredVariant(logs, day, exId, options, exceptKey) {
    let best = null;
    for (const k in logs) {
      const l = logs[k];
      if (k === exceptKey || !l || l.day !== day || !l.ex || !l.ex[exId] || !l.t) continue;
      const x = l.ex[exId];
      if (!x.used || !Object.values(x.sets || {}).some((s) => s && (s.kg || s.reps))) continue;
      if (!best || sessionTime(l) > best.t) best = { t: sessionTime(l), used: x.used };
    }
    return best && options.indexOf(best.used) >= 0 ? best.used : null;
  }

  // Planilha CSV (separador ";" e BOM, para o Excel em português abrir certo): uma linha por série registrada.
  function toCSV(logs, names) {
    const q = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['data', 'semana', 'dia', 'exercicio', 'tipo', 'serie', 'kg', 'reps', 'feita', 'energia', 'anotacao']];
    Object.values(logs).filter((l) => l && l.ex && l.t).sort((a, b) => sessionTime(a) - sessionTime(b)).forEach((l) => {
      const d = sessionDay(l), dn = (names && names[l.day]) || l.day;
      let first = true;
      Object.values(l.ex).forEach((x) => {
        if (!x) return;
        const add = (tipo, sets) => Object.keys(sets || {}).sort((a, b) => a - b).forEach((i) => {
          const s = sets[i];
          if (!s || !(s.kg || s.reps)) return;
          rows.push([d, l.week, dn, x.used, tipo, Number(i) + 1, String(s.kg || '').replace('.', ','), s.reps || '', tipo === 'aquecimento' ? '' : s.done ? 'sim' : 'não', first ? l.energy || '' : '', first ? l.note || '' : '']);
          first = false;
        });
        add('aquecimento', x.warm);
        add('valida', x.sets);
      });
    });
    return '\ufeff' + rows.map((r) => r.map(q).join(';')).join('\r\n') + '\r\n';
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

  function serializeBackup(logs, custom, programs, extra) {
    const o = { v: 1, logs, custom };
    if (programs && programs.list && Object.keys(programs.list).length) o.programs = programs;
    if (extra && Object.keys(extra).length) o.extra = extra;
    return JSON.stringify(o);
  }

  // Arquivo de detalhes do programa (aquecimento, RPE, técnica) importado pelo usuário. Fica só no aparelho.
  function parseDetails(text) {
    const o = parse(text, null);
    return o && o.type === 'caderno-detalhes' && o.extra && typeof o.extra === 'object' ? o.extra : null;
  }

  // Lê um backup. Importar substitui os dados atuais (não mescla). Devolve null se o arquivo for inválido.
  // `programs` vem null quando o backup não tem programas próprios (backups antigos).
  function parseBackup(text) {
    const o = parse(text, null);
    if (!o || !o.logs || typeof o.logs !== 'object' || Array.isArray(o.logs)) return null;
    const programs = o.programs && typeof o.programs === 'object' && o.programs.list && typeof o.programs.list === 'object' ? o.programs : null;
    const extra = o.extra && typeof o.extra === 'object' ? o.extra : null;
    return { logs: o.logs, custom: o.custom && typeof o.custom === 'object' ? o.custom : {}, programs, extra };
  }

  function backupFileName(d) {
    return 'caderno-de-cargas-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
  }

  const CG = { ORDER, LAST_WEEK, parse, baseList, exDetails, warmCount, lastWarmFor, sessionTime, sessionDay, restSeconds, progressHint, editList, lastFor, dayStatus, nextDay, pickStart, copyToNextWeeks, isoDay, summarize, calendar, exerciseProgress, e1rm, exerciseHistory, sessionDuration, isRecord, plates, suggestNext, weekStart, weekSummary, lastNote, volumeByWeek, preferredVariant, toCSV, newId, makeProgram, serializeBackup, parseBackup, parseDetails, backupFileName };
  if (typeof module !== 'undefined' && module.exports) module.exports = CG;
  else root.CG = CG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
