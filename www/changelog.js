// Novidades por versão (mais recente primeiro). Fonte do CHANGELOG.md (npm run changelog).
window.CG_CHANGELOG = [
  { version: 'v0.3.5', date: '2026-11-10', items: [
    'Correção: o calendário marcava o treino no dia da última alteração, e não no dia em que foi feito (um treino editado no dia seguinte "pulava" de dia). Agora vale o horário das séries marcadas.',
    'Correção: editar um treino antigo não muda mais qual é o próximo treino nem a "última vez" das cargas.',
    'O cartão "Como foi o treino?" mostra a data do treino com "Alterar", para corrigir quando você registrou o treino em outro dia.',
    'O histórico do exercício (📈) mostra a data em que o treino foi feito.'
  ] },
  { version: 'v0.3.4', date: '2026-11-09', items: [
    'Aquecimento puxa a última vez: os campos A1, A2… mostram em cinza a carga e as reps do aquecimento da última sessão.',
    '"Preencher com as cargas da última vez" agora preenche o aquecimento também.',
    'O histórico do exercício (📈) mostra o aquecimento de cada sessão, separado das séries válidas (fora do 1RM e dos recordes).',
    'Correção: o histórico mostrava "+— kg" quando a evolução era zero.'
  ] },
  { version: 'v0.3.3', date: '2026-11-09', items: [
    'Cada técnica da última série tem sua cor: Falha vermelha, LLPs roxa, Myo-reps laranja, Drop set azul-petróleo, Alongamento estático dourada.',
    'A última série fica destacada na cor da técnica (fundo, borda, etiqueta e ✓), e a etiqueta "Última série" e o glossário usam a mesma cor.',
    'Ao marcar a penúltima série, aparece o aviso "Próxima é a última: MYO-REPS" (ou a técnica do exercício).'
  ] },
  { version: 'v0.3.2', date: '2026-11-09', items: [
    'Correção: a série de recorde (🏅) não muda mais de layout; a medalha só aparece ao lado do número.',
    'Correção: o cartão "Como foi o treino?" não se repete mais ao terminar exercícios.',
    'A carga sugerida só aparece antes de começar o exercício; depois da primeira série marcada, os números cinza voltam a ser os da última vez.'
  ] },
  { version: 'v0.3.1', date: '2026-11-04', items: [
    'Volta a atualizar sozinho no APK que você já tem: não precisa instalar APK novo. Traz tudo da v0.2.9 (gráfico de volume, substituição lembrada, preencher cargas, planilha CSV).',
    'O lembrete por notificação saiu por enquanto, porque ele exige um APK novo.',
    'A busca de atualização olha todas as versões e pega a mais nova compatível com o seu APK, então uma versão que exige APK não trava mais as outras.'
  ] },
  { version: 'v0.3.0', date: '2026-11-03', items: [
    'Lembrete de treino: notificação nos dias e no horário que você escolher, com o próximo treino (Mais ▾ → Lembrete de treino).',
    'Esta versão precisa instalar o APK. O aviso tem "1. Exportar backup" e "2. Baixar APK", e um app reinstalado e vazio oferece "Importar backup".',
    'Daqui para frente os APKs saem com a mesma assinatura, para instalar por cima sem desinstalar.'
  ] },
  { version: 'v0.2.9', date: '2026-11-03', items: [
    'Gráfico de volume por semana no Progresso, com a semana atual destacada.',
    'Substituição lembrada: se você trocou o exercício pela alternativa, ela já vem escolhida nas próximas semanas.',
    'Atalho "Preencher com as cargas da última vez" no topo do dia, sem marcar nada como feito.',
    'Exportar planilha (CSV) com todas as séries, para abrir no Excel ou no Google Sheets (Mais ▾).'
  ] },
  { version: 'v0.2.8', date: '2026-11-03', items: [
    'Sugestão de carga: quando você bateu o topo das reps em todas as séries, os números cinza e o ✓ usam a carga + 2,5 kg (ajustável em Anilhas).',
    'Resumo da semana no Progresso: treinos, séries, volume, recordes e energia média, com imagem para compartilhar.',
    'Lembrete da última vez: o cartão "Como foi o treino?" mostra a anotação da última vez que você fez esse dia.',
    'Tema claro, escuro ou automático (Mais ▾ → Tema).',
    'A tela fica acesa só durante o treino e volta ao normal ao concluir ou após 30 min sem marcar séries.',
    'Novidades: esta tela, que aparece depois de cada atualização (Mais ▾ → Novidades).'
  ] },
  { version: 'v0.2.7', date: '2026-11-03', items: [
    '"Como foi o treino?": energia de 1 a 5 e anotações, que aparecem no histórico.',
    'Duração do treino (da primeira à última série) no cartão do dia, na comemoração e na imagem.',
    'Recorde pessoal 🏅 ao superar a maior carga ou o maior 1RM estimado do exercício.',
    'Calculadora de anilhas (Mais ▾ → Anilhas).',
    'Modo foco: um exercício por vez, em letras grandes, avançando sozinho.'
  ] },
  { version: 'v0.2.6', date: '2026-11-03', items: [
    'Menu "Mais ▾" com os botões menos usados.',
    'Exercícios completos ficam recolhidos numa linha com o resumo.',
    'Histórico de cada exercício (📈) com sessões, cargas e evolução do 1RM estimado.'
  ] },
  { version: 'v0.2.5', date: '2026-11-03', items: [
    'Cor por dia (Upper, Lower, Pull, Push, Legs).',
    'Animações ao marcar séries, selo verde no exercício completo e rolagem até o próximo.',
    'Comemoração ao concluir o treino, com botão de compartilhar a imagem.',
    'Abas cabem inteiras em telas estreitas.'
  ] },
  { version: 'v0.2.4', date: '2026-11-03', items: [
    'Cronômetro de descanso ao marcar cada série.',
    'Dica para subir a carga quando você bate o topo das reps.',
    'Lembrete de backup após 7 dias e "Desfazer importação".',
    'Correção: backup com logs vazios não trava mais o app.'
  ] },
  { version: 'v0.2.3', date: '2026-11-03', items: [
    'Importar o arquivo de detalhes do programa (aquecimento, RPE e técnica).',
    'Aquecimento aceita faixas como 2-3 séries.'
  ] },
  { version: 'v0.2.2', date: '2026-10-31', items: [
    'Painel Versão e atualização automática com repositório privado (token de leitura).'
  ] },
  { version: 'v0.2.1', date: '2026-10-30', items: [
    'Aquecimento, RPE e técnica da última série em cada exercício, editáveis.',
    'Selo Força/Hipertrofia, dicas e Glossário.'
  ] },
  { version: 'v0.2.0', date: '2026-10-28', items: [
    'Pular treino, painel de Progresso, imagens para compartilhar e programas próprios.',
    'Atualização automática pelo GitHub, sem baixar APK.'
  ] },
  { version: 'v0.1.0', date: '2026-10-28', items: [
    'Primeira versão Android: caderno offline, backup pelo menu de compartilhar e nuvem opcional (Google Drive ou GitHub Gist).'
  ] }
];
