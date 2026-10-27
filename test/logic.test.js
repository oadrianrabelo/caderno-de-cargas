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
  assert.deepEqual(CG.parseBackup(txt), { logs, custom });
});

test('backup: importar substitui os dados e tolera custom ausente', () => {
  assert.deepEqual(CG.parseBackup('{"v":1,"logs":{"a":1}}'), { logs: { a: 1 }, custom: {} });
  assert.deepEqual(CG.parseBackup('{"logs":{},"custom":"x"}'), { logs: {}, custom: {} });
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
