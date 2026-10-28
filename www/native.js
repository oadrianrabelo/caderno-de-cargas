// Recursos do app Android (Capacitor). No navegador este arquivo não faz nada.
(function () {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !window.CGApp) return;
  const plugin = (n) => (cap.Plugins && cap.Plugins[n]) || cap.registerPlugin(n);
  const FS = plugin('Filesystem'), Share = plugin('Share');
  const MIRROR = 'caderno-espelho.json';

  // Exportar backup: grava o JSON no cache do app e abre o menu de compartilhar (Drive, WhatsApp, e-mail...).
  window.CGNative = {
    async shareBackup(name, json) {
      const { uri } = await FS.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      try {
        await Share.share({ title: 'Backup do Caderno de Cargas', files: [uri], dialogTitle: 'Salvar backup em…' });
      } catch (e) {
        // Vários apps de destino devolvem "cancelado" mesmo depois de receber o arquivo.
        if (/cancel/i.test(String(e && e.message))) return 'Compartilhamento fechado';
        throw e;
      }
      return 'Backup exportado';
    },
    // Imagem (PNG em base64, sem o prefixo data:) para o menu de compartilhar: WhatsApp, Instagram, galeria...
    async shareImage(name, base64) {
      const { uri } = await FS.writeFile({ path: name, data: base64, directory: 'CACHE' });
      try {
        await Share.share({ title: 'Caderno de Cargas', files: [uri], dialogTitle: 'Compartilhar imagem' });
      } catch (e) {
        if (/cancel/i.test(String(e && e.message))) return 'Compartilhamento fechado';
        throw e;
      }
      return 'Imagem compartilhada';
    }
  };

  // Espelho dos dados em arquivo, além do localStorage. Se o armazenamento do WebView
  // for apagado (por exemplo, numa atualização do WebView), o caderno se recupera dele.
  let timer = null;
  const writeMirror = () => FS.writeFile({ path: MIRROR, data: CGApp.snapshot(), directory: 'DATA', encoding: 'utf8' }).catch(() => {});
  CGApp.saved.push(() => { clearTimeout(timer); timer = setTimeout(writeMirror, 1000); });

  if (CGApp.isEmpty()) {
    FS.readFile({ path: MIRROR, directory: 'DATA', encoding: 'utf8' })
      .then(({ data }) => { if (CGApp.isEmpty() && CGApp.restore(data)) CGApp.status('Dados recuperados'); })
      .catch(() => { /* ainda não existe espelho */ });
  }
})();
