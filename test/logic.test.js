const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CG = require('../www/logic.js');

// Programa real embutido no HTML.
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const P = JSON.parse(html.match(/^const P = (\{.*\});$/m)[1]);

const set = (kg, reps, done = true) => ({ kg, reps, done });
const log = (week, day, t, ex) => ({ week, day, date: '2026-01-01', t, ex });

test('pickStart: sem treinos feitos não muda o dia', () => {
  assert.equal(CG.pickStart({}), null);
  // Campos preenchidos, mas nenhuma série marcada como feita.
  assert.equal(CG.pickStart({ '1-upper': log(1, 'upper', 10, { o0: { used: 'A', sets: { 0: set('50', '8', false) } } }) }), null);
});

test('pickStart: vai para o dia seguinte do treino mais recente', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'A', sets: { 0: set('50', '8') } } }),
    '1-lower': log(1, 'lower', 200, { o0: { used: 'B', sets: { 0: set('80', '6') } } }),
  };
  assert.deepEqual(CG.pickStart(logs), { week: 1, day: 'pull' });
});

test('pickStart: depois de Legs passa para Upper da semana seguinte, até a semana 12', () => {
  const legs = (w) => ({ [w + '-legs']: log(w, 'legs', 5, { o0: { used: 'C', sets: { 1: set('', '', true) } } }) });
  assert.deepEqual(CG.pickStart(legs(3)), { week: 4, day: 'upper' });
  assert.deepEqual(CG.pickStart(legs(12)), { week: 12, day: 'upper' });
});

test('pickStart: ignora treinos sem timestamp e entradas vazias', () => {
  const logs = {
    '2-push': log(2, 'push', 0, { o0: { used: 'A', sets: { 0: set('1', '1') } } }),
    '1-pull': log(1, 'pull', 50, { o0: { used: 'A', sets: { 0: set('1', '1') } } }),
    'lixo': null,
  };
  assert.deepEqual(CG.pickStart(logs), { week: 1, day: 'push' });
});

test('lastFor: repete a carga da execução mais recente do mesmo exercício', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'Supino', sets: { 0: set('60', '8'), 1: set('60', '7') } } }),
    '2-upper': log(2, 'upper', 300, { o0: { used: 'Supino', sets: { 0: set('62.5', '8') } } }),
    '1-push': log(1, 'push', 200, { o3: { used: 'Supino', sets: { 0: set('61', '6') } } }),
    '3-upper': log(3, 'upper', 400, { o0: { used: 'Supino', sets: {} } }),
  };
  assert.deepEqual(CG.lastFor(logs, 'Supino', '3-upper'), { 0: set('62.5', '8') });
  // Excluindo o treino atual, usa o anterior mais recente.
  assert.deepEqual(CG.lastFor(logs, 'Supino', '2-upper'), { 0: set('61', '6') });
});

test('lastFor: considera a variação escolhida (used) e ignora séries vazias', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'Supino Halter', sets: { 0: set('24', '10') } } }),
    '2-upper': log(2, 'upper', 200, { o0: { used: 'Supino Halter', sets: { 0: set('', '', true) } } }),
  };
  assert.deepEqual(CG.lastFor(logs, 'Supino Halter', 'x'), { 0: set('24', '10') });
  assert.equal(CG.lastFor(logs, 'Supino Reto', 'x'), null);
});

test('baseList: monta o dia a partir do programa embutido', () => {
  const l = CG.baseList(P, 1, 'upper');
  assert.equal(l[0].id, 'o0');
  assert.equal(l[0].n, '45° Incline Barbell Press');
  assert.deepEqual(Object.keys(l[0]), ['id', 'n', 's', 'r', 't', 'a']);
  assert.equal(l.length, P[1].upper.length);
});

test('editList: cria a cópia editável só uma vez', () => {
  const custom = {};
  const a = CG.editList(custom, P, 2, 'pull');
  a[0].n = 'Remada Curvada';
  const b = CG.editList(custom, P, 2, 'pull');
  assert.equal(b, a);
  assert.equal(custom['2-pull'][0].n, 'Remada Curvada');
  assert.notEqual(P[2].pull[0].n, 'Remada Curvada');
});

