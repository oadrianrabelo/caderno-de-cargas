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
    isPluginAvailable: (n) => n in window.Capacitor.Plugins,
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
// Botões que ficam dentro do menu "Mais": abre o menu se precisar.
const tool = async (pg, sel) => { if (!(await pg.isVisible(sel))) await pg.click('#bmore'); return pg.click(sel); };

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
      const [dl] = await Promise.all([p.waitForEvent('download'), tool(p, '#bexp')]);
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
      // Desfazer volta para os dados de antes da importação.
      assert.ok(await p2.isVisible('#undonote >> text=Desfazer importação'));
      await p2.click('#undonote >> text=Desfazer importação');
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Importação desfeita');
      assert.equal(await p2.inputValue('.set >> nth=0 >> input >> nth=0'), '');
      await p2.setInputFiles('#fimp', file);
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup importado');
      await p2.click('#undonote >> text=Manter');
      assert.equal(await p2.isVisible('#undonote'), false);
      await p2.click('.tab >> nth=0');
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
      await tool(p, '#bexp');
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
      await tool(p, '#bcloud');
      await p.fill('#cloud input[type=password]', 'errado');
      await p.click('#cloud >> text=Conectar Gist');
      await p.waitForSelector('#cloud >> text=Token inválido ou expirado');
      await p.fill('#cloud input[type=password]', 'tok');
      await p.click('#cloud >> text=Conectar Gist');
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
      await tool(p2, '#bcloud');
      await p2.fill('#cloud input[type=password]', 'tok');
      await p2.click('#cloud >> text=Conectar Gist');
      await p2.waitForSelector('#cloud >> text=Achei um backup no GitHub Gist', { timeout: 5000 });
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
      await p.evaluate(() => localStorage.setItem('cg:sync', JSON.stringify({ provider: 'gist', token: 'tok', remoteId: 'g1', auto: true })));
      await ctx.route('https://api.github.com/**', (r) => r.abort('internetdisconnected'));
      await p.reload();
      await fill(p, '20', '12');
      await tool(p, '#bcloud');
      await p.waitForSelector('#cloud >> text=Sem internet: envio quando voltar o sinal', { timeout: 10000 });
      assert.equal(await p.textContent('#bcloud'), 'Nuvem •');
      await p.reload();
      await p.click('.tab >> nth=0');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=0'), '20');
      await ctx.close();
    });

    await t.test('Google Drive: navegador mostra que é só no app; no app conecta, envia e baixa', async () => {
      const ctx0 = await browser.newContext(); const p0 = await ctx0.newPage(); watch(p0);
      await p0.goto(url); await tool(p0, '#bcloud');
      await p0.waitForSelector('#cloud >> text=Google Drive: disponível no app Android.');
      assert.equal(await p0.locator('#cloud >> text=Conectar Google Drive').count(), 0);
      await ctx0.close();

      const files = {};
      const route = async (r) => {
        const req = r.request(), u = new URL(req.url()), method = req.method();
        const body = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: typeof b === 'string' ? b : JSON.stringify(b), headers: { 'Access-Control-Allow-Origin': '*' } });
        if (req.headers().authorization !== 'Bearer gtok') return body(401, {});
        const id = u.pathname.split('/files')[1].replace('/', '');
        if (method === 'GET' && !id) return body(200, { files: Object.keys(files).map((i) => ({ id: i })) });
        if (method === 'POST') { const b = req.headers()['content-type'].split('boundary=')[1]; files.d1 = req.postData().split('--' + b)[2].split('\r\n\r\n')[1].replace(/\r\n$/, ''); return body(200, { id: 'd1' }); }
        if (method === 'PATCH') { files[id] = req.postData(); return body(200, {}); }
        return body(200, files[id]);
      };
      const DRIVE = `window.Capacitor.Plugins.DriveAuth = { getToken: async (o) => { window.__logins = (window.__logins || 0) + (o.interactive ? 1 : 0); return { token: 'gtok' }; }, clearToken: async () => ({}) };`;
      const ctx = await browser.newContext(); await ctx.addInitScript(FAKE_CAP); await ctx.addInitScript(DRIVE); await ctx.route('https://www.googleapis.com/**', route);
      const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await tool(p, '#bcloud');
      await p.click('#cloud >> text=Conectar Google Drive');
      await p.waitForSelector('#cloud >> text=Google Drive ·');
      assert.equal(await p.evaluate(() => window.__logins), 1);
      await fill(p, '33', '7');
      const sent = () => { try { return JSON.parse(files.d1).logs['1-upper'].ex.o0.sets[0].kg; } catch (e) { return null; } };
      for (let i = 0; i < 100 && sent() !== '33'; i++) await p.waitForTimeout(100);
      assert.equal(sent(), '33');

      const ctx2 = await browser.newContext(); await ctx2.addInitScript(FAKE_CAP); await ctx2.addInitScript(DRIVE); await ctx2.route('https://www.googleapis.com/**', route);
      const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await tool(p2, '#bcloud');
      await p2.click('#cloud >> text=Conectar Google Drive');
      await p2.waitForSelector('#cloud >> text=Achei um backup no Google Drive', { timeout: 5000 });
      await p2.click('#cloud >> text=Baixar da nuvem');
      await p2.click('#cloud >> text=Toque de novo');
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup da nuvem importado');
      await p2.click('.tab >> nth=0');
      assert.equal(await p2.inputValue('.set >> nth=0 >> input >> nth=0'), '33');
      await ctx.close(); await ctx2.close();
    });

    await t.test('painéis começam fechados', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      for (const id of ['#cloud', '#progress', '#programs', '#skipnote', '#timer', '#bkpnote', '#undonote']) assert.equal(await p.isVisible(id), false, id);
      await ctx.close();
    });

    await t.test('pular treino: marca, avança, aparece no progresso e pode ser desfeito', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await p.click('#bskip');
      assert.equal(await p.textContent('#title'), 'Lower');
      assert.equal(await p.textContent('#status'), 'Treino pulado. Próximo: Lower');
      assert.equal(await p.locator('.tab >> nth=0 >> .dot.skip').count(), 1);
      await p.reload();
      assert.equal(await p.textContent('#title'), 'Lower');
      await p.click('#bprog');
      assert.equal(await p.textContent('#progress .kpi >> nth=1 >> b'), '1');
      await p.click('#progress .grid button >> nth=0');
      assert.equal(await p.textContent('#title'), 'Upper');
      assert.equal(await p.isVisible('#progress'), false);
      assert.match(await p.textContent('#skipnote'), /Você pulou este treino em/);
      assert.equal(await p.textContent('#bskip'), 'Desfazer pulo');
      await p.click('#bskip');
      assert.equal(await p.isVisible('#skipnote'), false);
      assert.equal(await p.locator('.tab >> nth=0 >> .dot').count(), 0);
      await ctx.close();
    });

    await t.test('programa próprio: criar, montar o dia, treinar, trocar, editar e excluir', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await tool(p, '#bprogs');
      await p.click('#programs >> text=+ Criar meu programa');
      await p.fill('#programs input >> nth=0', 'Meu AB');
      await p.fill('#programs input >> nth=1', '4');
      await p.click('#programs [aria-label="Remover dia 3"]');
      await p.fill('#programs [aria-label="Nome do dia 1"]', 'Peito e tríceps');
      await p.click('#programs >> text=Criar e usar');
      assert.equal(await p.isVisible('#programs'), false);
      assert.equal(await p.textContent('#title'), 'Peito e tríceps');
      assert.equal(await p.textContent('#bedit'), 'Concluir edição');
      assert.equal(await p.locator('.tab').count(), 2);
      await p.click('text=+ Adicionar exercício');
      await p.fill('.ed .nm', 'Supino reto');
      await p.click('#bedit');
      await fill(p, '80', '6');
      await p.click('#wnext');
      assert.equal(await p.textContent('.ex h2 >> nth=0'), 'Supino reto');
      assert.equal(await p.getAttribute('.set >> nth=0 >> input >> nth=0', 'placeholder'), '80');
      for (let i = 0; i < 5; i++) if (await p.isEnabled('#wnext')) await p.click('#wnext');
      assert.equal(await p.textContent('#wl'), 'Semana 4');
      await p.reload();
      assert.equal(await p.textContent('#title'), 'Treino B');
      assert.equal(await p.textContent('#sub'), 'Meu AB');

      await tool(p, '#bprogs');
      await p.click('#programs .it >> nth=1 >> text=Editar dias');
      await p.fill('#programs [aria-label="Nome do dia 2"]', 'Costas');
      await p.click('#programs >> text=Salvar');
      assert.equal(await p.textContent('.tab >> nth=1'), 'Costas');
      await p.click('#programs .it >> nth=0 >> text=Usar');
      assert.equal(await p.locator('.tab').count(), 5);
      assert.equal(await p.textContent('#title'), 'Upper');
      await tool(p, '#bprogs');
      await p.click('#programs .it >> nth=1 >> text=Excluir');
      await p.click('#programs .it >> nth=1 >> text=Toque de novo para excluir');
      assert.equal(await p.locator('#programs .it').count(), 1);
      await ctx.close();
    });

    await t.test('programa a partir do Jeff copia os exercícios e vai no backup', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await tool(p, '#bprogs');
      await p.click('#programs >> text=+ Criar meu programa');
      await p.click('#programs >> text=Partir do treino do Jeff');
      await p.click('#programs >> text=Criar e usar');
      assert.equal(await p.textContent('#sub'), 'Meu Jeff');
      assert.equal(await p.textContent('.ex h2 >> nth=0'), '45° Incline Barbell Press');
      await fill(p, '30', '10');
      const [dl] = await Promise.all([p.waitForEvent('download'), tool(p, '#bexp')]);
      const file = path.join(os.tmpdir(), 'cg-e2e-prog-' + process.pid + '.json');
      await dl.saveAs(file);
      assert.equal(Object.values(JSON.parse(fs.readFileSync(file, 'utf8')).programs.list)[0].name, 'Meu Jeff');
      const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.setInputFiles('#fimp', file);
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup importado');
      assert.equal(await p2.textContent('#sub'), 'Meu Jeff');
      assert.equal(await p2.textContent('#title'), 'Lower');
      fs.unlinkSync(file);
      await ctx.close(); await ctx2.close();
    });

    await t.test('imagens: baixa PNG no navegador e compartilha no Android', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await fill(p, '50', '8');
      await p.click('#bprog');
      const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#progress >> text=Imagem do treino')]);
      assert.match(d1.suggestedFilename(), /^treino-\d{4}-\d{2}-\d{2}\.png$/);
      const png = fs.readFileSync(await d1.path());
      assert.equal(png.slice(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1080);
      const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#progress >> text=Imagem do progresso')]);
      assert.match(d2.suggestedFilename(), /^progresso-.*\.png$/);
      await ctx.close();

      const ctx2 = await browser.newContext(); await ctx2.addInitScript(FAKE_CAP); const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.click('#bprog');
      await p2.click('#progress >> text=Imagem do progresso');
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Imagem compartilhada');
      const shared = await p2.evaluate(() => window.__shared);
      assert.match(shared[0].files[0], /^file:\/\/\/CACHE\/progresso-.*\.png$/);
      const b64 = await p2.evaluate((u) => window.__fs[u.replace('file:///', '')], shared[0].files[0]);
      assert.equal(Buffer.from(b64, 'base64').slice(1, 4).toString(), 'PNG');
      await ctx2.close();
    });

    await t.test('atualização automática: baixa o app web novo, aplica e pede APK quando o Android muda', async () => {
      const files = fs.readdirSync(WWW).filter((f) => !f.startsWith('.') && f !== 'version.json');
      const bundle = (build, native) => JSON.stringify({ version: 'v0.' + build + '.0', build, native, files: Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(WWW, f), 'utf8')])) });
      let release = null;
      const UPD = `
        window.__applied = []; window.__http = [];
        Object.assign(window.Capacitor.Plugins, {
          WebUpdate: { confirm: async () => ({ applied: false }), info: async () => ({ bad: 0 }), apply: async (o) => { window.__applied.push(o); } },
          CapacitorHttp: { request: async (o) => { window.__http.push(o.url); return { data: window.__bundle, status: 200 }; } }
        });
        Object.assign(window.Capacitor.Plugins.Filesystem, {
          getUri: async (o) => ({ uri: 'file:///data/user/0/app/files/' + o.path }),
          readdir: async () => ({ files: [] }), rmdir: async () => ({})
        });`;
      const setup = async (ctx, bundleJson) => {
        await ctx.addInitScript(FAKE_CAP); await ctx.addInitScript(UPD);
        await ctx.addInitScript('window.__bundle = ' + JSON.stringify(bundleJson) + ';');
        await ctx.route('**/version.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 'v0.5.0', build: 5, native: 'aaaaaaaaaaaa' }) }));
        await ctx.route(/\/repos\/[^/]+\/[^/]+\/releases\?per_page=20$/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify([release]), headers: { 'Access-Control-Allow-Origin': '*' } }));
      };

      // Mesma parte Android: baixa e grava o pacote, avisa e aplica no toque.
      release = { tag_name: 'v0.6.0', assets: [{ name: 'web-6-aaaaaaaaaaaa.json', browser_download_url: 'https://dl/web.json' }, { name: 'x.apk', browser_download_url: 'https://dl/x.apk' }] };
      const ctx = await browser.newContext(); await setup(ctx, bundle(6, 'aaaaaaaaaaaa'));
      const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await p.waitForSelector('#updnote >> text=Nova versão v0.6.0 baixada', { timeout: 10000 });
      assert.deepEqual(await p.evaluate(() => window.__http), ['https://dl/web.json']);
      assert.ok((await p.evaluate(() => window.__fs['DATA/web/b6/index.html'])).includes('<script src="logic.js">'));
      await p.click('#updnote >> text=Atualizar agora');
      assert.deepEqual(await p.evaluate(() => window.__applied), [{ path: '/data/user/0/app/files/web/b6', build: 6 }]);
      // Reabrindo o app, a versão baixada entra sozinha.
      await p.reload();
      await p.waitForFunction(() => window.__applied.length === 1, null, { timeout: 5000 });
      await ctx.close();

      // Pacote adulterado: não grava nada.
      const ctxBad = await browser.newContext(); await setup(ctxBad, bundle(6, 'bbbbbbbbbbbb'));
      const pb = await ctxBad.newPage(); watch(pb);
      await pb.goto(url);
      await pb.waitForFunction(() => window.__http.length === 1);
      await pb.waitForTimeout(300);
      assert.equal(await pb.evaluate(() => Object.keys(window.__fs).some((k) => k.startsWith('DATA/web/'))), false);
      assert.equal(await pb.isVisible('#updnote'), false);
      await ctxBad.close();

      // Parte Android mudou: não baixa o pacote web, oferece o APK.
      release = { tag_name: 'v0.7.0', assets: [{ name: 'web-7-cccccccccccc.json', browser_download_url: 'https://dl/web7.json' }, { name: 'app-0.7.0.apk', browser_download_url: 'https://dl/app.apk' }] };
      const ctx2 = await browser.newContext(); await setup(ctx2, '{}');
      const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.waitForSelector('#updnote >> text=Baixar APK', { timeout: 10000 });
      assert.equal(await p2.getAttribute('#updnote a', 'href'), 'https://dl/app.apk');
      // Aviso de APK: exportar o backup antes, num toque.
      assert.equal(await p2.textContent('#updnote a'), '2. Baixar APK');
      await p2.click('#updnote >> text=1. Exportar backup');
      await p2.waitForFunction(() => window.__shared && window.__shared.length === 1);
      assert.deepEqual(await p2.evaluate(() => window.__http), []);
      await ctx2.close();
    });

    await t.test('RPE, aquecimento e técnica: edita, mostra, explica e não conta aquecimento como série', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      assert.equal(await p.textContent('#focus'), 'Força ⓘ');
      await p.click('#focus');
      assert.equal(await p.textContent('.tipbox h2'), 'Dia de força');
      await p.click('.tipbox >> text=Entendi');
      assert.equal(await p.locator('.ex >> nth=0 >> .det').count(), 0);
      await p.click('#bedit');
      const ed = () => p.locator('.ed').first();
      await ed().locator('input[placeholder="ex.: 1-2"]').fill('1');
      await ed().locator('input[placeholder="ex.: 7-8"]').fill('8');
      await ed().locator('input[placeholder="ex.: 9-10"]').fill('10');
      await ed().locator('select').selectOption('myo');
      await p.click('text=Repetir nas próximas semanas');
      await p.click('#bedit');
      assert.deepEqual(await p.locator('.ex >> nth=0 >> .det .tag').allTextContents(), ['1 série de aquecimento ⓘ', 'RPE 8 · última 10 ⓘ', 'Última série: Myo-reps ⓘ']);
      assert.equal(await p.textContent('.ex >> nth=0 >> .set:not(.warm) >> nth=1 >> .sl .tq'), 'Myo-reps');
      await p.locator('.ex >> nth=0 >> .set.warm input').first().fill('40');
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Salvo');
      assert.equal(await p.textContent('#prog'), '0 de 14 séries');
      await p.click('.ex >> nth=0 >> .tag.tec');
      assert.equal(await p.textContent('.tipbox h2'), 'Myo-reps');
      await p.click('.tipbox >> text=Entendi');
      await tool(p, '#bgloss');
      assert.ok((await p.locator('.tipbox h3').allTextContents()).includes('LLPs (parciais alongadas)'));
      await p.click('.tipbox >> text=Entendi');
      await p.reload();
      await p.click('#wnext');
      assert.equal(await p.textContent('.ex >> nth=0 >> .tag.tec'), 'Última série: Myo-reps ⓘ');
      await p.click('#wprev');
      assert.equal(await p.inputValue('.ex >> nth=0 >> .set.warm input >> nth=0'), '40');
      // Aquecimento não vira "última carga" do exercício.
      assert.equal(await p.evaluate(() => CG.lastFor(JSON.parse(localStorage.getItem('cg:logs')), '45° Incline Barbell Press', 'x')), null);
      // Os detalhes vão no backup (dentro da lista editada).
      const snap = JSON.parse(await p.evaluate(() => CGApp.snapshot()));
      assert.equal(snap.custom['1-upper'][0].tec, 'myo');
      assert.equal(snap.logs['1-upper'].ex.o0.warm[0].kg, '40');
      await ctx.close();
    });

    await t.test('atualização com repositório privado: pede token e baixa sem repassar o token no redirecionamento', async () => {
      const files = fs.readdirSync(WWW).filter((f) => !f.startsWith('.') && f !== 'version.json');
      const bundle = JSON.stringify({ version: 'v0.9.0', build: 9, native: 'aaaaaaaaaaaa', files: Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(WWW, f), 'utf8')])) });
      const UPD = `
        window.__http = [];
        Object.assign(window.Capacitor.Plugins, {
          WebUpdate: { confirm: async () => ({}), info: async () => ({ bad: 0 }), apply: async () => {} },
          CapacitorHttp: { request: async (o) => {
            window.__http.push({ url: o.url, auth: (o.headers || {}).Authorization || null, noRedirect: !!o.disableRedirects });
            if (o.url === 'https://api.github.com/assets/9') return { status: 302, headers: { Location: 'https://storage/signed' }, data: '' };
            return { status: 200, data: window.__bundle };
          } }
        });
        Object.assign(window.Capacitor.Plugins.Filesystem, { getUri: async (o) => ({ uri: 'file:///d/' + o.path }), readdir: async () => ({ files: [] }), rmdir: async () => ({}) });`;
      const ctx = await browser.newContext();
      await ctx.addInitScript(FAKE_CAP); await ctx.addInitScript(UPD);
      await ctx.addInitScript('window.__bundle = ' + JSON.stringify(bundle) + ';');
      await ctx.route('**/version.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 'v0.5.0', build: 5, native: 'aaaaaaaaaaaa' }) }));
      await ctx.route(/\/repos\/[^/]+\/[^/]+\/releases\?per_page=20$/, (r) => {
        if (r.request().headers().authorization !== 'Bearer leitura') return r.fulfill({ status: 404, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } });
        return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([{ tag_name: 'v0.9.0', assets: [
          { name: 'web-9-aaaaaaaaaaaa.json', browser_download_url: 'https://github.com/x/web.json', url: 'https://api.github.com/assets/9' }] }]) });
      });
      const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await tool(p, '#bver');
      await p.waitForSelector('#version >> text=Instalada: v0.5.0 (build 5)');
      await p.click('#version >> text=Verificar atualização agora');
      await p.waitForSelector('#version >> text=Repositório privado: cole um token de leitura');
      await p.fill('#version input[type=password]', 'leitura');
      await p.click('#version >> text=Salvar token');
      await p.waitForSelector('#version >> text=Versão v0.9.0 baixada', { timeout: 10000 });
      assert.deepEqual(await p.evaluate(() => window.__http), [
        { url: 'https://api.github.com/assets/9', auth: 'Bearer leitura', noRedirect: true },
        { url: 'https://storage/signed', auth: null, noRedirect: false },
      ]);
      assert.ok(await p.isVisible('#updnote >> text=Nova versão v0.9.0 baixada'));
      // O token não vai no backup.
      assert.ok(!(await p.evaluate(() => CGApp.snapshot())).includes('leitura'));
      await ctx.close();
    });

    await t.test('arquivo de detalhes do programa: importa, mostra faixas de aquecimento e vai no backup', async () => {
      const det = { type: 'caderno-detalhes', v: 1, program: 'bts', extra: { 1: { upper: [{ aq: '2-3', rpe: '~6-7', rpeUlt: '~7-8' }, { aq: '1', rpeUlt: '10', tec: 'estatico' }] } } };
      const file = path.join(os.tmpdir(), 'cg-e2e-det-' + process.pid + '.json');
      fs.writeFileSync(file, JSON.stringify(det));
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await fill(p, '50', '8');
      await p.setInputFiles('#fimp', file);
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Detalhes do programa importados');
      // Importar detalhes não mexe nos treinos registrados.
      assert.equal(await p.inputValue('.set:not(.warm) >> nth=0 >> input >> nth=0'), '50');
      assert.deepEqual(await p.locator('.ex >> nth=0 >> .det .tag').allTextContents(), ['2-3 séries de aquecimento ⓘ', 'RPE ~6-7 · última ~7-8 ⓘ']);
      assert.equal(await p.locator('.ex >> nth=0 >> .set.warm').count(), 3);
      assert.deepEqual(await p.locator('.ex >> nth=1 >> .det .tag').allTextContents(), ['1 série de aquecimento ⓘ', 'RPE última 10 ⓘ', 'Última série: Along. estático ⓘ']);
      await p.reload();
      await p.click('.tab >> nth=0');
      assert.equal(await p.locator('.ex >> nth=0 >> .set.warm').count(), 3);
      const snap = JSON.parse(await p.evaluate(() => CGApp.snapshot()));
      assert.deepEqual(snap.extra, det.extra);
      // Editar o exercício sobrepõe o detalhe importado.
      await p.click('#bedit');
      assert.equal(await p.inputValue('.ed >> nth=0 >> input[placeholder="ex.: 1-2"]'), '2-3');
      await p.fill('.ed >> nth=0 >> input[placeholder="ex.: 1-2"]', '1');
      await p.click('#bedit');
      assert.equal(await p.locator('.ex >> nth=0 >> .set.warm').count(), 1);
      // Um backup com detalhes, importado em outro aparelho, traz os detalhes.
      fs.writeFileSync(file, JSON.stringify(snap));
      const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); watch(p2);
      await p2.goto(url);
      await p2.setInputFiles('#fimp', file);
      await p2.waitForFunction(() => document.getElementById('status').textContent === 'Backup importado');
      await p2.click('.tab >> nth=0');
      assert.equal(await p2.locator('.ex >> nth=1 >> .tag.tec').textContent(), 'Última série: Along. estático ⓘ');
      fs.unlinkSync(file);
      await ctx.close(); await ctx2.close();
    });

    await t.test('cronômetro de descanso, dica de progressão e lembrete de backup', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      // Série feita: descanso do 1º exercício do Upper (3-5 min) começa em 3:00.
      await fill(p, '60', '8');
      await p.waitForSelector('#timer:not([hidden])');
      assert.match(await p.textContent('#timer .tl small'), /Descanso · 45° Incline Barbell Press/);
      assert.match(await p.textContent('#timer .tl b'), /^(3:00|2:59)$/);
      await p.click('#timer [aria-label="Mais 15 segundos"]');
      assert.match(await p.textContent('#timer .tl b'), /^3:1[45]$/);
      await p.evaluate(() => CGTimer.start(1, 'teste'));
      await p.waitForFunction(() => document.querySelector('#timer .tl b').textContent === 'Próxima série!', null, { timeout: 4000 });
      assert.ok(await p.evaluate(() => document.getElementById('timer').classList.contains('end')));
      await p.click('#timer [aria-label="Parar descanso"]');
      assert.equal(await p.isVisible('#timer'), false);

      // Topo das reps (8) nas 2 séries do supino na semana 1: na semana 2 sugere subir a carga.
      const set2 = p.locator('.ex >> nth=0 >> .set:not(.warm) >> nth=1');
      await set2.locator('input').nth(0).fill('60'); await set2.locator('input').nth(1).fill('8'); await set2.locator('.ck').click();
      await p.click('#wnext');
      assert.equal(await p.textContent('.ex >> nth=0 >> .tag.tec'), '↑ Bateu 8 reps em todas: tente 62,5 kg ⓘ');
      await p.click('.ex >> nth=0 >> .tag.tec');
      assert.equal(await p.textContent('.tipbox h2'), 'Hora de subir a carga');
      await p.click('.tipbox >> text=Entendi');
      // Um só treino feito: ainda sem lembrete. Dois treinos: aparece. Exportar some com ele.
      assert.equal(await p.isVisible('#bkpnote'), false);
      await p.click('.tab >> nth=1');
      await fill(p, '40', '10');
      await p.waitForSelector('#bkpnote >> text=Você ainda não fez backup.');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bkpnote >> text=Exportar backup agora')]);
      assert.match(dl.suggestedFilename(), /\.json$/);
      assert.equal(await p.isVisible('#bkpnote'), false);
      // Backup antigo (8 dias) volta a lembrar.
      await p.evaluate(() => localStorage.setItem('cg:lastBackup', String(Date.now() - 8 * 86400000)));
      await p.reload();
      await p.waitForSelector('#bkpnote >> text=Último backup há 8 dias.');
      await ctx.close();
    });

    await t.test('cores por dia, exercício completo, rolar para o próximo e comemoração', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      const dayColor = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--day').trim());
      assert.equal(await dayColor(), '#1f4fd8');
      await p.click('.tab >> nth=1');
      assert.equal(await dayColor(), '#d9480f');
      // Lower da semana 1: completar o 1º exercício marca o selo; completar tudo comemora.
      const cards = p.locator('.ex');
      const n = await cards.count();
      for (let c = 0; c < n; c++) {
        const sets = cards.nth(c).locator('.set:not(.warm)');
        const k = await sets.count();
        for (let i = 0; i < k; i++) {
          await sets.nth(i).locator('input').nth(0).fill('10'); await sets.nth(i).locator('input').nth(1).fill('8');
          await sets.nth(i).locator('.ck').click();
        }
        if (c === 0) {
          assert.ok(await cards.nth(0).evaluate((e) => e.classList.contains('complete')));
          assert.equal(await p.isVisible('#cele'), false);
        }
      }
      await p.waitForSelector('#cele >> text=Treino concluído!');
      assert.match(await p.textContent('#cele p'), /Lower · semana 1 · 12 séries · 960 kg de volume/);
      await p.click('#cele >> text=Fechar');
      assert.equal(await p.isVisible('#cele'), false);
      // Desmarcar e marcar de novo não comemora outra vez.
      assert.ok(await cards.nth(n - 1).evaluate((e) => e.classList.contains('collapsed')));
      await cards.nth(n - 1).locator('.exh').click();
      const last = cards.nth(n - 1).locator('.set:not(.warm) .ck').last();
      await last.click(); await last.click();
      await p.waitForTimeout(100);
      assert.equal(await p.locator('#cele').count(), 0);
      // Recarregando, os selos de completo voltam.
      await p.reload();
      await p.click('.tab >> nth=1');
      assert.equal(await p.locator('.ex.complete').count(), n);
      await ctx.close();
    });

    await t.test('menu Mais, exercício recolhido e histórico do exercício', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      // Menu: só Editar, Pular, Progresso à vista; o resto abre no "Mais".
      assert.equal(await p.isVisible('#bexp'), false);
      assert.equal(await p.textContent('#bmore'), 'Mais ▾');
      await p.click('#bmore');
      assert.ok(await p.isVisible('#bexp'));
      assert.equal(await p.textContent('#bmore'), 'Menos ▴');
      await p.click('#bmore');
      // Duas sessões do supino (semanas 1 e 2) para o histórico.
      const ex0 = () => p.locator('.ex >> nth=0');
      for (const [kg, reps] of [['60', '8'], ['60', '7']]) {
        const r = ex0().locator('.set:not(.warm)').nth(kg === '60' && reps === '8' ? 0 : 1);
        await r.locator('input').nth(0).fill(kg); await r.locator('input').nth(1).fill(reps); await r.locator('.ck').click();
      }
      assert.ok(await ex0().evaluate((e) => e.classList.contains('collapsed')));
      assert.equal(await ex0().locator('.sum').textContent(), '✓ 2 séries · melhor 60 kg × 8');
      assert.equal(await ex0().locator('.sets').isVisible(), false);
      await ex0().locator('.exh').click();
      assert.ok(await ex0().locator('.sets').isVisible());
      await ex0().locator('.exh').click();
      assert.equal(await ex0().locator('.sets').isVisible(), false);
      await p.click('#wnext');
      const r2 = ex0().locator('.set:not(.warm)').nth(0);
      await r2.locator('input').nth(0).fill('65'); await r2.locator('input').nth(1).fill('8'); await r2.locator('.ck').click();
      // Histórico pelo botão 📈.
      await ex0().locator('.hbtn').click();
      assert.equal(await p.textContent('.tipbox h2'), '45° Incline Barbell Press');
      assert.equal(await p.locator('.hist li').count(), 2);
      assert.match(await p.textContent('.hist li >> nth=0'), /semana 2 · Upper · 1RM est\. 82,3 kg/);
      assert.deepEqual(await p.locator('.hist li >> nth=1 >> .ss span').allTextContents(), ['60 × 8', '60 × 7']);
      assert.deepEqual(await p.locator('.hist .hk b').allTextContents(), ['2', '82,3 kg', '+6,3 kg']);
      assert.equal(await p.locator('.hist svg').count(), 1);
      await p.click('.tipbox >> text=Fechar');
      // Também abre pelo painel de Progresso.
      await p.click('#bprog');
      await p.click('#progress .exr >> nth=0');
      assert.equal(await p.textContent('.tipbox h2'), '45° Incline Barbell Press');
      await ctx.close();
    });

    await t.test('anotação e energia, duração, recorde, anilhas e modo foco', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      const ex0 = () => p.locator('.ex >> nth=0');
      const mark = async (card, i, kg, reps) => { const r = card.locator('.set:not(.warm)').nth(i); await r.locator('input').nth(0).fill(kg); await r.locator('input').nth(1).fill(reps); await r.locator('.ck').click(); };
      // Semana 1: duas séries, com 47 min entre elas (relógio adiantado só entre as marcações).
      await mark(ex0(), 0, '60', '8');
      await p.evaluate(() => { const real = Date.now; const off = 47 * 60000; Date.now = () => real() + off; });
      await mark(ex0(), 1, '60', '7');
      await p.waitForFunction(() => /Duração: 47 min/.test(document.getElementById('sessdur').textContent));
      // Energia e anotação ficam no treino e aparecem no histórico.
      await p.click('#sess [aria-label="Energia 5: Ótimo"]');
      await p.fill('#sess textarea', 'Dormi bem');
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Salvo');
      await p.reload();
      assert.equal(await p.textContent('#title'), 'Lower'); // treino feito: abre no dia seguinte
      await p.click('.tab >> nth=0');
      assert.equal(await p.getAttribute('#sess [aria-label="Energia 5: Ótimo"]', 'aria-pressed'), 'true');
      assert.equal(await p.inputValue('#sess textarea'), 'Dormi bem');
      // Semana 2: carga maior que a da semana 1 = recorde (toast e 🏅).
      await p.click('#wnext');
      assert.equal(await p.inputValue('#sess textarea'), '');
      await mark(ex0(), 0, '65', '8');
      await p.waitForSelector('#toast.on >> text=🏅 Recorde! 45° Incline Barbell Press: 65 kg × 8');
      assert.ok(await ex0().locator('.set:not(.warm) >> nth=0').evaluate((e) => e.classList.contains('pr')));
      // Mesma carga com menos reps não é recorde.
      await mark(ex0(), 1, '60', '6');
      assert.equal(await ex0().locator('.set:not(.warm) >> nth=1').evaluate((e) => e.classList.contains('pr')), false);
      await ex0().locator('.hbtn').click();
      assert.match(await p.locator('.hist li', { hasText: 'semana 1 ·' }).textContent(), /💪 Dormi bem/);
      await p.click('.tipbox >> text=Fechar');
      // Anilhas: preenche com a carga do último campo tocado.
      await ex0().locator('.set:not(.warm) >> nth=0 >> input >> nth=0').focus();
      await tool(p, '#bplates');
      assert.equal(await p.inputValue('.pl input[aria-label="Carga total"]'), '65');
      assert.equal(await p.textContent('.pl .res'), 'Cada lado: 20 + 2,5 kg');
      await p.fill('.pl input[aria-label="Carga total"]', '100');
      assert.equal(await p.textContent('.pl .res'), 'Cada lado: 25 + 15 kg');
      assert.equal(await p.locator('.pl .bar i:not(.rod)').count(), 4);
      await p.click('.pl .have >> text=15 kg');
      assert.equal(await p.textContent('.pl .res'), 'Cada lado: 25 + 10 + 5 kg');
      await p.fill('.pl input[aria-label="Carga total"]', '61');
      assert.match(await p.textContent('.pl .warn2'), /Faltam 1 kg/);
      await p.click('.pl >> text=Fechar');
      // Modo foco: só o exercício atual, avança sozinho ao completar.
      await p.click('#bfocus');
      // Na semana 2 o supino tem 3 séries e só 2 foram feitas: o foco começa nele.
      assert.equal(await p.textContent('#fbar span'), '1 de 7');
      assert.equal(await p.locator('.ex:visible').count(), 1);
      assert.equal(await p.isVisible('#bexp'), false);
      const cur = p.locator('.ex.cur');
      await mark(cur, 2, '60', '6');
      await p.waitForFunction(() => document.querySelector('#fbar span').textContent === '2 de 7');
      await p.click('[aria-label="Exercício anterior"]');
      assert.equal(await p.textContent('#fbar span'), '1 de 7');
      assert.ok(await p.locator('.ex.cur .sets').isVisible());
      await p.click('#bfocus');
      assert.equal(await p.textContent('#bfocus'), 'Modo foco');
      assert.equal(await p.locator('.ex:visible').count(), 7);
      await ctx.close();
    });

    await t.test('sugestão de carga, semana, nota anterior, tema, tela acesa e novidades', async () => {
      const ctx = await browser.newContext({ colorScheme: 'light' });
      // Trava de tela falsa para contar pedidos e liberações.
      await ctx.addInitScript(() => {
        window.__wake = { req: 0, rel: 0 };
        Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { window.__wake.req++; const l = new EventTarget(); l.release = async () => { window.__wake.rel++; l.dispatchEvent(new Event('release')); }; return l; } } });
      });
      const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      assert.equal(await p.evaluate(() => window.__wake.req), 0); // não acende só por abrir
      const ex0 = () => p.locator('.ex >> nth=0');
      const mark = async (card, i, kg, reps) => { const r = card.locator('.set:not(.warm)').nth(i); await r.locator('input').nth(0).fill(kg); await r.locator('input').nth(1).fill(reps); await r.locator('.ck').click(); };
      await mark(ex0(), 0, '60', '8'); await mark(ex0(), 1, '60', '8');
      assert.equal(await p.evaluate(() => window.__wake.req), 1);
      await p.click('#sess [aria-label="Energia 4: Bom"]');
      await p.fill('#sess textarea', 'Banco na posição 4');
      await p.waitForFunction(() => document.getElementById('status').textContent === 'Salvo');
      // Semana 2: sugestão 62,5 × 6 (topo 8 batido); ✓ vazio usa a sugestão.
      await p.click('#wnext');
      assert.match(await p.textContent('#prevnote'), /Da última vez \(semana 1, .*\): 🙂 Banco na posição 4/);
      const s0 = ex0().locator('.set:not(.warm) >> nth=0');
      assert.equal(await s0.locator('input >> nth=0').getAttribute('placeholder'), '62.5');
      assert.equal(await s0.locator('input >> nth=1').getAttribute('placeholder'), '6');
      assert.ok(await s0.locator('.fld >> nth=0').evaluate((e) => e.classList.contains('sug')));
      await s0.locator('.ck').click();
      assert.equal(await s0.locator('input >> nth=0').inputValue(), '62.5');
      // Incremento ajustável na calculadora de anilhas.
      await tool(p, '#bplates');
      await p.selectOption('.pl select[aria-label="Incremento da sugestão de carga"]', '5');
      await p.click('.pl >> text=Fechar');
      await p.click('#wnext');
      await p.click('#wprev');
      assert.equal(await ex0().locator('.set:not(.warm) >> nth=1 >> input >> nth=0').getAttribute('placeholder'), '65');
      // Resumo da semana no Progresso.
      await p.click('#bprog');
      assert.deepEqual(await p.locator('#weekkpis b').allTextContents(), ['2', '1.335 kg', '1', '4 / 5']);
      const [img] = await Promise.all([p.waitForEvent('download').catch(() => null), p.click('#progress >> text=Imagem da semana')]);
      assert.ok(img === null || /^semana-.*\.png$/.test(img.suggestedFilename()));
      await p.click('#bprog');
      // Tema: automático → claro → escuro, e a cor do dia acompanha.
      assert.equal(await p.textContent('#btheme'), 'Tema: automático');
      await tool(p, '#btheme'); await p.click('#btheme');
      assert.equal(await p.textContent('#btheme'), 'Tema: escuro');
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
      assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(14, 18, 23)');
      assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--day').trim()), '#7b9cff');
      await p.reload();
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
      // Novidades: aparece depois de uma atualização (versão vista diferente) e fica no menu.
      await p.evaluate(() => localStorage.setItem('cg:seenVersion', 'v0.2.6'));
      await p.reload();
      await p.waitForSelector('.tipbox >> text=Novidades da atualização');
      assert.ok(await p.locator('.tipbox h3', { hasText: 'v0.2.7' }).count() === 1);
      await p.click('.tipbox >> text=Fechar');
      await p.reload();
      await p.waitForTimeout(600);
      assert.equal(await p.isVisible('.tipbox'), false);
      await tool(p, '#bnews');
      assert.equal(await p.textContent('.tipbox h2'), 'Novidades');
      await ctx.close();
    });

    await t.test('volume por semana, substituição lembrada, repetir cargas e planilha CSV', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      const ex0 = () => p.locator('.ex >> nth=0');
      // Semana 1: troca o supino pela alternativa de halter e registra.
      await ex0().locator('.chip >> text=45° Incline DB Press').click();
      const r0 = ex0().locator('.set:not(.warm) >> nth=0');
      await r0.locator('input >> nth=0').fill('24'); await r0.locator('input >> nth=1').fill('8'); await r0.locator('.ck').click();
      assert.equal(await p.isVisible('#brepeat'), false); // dia já tem registro
      // Semana 2: a alternativa já vem escolhida; 8 reps foi o topo da faixa, então o atalho usa a sugestão 26,5 × 6, sem marcar.
      await p.click('#wnext');
      assert.equal(await ex0().locator('h2').textContent(), '45° Incline DB Press');
      assert.equal(await ex0().locator('.chip[aria-pressed="true"]').textContent(), '45° Incline DB Press');
      assert.ok(await p.isVisible('#brepeat'));
      await p.click('#brepeat');
      assert.equal(await ex0().locator('.set:not(.warm) >> nth=0 >> input >> nth=0').inputValue(), '26.5');
      assert.equal(await ex0().locator('.set:not(.warm) >> nth=0 >> input >> nth=1').inputValue(), '6');
      assert.equal(await p.locator('.set.done').count(), 0);
      assert.equal(await p.isVisible('#brepeat'), false);
      await ex0().locator('.set:not(.warm) >> nth=0 >> .ck').click();
      // O histórico da alternativa tem as duas semanas.
      await ex0().locator('.hbtn').click();
      assert.equal(await p.locator('.hist li').count(), 2);
      await p.click('.tipbox >> text=Fechar');
      // Volume por semana: S1 = 24×8 = 192, S2 = 26,5×6 = 159.
      await p.click('#bprog');
      assert.match(await p.getAttribute('#progress svg.vol', 'aria-label'), /^Volume por semana: S1 192 kg, S2 159 kg, S3 0 kg/);
      assert.equal(await p.locator('#progress svg.vol rect').count(), 12);
      await p.click('#bprog');
      // Planilha CSV.
      const [dl] = await Promise.all([p.waitForEvent('download'), tool(p, '#bcsv')]);
      assert.match(dl.suggestedFilename(), /^caderno-de-cargas-\d{4}-\d{2}-\d{2}\.csv$/);
      const text = fs.readFileSync(await dl.path(), 'utf8');
      const lines = text.replace(/^\ufeff/, '').trim().split('\r\n');
      // S1: 1 série; S2: as 3 séries preenchidas pelo atalho, só a 1ª marcada.
      assert.equal(lines.length, 5);
      assert.match(lines[1], /;1;Upper;45° Incline DB Press;valida;1;24;8;sim;;$/);
      assert.match(lines[2], /;2;Upper;45° Incline DB Press;valida;1;26,5;6;sim;;$/);
      assert.match(lines[4], /;2;Upper;45° Incline DB Press;valida;3;26,5;6;não;;$/);
      await ctx.close();
    });

    await t.test('convite para importar o backup no app vazio', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      assert.ok(await p.isVisible('#freshnote >> text=Importar backup'));
      await fill(p, '50', '8');
      await p.waitForFunction(() => document.getElementById('freshnote').hidden);
      await p.reload();
      assert.equal(await p.isVisible('#freshnote'), false);
      await ctx.close();
    });

    const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
    assert.deepEqual(real, []);
  } finally {
    await browser.close(); srv.close();
  }
});
