// Detalhes do programa do Jeff que não vêm no app: séries de aquecimento (aq), RPE das séries (rpe),
// RPE da última série (rpeUlt) e técnica da última série (tec, ver tips.js).
// Formato: { semana: { dia: [ { aq, rpe, rpeUlt, tec }, ... na mesma ordem dos exercícios ] } }
// Não ficam no código: o usuário importa o arquivo de detalhes dele (Importar backup) e eles ficam
// guardados só no aparelho, em localStorage "cg:extra", e nos backups dele.
window.BTS_EXTRA = (function () {
  try { const v = JSON.parse(localStorage.getItem('cg:extra')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
})();