test('copyToNextWeeks: copia o dia para as semanas seguintes, sem compartilhar referência', () => {
  const custom = { '1-push': [{ id: 'x', n: 'Antigo' }] };
  const list = CG.editList(custom, P, 10, 'legs');
  list.splice(1, 1);
  CG.copyToNextWeeks(custom, list, 10, 'legs');
  assert.deepEqual(custom['11-legs'], list);
  assert.deepEqual(custom['12-legs'], list);
  assert.equal(custom['13-legs'], undefined);
  assert.equal(custom['9-legs'], undefined);
  assert.deepEqual(custom['1-push'], [{ id: 'x', n: 'Antigo' }]);
  custom['11-legs'][0].n = 'Mudado';
  assert.notEqual(custom['12-legs'][0].n, 'Mudado');
  assert.notEqual(list[0].n, 'Mudado');
});

test('copyToNextWeeks: na semana 12 não copia nada', () => {
  const custom = {};
  CG.copyToNextWeeks(custom, [{ id: 'a' }], 12, 'upper');
  assert.deepEqual(custom, {});
});

test('backup: exportar e importar devolve os mesmos dados', () => {
  const logs = { '1-upper': log(1, 'upper', 1, { o0: { used: 'A', sets: { 0: set('10', '5') } } }) };
  const custom = { '1-upper': [{ id: 'o0', n: 'A', s: 1, r: '5', t: '1 min', a: [] }] };
  const txt = CG.serializeBackup(logs, custom);
  assert.equal(JSON.parse(txt).v, 1);
  assert.deepEqual(CG.parseBackup(txt), { logs, custom, programs: null, extra: null });
});

test('backup: importar substitui os dados e tolera custom ausente', () => {
  assert.deepEqual(CG.parseBackup('{"v":1,"logs":{"a":1}}'), { logs: { a: 1 }, custom: {}, programs: null, extra: null });
  assert.deepEqual(CG.parseBackup('{"logs":{},"custom":"x"}'), { logs: {}, custom: {}, programs: null, extra: null });
});

test('backup: rejeita arquivos inválidos', () => {
  assert.equal(CG.parseBackup('não é json'), null);
  assert.equal(CG.parseBackup('[]'), null);
  assert.equal(CG.parseBackup('{"custom":{}}'), null);
  assert.equal(CG.parseBackup('{"logs":"texto"}'), null);
  assert.equal(CG.parseBackup('42'), null);
});

test('backupFileName: usa a data local', () => {
  assert.equal(CG.backupFileName(new Date(2026, 0, 5)), 'caderno-de-cargas-2026-01-05.json');
});

const skipped = (week, day, t) => ({ week, day, date: '2026-01-01', t, ex: {}, skip: true });

test('pular: um treino pulado conta para escolher o próximo dia', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'A', sets: { 0: set('50', '8') } } }),
    '1-lower': skipped(1, 'lower', 200),
  };
  assert.deepEqual(CG.pickStart(logs), { week: 1, day: 'pull' });
  assert.equal(CG.dayStatus(logs['1-lower']), 'skip');
  assert.equal(CG.dayStatus(logs['1-upper']), 'done');
  // Se depois treinou o dia que tinha pulado, conta como feito.
  logs['1-lower'].ex = { o0: { used: 'B', sets: { 0: set('80', '6') } } };
  assert.equal(CG.dayStatus(logs['1-lower']), 'done');
});

test('programa próprio: próximo dia segue a ordem e o número de semanas do programa', () => {
  const order = ['dA', 'dB', 'dC'];
  const logs = {
    '1-upper': log(1, 'upper', 999, { o0: { used: 'A', sets: { 0: set('1', '1') } } }), // de outro programa
    '2-dC': log(2, 'dC', 50, { e1: { used: 'Agacho', sets: { 0: set('100', '5') } } }),
  };
  assert.deepEqual(CG.pickStart(logs, order, 4), { week: 3, day: 'dA' });
  assert.deepEqual(CG.nextDay(4, 'dC', order, 4), { week: 4, day: 'dA' });
  assert.deepEqual(CG.nextDay(1, 'dA', order, 4), { week: 1, day: 'dB' });
});

test('copyToNextWeeks: respeita o número de semanas do programa', () => {
  const custom = {};
  CG.copyToNextWeeks(custom, [{ id: 'a' }], 2, 'dA', 4);
  assert.deepEqual(Object.keys(custom), ['3-dA', '4-dA']);
});

