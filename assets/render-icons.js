// Gera os PNGs de origem para @capacitor/assets a partir de assets/halter.svg.
const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2];
const svg = fs.readFileSync(dir + '/halter.svg', 'utf8');
const variants = {
  'icon-only.png': [1024, svg],
  'icon-background.png': [1024, svg.replace(/<g id="halter"[\s\S]*?<\/g>/, '')],
  // Primeiro plano adaptativo: transparente; o Android ainda aplica recuo e máscara circular.
  'icon-foreground.png': [1024, svg.replace(/<rect id="bg"[^>]*\/>/, '').replace('transform="rotate(-35 512 512)"', 'transform="translate(512 512) scale(.8) translate(-512 -512) rotate(-35 512 512)"')],
  'splash.png': [2732, svg.replace('transform="rotate(-35 512 512)"', 'transform="translate(512 512) scale(.28) translate(-512 -512) rotate(-35 512 512)"')],
};
variants['splash-dark.png'] = [2732, variants['splash.png'][1].replace('fill="#1f4fd8"', 'fill="#0e1217"').replace('fill="#ffffff"', 'fill="#7b9cff"')];
(async () => {
  const b = await chromium.launch();
  for (const [name, [size, s]] of Object.entries(variants)) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: dir + '/' + name, omitBackground: true });
    await p.close();
  }
  await b.close();
})();
