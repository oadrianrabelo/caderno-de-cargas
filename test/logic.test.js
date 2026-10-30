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
  assert.deepEqual(CG.parseBackup(txt), { logs, custom, programs: null });
});

test('backup: importar substitui os dados e tolera custom ausente', () => {
  assert.deepEqual(CG.parseBackup('{"v":1,"logs":{"a":1}}'), { logs: { a: 1 }, custom: {}, programs: null });
  assert.deepEqual(CG.parseBackup('{"logs":{},"custom":"x"}'), { logs: {}, custom: {}, programs: null });
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