test('summarize: feitos, pulados, total, último treino e sequência sem pular', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'A', sets: { 0: set('50', '8') } } }),
    '1-lower': skipped(1, 'lower', 200),
    '1-pull': log(1, 'pull', 300, { o0: { used: 'C', sets: { 0: set('40', '10') } } }),
    '1-push': log(1, 'push', 400, { o0: { used: 'D', sets: { 0: set('30', '10') } } }),
    '1-legs': log(1, 'legs', 0, {}), // só aberto, sem nada feito
  };
  assert.deepEqual(CG.summarize(logs), { done: 3, skipped: 1, total: 60, streak: 2, last: { t: 400, week: 1, day: 'push' } });
  assert.deepEqual(CG.summarize({}), { done: 0, skipped: 0, total: 60, streak: 0, last: null });
});

test('calendar: marca os dias treinados e pulados pela data local', () => {
  const d1 = new Date(2026, 9, 26, 18, 0).getTime(), d2 = new Date(2026, 9, 27, 7, 0).getTime();
  const logs = {
    a: log(1, 'upper', d1, { o0: { used: 'A', sets: { 0: set('50', '8') } } }),
    b: skipped(1, 'lower', d1 + 1000),
    c: skipped(1, 'pull', d2),
  };
  assert.deepEqual(CG.calendar(logs), { '2026-10-26': 'done', '2026-10-27': 'skip' });
});

test('exerciseProgress: melhor série de cada treino, em ordem, aceitando vírgula', () => {
  const logs = {
    a: log(1, 'upper', 100, { o0: { used: 'Supino', sets: { 0: set('60', '8'), 1: set('62,5', '6') } } }),
    b: log(2, 'upper', 300, { o0: { used: 'Supino', sets: { 0: set('62.5', '8') } }, o1: { used: 'Remada', sets: { 0: set('', '', false) } } }),
    c: log(1, 'pull', 200, { o2: { used: 'Barra', sets: { 0: set('', '10') } } }),
  };
  assert.deepEqual(CG.exerciseProgress(logs), [
    { name: 'Supino', points: [{ t: 100, kg: 62.5, reps: 6 }, { t: 300, kg: 62.5, reps: 8 }] },
    { name: 'Barra', points: [{ t: 200, kg: 0, reps: 10 }] },
  ]);
});

test('makeProgram: dias com ids únicos e exercícios copiados com ids novos', () => {
  const tpl = [CG.baseList(P, 1, 'upper'), []];
  const p = CG.makeProgram('Meu ABC', 8.4, ['Peito', 'Costas'], tpl);
  assert.equal(p.name, 'Meu ABC');
  assert.equal(p.weeks, 8);
  assert.deepEqual(p.days.map((d) => d.name), ['Peito', 'Costas']);
  assert.notEqual(p.days[0].id, p.days[1].id);
  assert.equal(p.days[0].ex.length, tpl[0].length);
  assert.equal(p.days[0].ex[0].n, tpl[0][0].n);
  assert.notEqual(p.days[0].ex[0].id, tpl[0][0].id);
  assert.equal(new Set(p.days[0].ex.map((e) => e.id)).size, tpl[0].length);
  assert.deepEqual(p.days[1].ex, []);
  assert.equal(CG.makeProgram('x', 0, ['a']).weeks, 1);
  assert.equal(CG.makeProgram('x', 99, ['a']).weeks, 52);
});

test('backup: leva e traz os programas próprios', () => {
  const programs = { active: 'p1', list: { p1: { id: 'p1', name: 'Meu', weeks: 4, days: [] } } };
  const txt = CG.serializeBackup({}, {}, programs);
  assert.deepEqual(CG.parseBackup(txt).programs, programs);
  assert.equal(JSON.parse(CG.serializeBackup({}, {}, { list: {} })).programs, undefined);
  assert.equal(CG.parseBackup('{"logs":{},"programs":"x"}').programs, null);
});

test('exDetails: usa o que foi editado e completa com os detalhes do programa', () => {
  const extra = { 1: { upper: [{ aq: 2, rpe: '7-8', rpeUlt: '9-10', tec: 'falha' }, { aq: 1 }] } };
  assert.deepEqual(CG.exDetails({ id: 'o0' }, extra, 1, 'upper'), { aq: 2, rpe: '7-8', rpeUlt: '9-10', tec: 'falha' });
  assert.deepEqual(CG.exDetails({ id: 'o0', tec: 'llp', aq: 0 }, extra, 1, 'upper'), { rpe: '7-8', rpeUlt: '9-10', tec: 'llp' });
  assert.deepEqual(CG.exDetails({ id: 'o1', rpeUlt: '10' }, extra, 1, 'upper'), { aq: 1, rpeUlt: '10' });
  // Exercício criado pelo usuário não herda nada do programa.
  assert.deepEqual(CG.exDetails({ id: 'n123' }, extra, 1, 'upper'), {});
  assert.deepEqual(CG.exDetails({ id: 'o0' }, {}, 2, 'pull'), {});
  assert.deepEqual(CG.exDetails({ id: 'o0', rpe: '' }, undefined, 1, 'upper'), {});
});

