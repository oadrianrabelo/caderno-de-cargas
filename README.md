# Caderno de Cargas

Caderno de cargas de academia para Android. Funciona 100% offline e já vem com o programa
*Bodybuilding Transformation System* (12 semanas, Upper / Lower / Pull / Push / Legs).

É o mesmo HTML de sempre (`www/index.html`) empacotado com [Capacitor](https://capacitorjs.com/)
num WebView local. Não usa servidor nem framework.

## Instalar no celular

1. Abra a página [Releases](../../releases) no celular e baixe o `.apk` mais recente.
2. Toque no arquivo baixado. Se o Android bloquear, permita **instalar apps desconhecidos**
   para o navegador ou para o app de arquivos (*Configurações → Apps → Acesso especial → Instalar apps desconhecidos*).
3. Abra **Caderno de Cargas**.

> **Atualizações:** o APK assinado com a keystore do repositório (`…-release.apk`) atualiza por cima
> do anterior, sem perder dados. O APK `…-debug.apk` é gerado quando não há keystore configurada,
> e cada build debug do CI tem uma assinatura diferente: para instalar uma nova versão, é preciso
> desinstalar a anterior, e **desinstalar apaga os dados**. Faça backup antes.

## Backup dos dados

Os dados ficam só no celular, no armazenamento do app (e numa cópia espelho interna).
Desinstalar o app ou usar *Limpar dados* apaga tudo. Por isso:

- **Exportar backup**: gera um `.json` e abre o menu de compartilhar. Mande para o Google Drive,
  para o seu e-mail ou para o WhatsApp.
- **Importar backup**: escolha o `.json`. **Ele substitui** os dados atuais do aparelho, não mescla.
- **Nuvem (opcional)**: guarda uma cópia automática num *gist secreto* do GitHub.
  1. Crie um token em <https://github.com/settings/tokens/new?scopes=gist&description=Caderno%20de%20Cargas>
     (token *classic*, só a permissão **gist**).
  2. No app, toque em **Nuvem**, cole o token e toque em **Conectar**.
  3. Com sinal, o app envia sozinho alguns segundos depois de cada alteração. Sem sinal, ele envia quando a
     internet voltar (o botão mostra **Nuvem •** quando há algo pendente e **Nuvem ✓** quando está em dia).
  4. Em outro aparelho, conecte com o mesmo token e toque em **Baixar da nuvem**.

  Se usar dois aparelhos, o último envio vale. O token fica salvo só no aparelho e não entra no backup
  exportado. **Desconectar** apaga o token.

## Gerar o APK localmente

Requisitos: Node 22+, JDK 21 e Android SDK (o jeito mais fácil é instalar o Android Studio).

```bash
npm ci
npm test
npm run apk          # cap sync + ./gradlew assembleDebug
# APK em android/app/build/outputs/apk/debug/app-debug.apk
```

Para abrir no Android Studio: `npx cap open android`.

Depois de mudar qualquer arquivo em `www/`, rode `npx cap sync android` antes de compilar.

## Publicar uma versão (GitHub Actions)

Todo push roda os testes e compila um APK (disponível como *artifact* da execução).
Uma tag `v*` também cria a Release com o APK anexado:

```bash
git tag v0.1.0
git push origin v0.1.0
```

### APK de release assinado (recomendado)

Gere uma keystore **uma vez**, guarde-a em lugar seguro (sem ela não dá para atualizar o app) e
**nunca** a coloque no repositório:

```bash
keytool -genkeypair -v -keystore caderno.jks -alias caderno -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 caderno.jks > caderno.jks.b64     # no macOS: base64 -i caderno.jks -o caderno.jks.b64
```

Em *Settings → Secrets and variables → Actions*, crie:

| Secret | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | conteúdo de `caderno.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | senha da keystore |
| `ANDROID_KEY_ALIAS` | `caderno` |
| `ANDROID_KEY_PASSWORD` | senha da chave (a mesma, se você não definiu outra) |

## Estrutura

| Caminho | O que é |
| --- | --- |
| `www/index.html` | o app (fonte da verdade) |
| `www/logic.js` | lógica pura: próximo treino, última carga, backup, cópia de semanas |
| `www/native.js` | só no Android: exportar via compartilhar e espelho dos dados |
| `www/sync.js` | salvamento opcional na nuvem (GitHub Gist) |
| `test/` | testes com `node:test` (`npm test`); `npm run test:e2e` roda o teste no Chromium (precisa do Playwright) |
| `assets/` | ícone e splash (`halter.svg` é a fonte) |
| `android/` | projeto Android gerado pelo Capacitor |

Os testes rodam antes de cada commit (hook em `.githooks/`, ativado pelo `npm install`).
