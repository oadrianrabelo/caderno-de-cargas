# Changelog

Mudanças do Caderno de Cargas por versão. Gerado de `www/changelog.js` com `npm run changelog`.

## v0.3.2 (2026-11-09)

- Correção: a série de recorde (🏅) não muda mais de layout; a medalha só aparece ao lado do número.
- Correção: o cartão "Como foi o treino?" não se repete mais ao terminar exercícios.
- A carga sugerida só aparece antes de começar o exercício; depois da primeira série marcada, os números cinza voltam a ser os da última vez.

## v0.3.1 (2026-11-04)

- Volta a atualizar sozinho no APK que você já tem: não precisa instalar APK novo. Traz tudo da v0.2.9 (gráfico de volume, substituição lembrada, preencher cargas, planilha CSV).
- O lembrete por notificação saiu por enquanto, porque ele exige um APK novo.
- A busca de atualização olha todas as versões e pega a mais nova compatível com o seu APK, então uma versão que exige APK não trava mais as outras.

## v0.3.0 (2026-11-03)

- Lembrete de treino: notificação nos dias e no horário que você escolher, com o próximo treino (Mais ▾ → Lembrete de treino).
- Esta versão precisa instalar o APK. O aviso tem "1. Exportar backup" e "2. Baixar APK", e um app reinstalado e vazio oferece "Importar backup".
- Daqui para frente os APKs saem com a mesma assinatura, para instalar por cima sem desinstalar.

## v0.2.9 (2026-11-03)

- Gráfico de volume por semana no Progresso, com a semana atual destacada.
- Substituição lembrada: se você trocou o exercício pela alternativa, ela já vem escolhida nas próximas semanas.
- Atalho "Preencher com as cargas da última vez" no topo do dia, sem marcar nada como feito.
- Exportar planilha (CSV) com todas as séries, para abrir no Excel ou no Google Sheets (Mais ▾).

## v0.2.8 (2026-11-03)

- Sugestão de carga: quando você bateu o topo das reps em todas as séries, os números cinza e o ✓ usam a carga + 2,5 kg (ajustável em Anilhas).
- Resumo da semana no Progresso: treinos, séries, volume, recordes e energia média, com imagem para compartilhar.
- Lembrete da última vez: o cartão "Como foi o treino?" mostra a anotação da última vez que você fez esse dia.
- Tema claro, escuro ou automático (Mais ▾ → Tema).
- A tela fica acesa só durante o treino e volta ao normal ao concluir ou após 30 min sem marcar séries.
- Novidades: esta tela, que aparece depois de cada atualização (Mais ▾ → Novidades).

## v0.2.7 (2026-11-03)

- "Como foi o treino?": energia de 1 a 5 e anotações, que aparecem no histórico.
- Duração do treino (da primeira à última série) no cartão do dia, na comemoração e na imagem.
- Recorde pessoal 🏅 ao superar a maior carga ou o maior 1RM estimado do exercício.
- Calculadora de anilhas (Mais ▾ → Anilhas).
- Modo foco: um exercício por vez, em letras grandes, avançando sozinho.

## v0.2.6 (2026-11-03)

- Menu "Mais ▾" com os botões menos usados.
- Exercícios completos ficam recolhidos numa linha com o resumo.
- Histórico de cada exercício (📈) com sessões, cargas e evolução do 1RM estimado.

## v0.2.5 (2026-11-03)

- Cor por dia (Upper, Lower, Pull, Push, Legs).
- Animações ao marcar séries, selo verde no exercício completo e rolagem até o próximo.
- Comemoração ao concluir o treino, com botão de compartilhar a imagem.
- Abas cabem inteiras em telas estreitas.

## v0.2.4 (2026-11-03)

- Cronômetro de descanso ao marcar cada série.
- Dica para subir a carga quando você bate o topo das reps.
- Lembrete de backup após 7 dias e "Desfazer importação".
- Correção: backup com logs vazios não trava mais o app.

## v0.2.3 (2026-11-03)

- Importar o arquivo de detalhes do programa (aquecimento, RPE e técnica).
- Aquecimento aceita faixas como 2-3 séries.

## v0.2.2 (2026-10-31)

- Painel Versão e atualização automática com repositório privado (token de leitura).

## v0.2.1 (2026-10-30)

- Aquecimento, RPE e técnica da última série em cada exercício, editáveis.
- Selo Força/Hipertrofia, dicas e Glossário.

## v0.2.0 (2026-10-28)

- Pular treino, painel de Progresso, imagens para compartilhar e programas próprios.
- Atualização automática pelo GitHub, sem baixar APK.

## v0.1.0 (2026-10-28)

- Primeira versão Android: caderno offline, backup pelo menu de compartilhar e nuvem opcional (Google Drive ou GitHub Gist).