test('warmCount: aceita número ou faixa e usa o máximo', () => {
  assert.equal(CG.warmCount('2-3'), 3);
  assert.equal(CG.warmCount('1'), 1);
  assert.equal(CG.warmCount(2), 2);
  assert.equal(CG.warmCount(''), 0);
  assert.equal(CG.warmCount(undefined), 0);
  assert.equal(CG.warmCount('99'), 6);
});

test('detalhes do programa: arquivo próprio, separado do backup, e incluído no backup', () => {
  const extra = { 1: { upper: [{ aq: '2-3' }] } };
  assert.deepEqual(CG.parseDetails(JSON.stringify({ type: 'caderno-detalhes', v: 1, extra })), extra);
  assert.equal(CG.parseDetails(JSON.stringify({ v: 1, logs: {} })), null);
  assert.equal(CG.parseDetails('lixo'), null);
  const txt = CG.serializeBackup({}, {}, null, extra);
  assert.deepEqual(CG.parseBackup(txt).extra, extra);
  assert.equal(JSON.parse(CG.serializeBackup({}, {}, null, {})).extra, undefined);
});

test('backup: logs nulo ou lista é inválido (travava o app no HTML original)', () => {
  assert.equal(CG.parseBackup('{"logs":null}'), null);
  assert.equal(CG.parseBackup('{"logs":[]}'), null);
});

test('restSeconds: usa o menor valor do descanso', () => {
  assert.equal(CG.restSeconds('3-5 min'), 180);
  assert.equal(CG.restSeconds('1-2 min'), 60);
  assert.equal(CG.restSeconds('2 min'), 120);
  assert.equal(CG.restSeconds('1,5 min'), 90);
  assert.equal(CG.restSeconds('90 s'), 90);
  assert.equal(CG.restSeconds('45 seg'), 45);
  assert.equal(CG.restSeconds(''), 0);
  assert.equal(CG.restSeconds(undefined), 0);
});

test('progressHint: sugere subir a carga só se todas as séries bateram o topo das reps', () => {
  const s = (kg, reps, done = true) => ({ kg, reps, done });
  assert.deepEqual(CG.progressHint({ 0: s('60', '8'), 1: s('60', '8') }, 2, '6-8'), { top: 8, kg: 60 });
  assert.deepEqual(CG.progressHint({ 0: s('62,5', '10'), 1: s('60', '9') }, 2, '8-10'), null);
  // Série não marcada como feita não conta.
  assert.equal(CG.progressHint({ 0: s('60', '8'), 1: s('60', '8', false) }, 2, '6-8'), null);
  // Programa passou de 2 para 3 séries: vale o que foi registrado da última vez.
  assert.deepEqual(CG.progressHint({ 0: s('60', '8'), 1: s('60', '8') }, 3, '6-8'), { top: 8, kg: 60 });
  // Uma série registrada abaixo do topo impede a dica.
  assert.equal(CG.progressHint({ 0: s('60', '8'), 1: s('60', '7') }, 3, '6-8'), null);
  assert.equal(CG.progressHint(null, 2, '6-8'), null);
  assert.equal(CG.progressHint({ 0: s('60', '8') }, 1, ''), null);
  assert.deepEqual(CG.progressHint({ 0: s('20', '20') }, 1, '10-20'), { top: 20, kg: 20 });
});

test('e1rm: estimativa de Epley', () => {
  assert.equal(CG.e1rm('100', '10'), 133.3);
  assert.equal(CG.e1rm('60', '1'), 60);
  assert.equal(CG.e1rm('62,5', '8'), 79.2);
  assert.equal(CG.e1rm('', '8'), 0);
});

