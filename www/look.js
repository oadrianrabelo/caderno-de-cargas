// Aparência: paleta de cores e fontes (títulos, números e texto). Roda no <head>, antes de desenhar a
// tela, para não piscar com a fonte ou a cor errada. Só visual: não toca nos treinos.
(function (root) {
  // Paletas: [id, nome, [fundo, cartão, destaque] no claro, idem no escuro] (as cores de verdade estão no theme.css).
  const PALETTES = [
    ['areia', 'Areia', ['#f2efe9', '#fffdf9', '#8f6328'], ['#0c0d0f', '#15171a', '#e3c28f']],
    ['salvia', 'Sálvia', ['#eef0ea', '#fbfcf8', '#56693f'], ['#0d0f0d', '#151916', '#b7c99a']],
    ['ardosia', 'Ardósia', ['#eceef1', '#fcfdfe', '#3d5a80'], ['#0b0d10', '#14171c', '#9db4d6']],
    ['vinho', 'Vinho', ['#f3eeec', '#fffcfb', '#7d2f3a'], ['#0f0b0c', '#191314', '#e0a3aa']],
    ['terracota', 'Terracota', ['#f4ede6', '#fffaf5', '#a4532f'], ['#100c0a', '#1a1411', '#e6a07c']],
    ['noite', 'Meia-noite', ['#eff0f5', '#fdfdff', '#4b4fa8'], ['#0b0c16', '#131522', '#a9adf0']],
    ['tinta', 'Tinta', ['#f4f4f2', '#ffffff', '#111111'], ['#000000', '#0f0f10', '#f2f2f2']]
  ];
  // Fontes: [id, nome, família CSS, tipo]. Bricolage e Geist já vêm no fonts.css; as outras em font-<id>.css.
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const FONTS = [
    ['bricolage', 'Bricolage Grotesque', '"Bricolage"', 'sans'],
    ['geist', 'Geist', '"Geist"', 'sans'],
    ['space-grotesk', 'Space Grotesk', '"Space Grotesk"', 'sans'],
    ['manrope', 'Manrope', '"Manrope"', 'sans'],
    ['schibsted', 'Schibsted Grotesk', '"Schibsted Grotesk"', 'sans'],
    ['hanken', 'Hanken Grotesk', '"Hanken Grotesk"', 'sans'],
    ['sora', 'Sora', '"Sora"', 'sans'],
    ['plex-sans', 'IBM Plex Sans', '"IBM Plex Sans"', 'sans'],
    ['unbounded', 'Unbounded', '"Unbounded"', 'sans'],
    ['fraunces', 'Fraunces', '"Fraunces"', 'serif'],
    ['instrument', 'Instrument Serif', '"Instrument Serif"', 'serif'],
    ['geist-mono', 'Geist Mono', '"Geist Mono"', 'mono'],
    ['jetbrains', 'JetBrains Mono', '"JetBrains Mono"', 'mono'],
    ['lilex', 'Lilex', '"Lilex"', 'mono'],
    ['plex-mono', 'IBM Plex Mono', '"IBM Plex Mono"', 'mono'],
    ['commit', 'Commit Mono', '"Commit Mono"', 'mono'],
    ['fira-code', 'Fira Code', '"Fira Code"', 'mono'],
    ['martian', 'Martian Mono', '"Martian Mono"', 'mono'],
    ['red-hat-mono', 'Red Hat Mono', '"Red Hat Mono"', 'mono']
  ];
  const BUILTIN = ['bricolage', 'geist'];
  const DEFAULT = { palette: 'areia', title: 'bricolage', num: 'bricolage', text: 'geist' };
  const font = (id) => FONTS.find((f) => f[0] === id);
  const stack = (f) => f[2] + ', ' + (f[3] === 'mono' ? MONO : f[3] === 'serif' ? 'Georgia, serif' : SANS);

  function get() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem('cg:look')) || {}; } catch (e) { /* sem armazenamento */ }
    const out = Object.assign({}, DEFAULT);
    if (PALETTES.some((p) => p[0] === v.palette)) out.palette = v.palette;
    ['title', 'num', 'text'].forEach((k) => { if (font(v[k])) out[k] = v[k]; });
    return out;
  }
  function load(id) {
    if (BUILTIN.indexOf(id) >= 0 || !font(id) || document.getElementById('font-' + id)) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'font-' + id + '.css'; l.id = 'font-' + id;
    document.head.appendChild(l);
  }
  function apply(v) {
    const el = document.documentElement;
    if (v.palette === DEFAULT.palette) delete el.dataset.palette; else el.dataset.palette = v.palette;
    [['title', '--f-display'], ['num', '--f-num'], ['text', '--f-body']].forEach(([k, css]) => { load(v[k]); el.style.setProperty(css, stack(font(v[k]))); });
    if (font(v.num)[3] === 'mono') el.dataset.nummono = ''; else delete el.dataset.nummono;
    if (font(v.title)[3] === 'mono') el.dataset.titlemono = ''; else delete el.dataset.titlemono;
    // IBM Plex Mono vai sem modificação (nome reservado na licença): o zero cortado vem do recurso "zero" da fonte.
    if ([v.title, v.num, v.text].indexOf('plex-mono') >= 0) el.dataset.fzero = ''; else delete el.dataset.fzero;
  }
  function set(patch) {
    const v = Object.assign(get(), patch);
    try { localStorage.setItem('cg:look', JSON.stringify(v)); } catch (e) { /* sem armazenamento */ }
    apply(v);
    document.dispatchEvent(new CustomEvent('cg:theme'));
    return v;
  }
  function reset() {
    try { localStorage.removeItem('cg:look'); } catch (e) { /* sem armazenamento */ }
    apply(get());
    document.dispatchEvent(new CustomEvent('cg:theme'));
  }

  apply(get());
  root.CGLook = { PALETTES, FONTS, DEFAULT, get, set, reset, load, stack: (id) => stack(font(id)) };
})(window);
