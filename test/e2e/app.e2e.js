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
      await p2.click('#bcloud');
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
      await p.click('#bcloud');
      await p.waitForSelector('#cloud >> text=Sem internet: envio quando voltar o sinal', { timeout: 10000 });
      assert.equal(await p.textContent('#bcloud'), 'Nuvem •');
      await p.reload();
      await p.click('.tab >> nth=0');
      assert.equal(await p.inputValue('.set >> nth=0 >> input >> nth=0'), '20');
      await ctx.close();
    });

    await t.test('Google Drive: navegador mostra que é só no app; no app conecta, envia e baixa', async () => {
      const ctx0 = await browser.newContext(); const p0 = await ctx0.newPage(); watch(p0);
      await p0.goto(url); await p0.click('#bcloud');
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
      await p.click('#bcloud');
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
      await p2.click('#bcloud');
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
      for (const id of ['#cloud', '#progress', '#programs', '#skipnote']) assert.equal(await p.isVisible(id), false, id);
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
      await p.click('#bprogs');
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

      await p.click('#bprogs');
      await p.click('#programs .it >> nth=1 >> text=Editar dias');
      await p.fill('#programs [aria-label="Nome do dia 2"]', 'Costas');
      await p.click('#programs >> text=Salvar');
      assert.equal(await p.textContent('.tab >> nth=1'), 'Costas');
      await p.click('#programs .it >> nth=0 >> text=Usar');
      assert.equal(await p.locator('.tab').count(), 5);
      assert.equal(await p.textContent('#title'), 'Upper');
      await p.click('#bprogs');
      await p.click('#programs .it >> nth=1 >> text=Excluir');
      await p.click('#programs .it >> nth=1 >> text=Toque de novo para excluir');
      assert.equal(await p.locator('#programs .it').count(), 1);
      await ctx.close();
    });

    await t.test('programa a partir do Jeff copia os exercícios e vai no backup', async () => {
      const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage(); watch(p);
      await p.goto(url);
      await p.click('#bprogs');
      await p.click('#programs >> text=+ Criar meu programa');
      await p.click('#programs >> text=Partir do treino do Jeff');
      await p.click('#programs >> text=Criar e usar');
      assert.equal(await p.textContent('#sub'), 'Meu Jeff');
      assert.equal(await p.textContent('.ex h2 >> nth=0'), '45° Incline Barbell Press');
      await fill(p, '30', '10');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bexp')]);
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
        await ctx.route('https://api.github.com/repos/**/releases/latest', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(release), headers: { 'Access-Control-Allow-Origin': '*' } }));
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
      assert.deepEqual(await p2.evaluate(() => window.__http), []);
      await ctx2.close();
    });

    const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
    assert.deepEqual(real, []);
  } finally {
    await browser.close(); srv.close();
  }
});