test('exerciseHistory: sessões do exercício, mais recente primeiro, com séries em ordem', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'Supino', sets: { 1: set('60', '7'), 0: set('60', '8') } } }),
    '2-upper': log(2, 'upper', 300, { o0: { used: 'Supino', sets: { 0: set('62.5', '8', false) } } }),
    '1-push': log(1, 'push', 200, { o0: { used: 'Outro', sets: { 0: set('10', '10') } } }),
    '3-upper': log(3, 'upper', 400, { o0: { used: 'Supino', sets: {} } }),
  };
  const h = CG.exerciseHistory(logs, 'Supino');
  assert.deepEqual(h.map((x) => x.week), [2, 1]);
  assert.deepEqual(h[1].sets, [{ kg: '60', reps: '8', done: true }, { kg: '60', reps: '7', done: true }]);
  assert.equal(h[1].best, 76);
  assert.equal(h[1].note, '');
  assert.equal(h[0].sets[0].done, false);
  assert.deepEqual(CG.exerciseHistory(logs, 'Nada'), []);
});

test('sessionDuration: da primeira à última série marcada', () => {
  const at = (m) => 1000000 + m * 60000;
  const doc = { ex: { a: { sets: { 0: { done: true, at: at(0) }, 1: { done: true, at: at(12) } } }, b: { sets: { 0: { done: true, at: at(47) }, 1: { done: false, at: at(90) } } } } };
  assert.equal(CG.sessionDuration(doc), 47);
  assert.equal(CG.sessionDuration({ ex: { a: { sets: { 0: { done: true, at: at(0) } } } } }), null);
  assert.equal(CG.sessionDuration(null), null);
});

test('isRecord: supera carga ou 1RM das outras sessões; primeira vez não conta', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'Supino', sets: { 0: set('60', '8'), 1: set('70', '2', false) } } }),
    '2-upper': log(2, 'upper', 200, { o0: { used: 'Supino', sets: {} } }),
  };
  assert.deepEqual(CG.isRecord(logs, 'Supino', '2-upper', '62.5', '8'), { kg: true, e1rm: true });
  assert.deepEqual(CG.isRecord(logs, 'Supino', '2-upper', '60', '10'), { kg: false, e1rm: true });
  assert.equal(CG.isRecord(logs, 'Supino', '2-upper', '60', '8'), null);
  assert.equal(CG.isRecord(logs, 'Supino', '2-upper', '50', '8'), null);
  // Série não feita da outra sessão não conta como marca anterior.
  assert.equal(CG.isRecord(logs, 'Outro', '2-upper', '100', '5'), null);
  assert.equal(CG.isRecord({}, 'Supino', 'x', '60', '8'), null);
});

test('plates: anilhas por lado', () => {
  const P = [25, 20, 15, 10, 5, 2.5, 1.25];
  assert.deepEqual(CG.plates(100, 20, P), { side: [25, 15], rest: 0, ok: true });
  assert.deepEqual(CG.plates(62.5, 20, P), { side: [20, 1.25], rest: 0, ok: true });
  assert.deepEqual(CG.plates(61, 20, P), { side: [20], rest: 0.5, ok: false });
  assert.deepEqual(CG.plates(20, 20, P), { side: [], rest: 0, ok: true });
  assert.deepEqual(CG.plates(15, 20, P).ok, false);
  assert.deepEqual(CG.plates(60, 20, [10, 5]), { side: [10, 10], rest: 0, ok: true });
});

test('suggestNext: última carga + incremento, no começo da faixa', () => {
  assert.deepEqual(CG.suggestNext({ top: 8, kg: 60 }, '6-8', 2.5), { kg: 62.5, reps: 6 });
  assert.deepEqual(CG.suggestNext({ top: 12, kg: 20 }, '10-12', '1'), { kg: 21, reps: 10 });
  assert.deepEqual(CG.suggestNext({ top: 8, kg: 60 }, '6-8'), { kg: 62.5, reps: 6 });
  assert.equal(CG.suggestNext(null, '6-8', 2.5), null);
  assert.equal(CG.suggestNext({ top: 15, kg: 0 }, '12-15', 2.5), null);
});

