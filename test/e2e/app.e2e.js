// Teste de ponta a ponta no Chromium, com Playwright (opcional: npm run test:e2e).
// Simula o Capacitor e o GitHub para cobrir exportar/importar nativo e a nuvem.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { /* sem Playwright */ }
const WWW = path.join(__dirname, '..', '..', 'www');

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(WWW) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// Capacitor falso: Filesystem em memória (persistido em window.name entre recargas) e Share que só registra.
const FAKE_CAP = `
  const fsStore = JSON.parse(sessionStorage.getItem('fakefs') || '{}');
  const keep = () => sessionStorage.setItem('fakefs', JSON.stringify(fsStore));
  window.__shared = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Filesystem: {
        writeFile: async (o) => { fsStore[o.directory + '/' + o.path] = o.data; keep(); return { uri: 'file:///' + o.directory + '/' + o.path }; },
        readFile: async (o) => { const k = o.directory + '/' + o.path; if (!(k in fsStore)) throw new Error('File does not exist'); return { data: fsStore[k] }; }
      },
      Share: { share: async (o) => { window.__shared.push(o); return {}; } }
    }
  };
  window.__fs = fsStore;`;

const skip = chromium ? false : 'Playwright não instalado';

test('app no navegador e no Capacitor simulado', { skip, timeout: 120000 }, async (t) => {
  const srv = await serve();
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];
  const watch = (p) => { p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); }); };
  const fill = async (p, kg, reps) => {
    const set = p.locator('.set').first();
    await set.locator('input').nth(0).fill(kg);
    await set.locator('input').nth(1).fill(reps);
    await set.locator('.ck').click();
  };
  try {
    await t.test('salva no localStorage e sobrevive a recarregar', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      assert.equal(await p.textContent('#title'), 'Upper');
      await fill(p, '60', '8');
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Salvo');
      await p.reload();
      // Com o Upper feito, o app reabre no dia seguinte.
      assert.equal(await p.textContent('#title'), 'Lower');
      await p.click('.tab >> nth=0');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=0'), '60');
      await ctx.close();
    });

    await t.test('exportar baixa o JSON no navegador e importar restaura', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await fill(p, '42.5', '10');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bexp')]);
      assert.match(dl.suggestedFilename(), /^caderno-de-cargas-\d{4}-\d{2}-\d{2}\.json$/);
      const file = path.join(os.tmpdir(), 'cg-e2e-' + process.pid + '.json');
      await dl.saveAs(file);
      const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(backup.v, 1);
      assert.equal(backup.logs['1-upper'].ex.o0.sets[0].kg, '42.5');

      const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.setInputFiles('#fimp', file);
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup importado');
      assert.equal(await p2.textContent('#title'), 'Lower');
      await p2.click('.tab >> nth=0');
      assert.equal(await p2.inputValue('.set >> nth=0 >> input >> nth=0'), '42.5');
      fs.writeFileSync(file, 'lixo');
      await p2.setInputFiles('#fimp', file);
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Arquivo inválido');
      assert.equal(await p2.inputValue('.set >> nth=0 >> input >> nth=0'), '42.5');
      fs.unlinkSync(file);
      await ctx.close(); await ctx2.close();
    });

    await t.test('repetir a última carga e copiar o dia para as semanas seguintes', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await fill(p, '70', '6');
      await p.click('#wnext');
      assert.equal(await p.getAttribute('.set >> nth=0 >> input >> nth=0', 'placeholder'), '70');
      await p.click('.set >> nth=0 >> .ck');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=0'), '70');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=1'), '6');

      await p.click('#bedit');
      await p.fill('.ed .nm >> nth=0', 'Supino Personalizado');
      await p.click('text=Repetir nas próximas semanas');
      assert.equal(await p.textContent('#status'), 'Copiado para as semanas 3 a 12');
      await p.click('#bedit');
      for (let i = 0; i < 10; i++) await p.click('#wnext');
      assert.equal(await p.textContent('#wl'), 'Semana 12');
      assert.equal(await p.textContent('.ex h2 >> nth=0'), 'Supino Personalizado');
      await ctx.close();
    });

    await t.test('Capacitor: exportar usa Filesystem + Share e o espelho recupera os dados', async () => {
      const ctx = await browser.newContext(); await ctx.addInitScript(FAKE_CAP);
      await ctx.addInitScript(() => { if (sessionStorage.getItem('wipe')) { sessionStorage.removeItem('wipe'); localStorage.clear(); } }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await fill(p, '55', '9');
      await p.click('#bexp');
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Backup exportado');
      const shared = await p.evaluate(() => window.__shared);
      assert.equal(shared.length, 1);
      assert.match(shared[0].files[0], /^file:\/\/\/CACHE\/caderno-de-cargas-.*\.json$/);
      const cached = await p.evaluate((u) => window.__fs[u.replace('file:///', '')], shared[0].files[0]);
      assert.equal(JSON.parse(cached).logs['1-upper'].ex.o0.sets[0].kg, '55');
      await p.waitForFunction(() => window.__fs['DATA/caderno-espelho.json'], null, { timeout: 5000 });
      // Simula o WebView perdendo o localStorage (limpo na próxima carga, depois do pagehide salvar).
      await p.evaluate(() => sessionStorage.setItem('wipe', '1'));
      await p.reload();
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Dados recuperados');
      assert.equal(await p.textContent('#title'), 'Lower');
      await ctx.close();
    });

    await t.test('nuvem: conectar, enviar sozinho e baixar em outro aparelho', async () => {
      const gists = {};
      const route = async (r) => {
        const req = r.request(), m = req.url().match(/\/gists(?:\/(\w+))?/), method = req.method();
        if (req.headers().authorization !== 'Bearer tok') return r.fulfill({ status: 401, body: '{}' });
        const body = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b), headers: { 'Access-Control-Allow-Origin': '*' } });
        if (method === 'GET' && !m[1]) return body(200, Object.keys(gists).map((id) => ({ id, files: gists[id] })));
        if (method === 'POST') { gists.g1 = JSON.parse(req.postData()).files; return body(201, { id: 'g1' }); }
        if (method === 'PATCH') { Object.assign(gists[m[1]], JSON.parse(req.postData()).files); return body(200, {}); }
        return body(200, { files: gists[m[1]] });
      };
      const ctx = await browser.newContext(); await ctx.route('https://api.github.com/**', route); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await p.click('#bcloud');
      await p.fill('#cloud input[type=password]', 'errado');
      await p.click('#cloud >> text=Conectar');
      await p.waitForSelector('#cloud >> text=Token inválido ou expirado');
      await p.fill('#cloud input[type=password]', 'tok');
      await p.click('#cloud >> text=Conectar');
      await p.waitForSelector('#cloud >> text=Enviar agora');
      await fill(p, '80', '5');
      const sent = () => { try { return JSON.parse(gists.g1['caderno-de-cargas.json'].content).logs['1-upper'].ex.o0.sets[0].kg; } catch (e) { return null; } };
      for (let i = 0; i < 100 && sent() !== '80'; i++) await p.waitForTimeout(100);
      assert.equal(sent(), '80');
      await p.waitForFunction(() => document.getElementById('bcloud').textContent === 'Nuvem ✓');
      // Backup exportado não leva o token.
      assert.ok(!(await p.evaluate(() => CGApp.snapshot())).includes('tok'));

      const ctx2 = await browser.newContext(); await ctx2.route('https://api.github.com/**', route); const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.click('#bcloud');
      await p2.fill('#cloud input[type=password]', 'tok');
      await p2.click('#cloud >> text=Conectar');
      await p2.waitForSelector('#cloud >> text=Achei um backup na nuvem', { timeout: 5000 });
      await p2.click('#cloud >> text=Baixar da nuvem');
      await p2.click('#cloud >> text=Toque de novo');
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup da nuvem importado');
      await p2.click('.tab >> nth=0');
      assert.equal(await p2.inputValue('.set >> nth=0 >> input >> nth=0'), '80');
      await ctx.close(); await ctx2.close();
    });

    await t.test('nuvem: sem internet não quebra nada', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await p.evaluate(() => localStorage.setItem('cg:sync', JSON.stringify({ token: 'tok', gistId: 'g1', auto: true })));
      await ctx.route('https://api.github.com/**', (r) => r.abort('internetdisconnected'));
      await p.reload();
      await fill(p, '20', '12');
      await p.click('#bcloud');
      await p.waitForSelector('#cloud >> text=Sem internet: envio quando voltar o sinal', { timeout: 10000 });
      assert.equal(await p.textContent('#bcloud'), 'Nuvem •');
      await p.reload();
      await p.click('.tab >> nth=0');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=0'), '20');
      await ctx.close();
    });

    const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
    assert.deepEqual(real, []);
  } finally {
    await browser.close(); srv.close();
  }
});