test('weekSummary: só a semana atual (segunda a domingo), com recordes contra sessões anteriores', () => {
  const wed = new Date(2026, 10, 4, 18).getTime(); // quarta 04/11/2026
  const mon = new Date(2026, 10, 2, 7).getTime(), lastSun = new Date(2026, 10, 1, 20).getTime();
  const logs = {
    '1-upper': Object.assign(log(1, 'upper', lastSun, { o0: { used: 'Supino', sets: { 0: set('60', '8') } } }), { energy: 1 }),
    '1-lower': Object.assign(log(1, 'lower', mon, { o0: { used: 'Agacho', sets: { 0: set('100', '5') } } }), { energy: 4 }),
    '1-pull': Object.assign(log(1, 'pull', wed, { o0: { used: 'Supino', sets: { 0: set('62.5', '8'), 1: set('50', '10') } } }), { energy: 5 }),
    '1-push': Object.assign(log(1, 'push', wed + 1000, {}), { skip: true }),
  };
  assert.equal(CG.weekStart(wed), new Date(2026, 10, 2).getTime());
  assert.deepEqual(CG.weekSummary(logs, wed), { start: new Date(2026, 10, 2).getTime(), sessions: 2, sets: 3, volume: 500 + 500 + 500, records: 1, energy: 4.5 });
});

test('lastNote: anotação da última vez desse dia, ignorando o treino atual', () => {
  const logs = {
    '1-upper': Object.assign(log(1, 'upper', 100, {}), { note: 'banco 4' }),
    '2-upper': Object.assign(log(2, 'upper', 300, {}), { energy: 3 }),
    '3-upper': Object.assign(log(3, 'upper', 500, {}), { note: 'agora' }),
    '2-lower': Object.assign(log(2, 'lower', 400, {}), { note: 'outro dia' }),
  };
  assert.deepEqual(CG.lastNote(logs, 'upper', '3-upper'), { t: 300, week: 2, note: '', energy: 3 });
  delete logs['2-upper'].energy;
  assert.deepEqual(CG.lastNote(logs, 'upper', '3-upper'), { t: 100, week: 1, note: 'banco 4', energy: 0 });
  assert.equal(CG.lastNote(logs, 'legs', 'x'), null);
});

test('volumeByWeek: soma kg × reps das séries feitas por semana do programa', () => {
  const logs = {
    '1-upper': log(1, 'upper', 1, { o0: { used: 'A', sets: { 0: set('60', '8'), 1: set('60', '8', false) } } }),
    '1-lower': log(1, 'lower', 2, { o0: { used: 'B', sets: { 0: set('100', '5') } } }),
    '3-push': log(3, 'push', 3, { o0: { used: 'C', sets: { 0: set('20,5', '10') } } }),
    '2-dX': log(2, 'dX', 4, { o0: { used: 'D', sets: { 0: set('999', '1') } } }), // outro programa
  };
  assert.deepEqual(CG.volumeByWeek(logs, CG.ORDER, 4), [980, 0, 205, 0]);
});

test('preferredVariant: lembra a substituição usada da última vez no mesmo exercício do dia', () => {
  const logs = {
    '1-upper': log(1, 'upper', 100, { o0: { used: 'Halter', sets: { 0: set('20', '10') } } }),
    '2-upper': log(2, 'upper', 200, { o0: { used: 'Máquina', sets: { 0: set('50', '10') } } }),
    '3-upper': log(3, 'upper', 300, { o0: { used: 'Outro nome', sets: {} } }),
  };
  const opts = ['Barra', 'Halter', 'Máquina'];
  assert.equal(CG.preferredVariant(logs, 'upper', 'o0', opts, '4-upper'), 'Máquina');
  assert.equal(CG.preferredVariant(logs, 'upper', 'o0', ['Barra', 'Halter'], '4-upper'), null);
  assert.equal(CG.preferredVariant(logs, 'lower', 'o0', opts, 'x'), null);
  assert.equal(CG.preferredVariant(logs, 'upper', 'o1', opts, 'x'), null);
});

test('toCSV: uma linha por série, com aquecimento, energia e nota escapadas', () => {
  const logs = {
    '1-upper': Object.assign(log(1, 'upper', new Date(2026, 10, 3, 18).getTime(), { o0: { used: 'Supino; reto', warm: { 0: { kg: '30', reps: '8' } }, sets: { 0: set('62.5', '8'), 1: set('', '', false) } } }), { energy: 4, note: 'Disse "boa"' }),
  };
  const csv = CG.toCSV(logs, { upper: 'Upper' });
  assert.ok(csv.startsWith('\ufeff'));
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines[0], 'data;semana;dia;exercicio;tipo;serie;kg;reps;feita;energia;anotacao');
  assert.equal(lines[1], '2026-11-03;1;Upper;"Supino; reto";aquecimento;1;30;8;;4;"Disse ""boa"""');
  assert.equal(lines[2], '2026-11-03;1;Upper;"Supino; reto";valida;1;62,5;8;sim;;');
  assert.equal(lines.length, 3);
});
