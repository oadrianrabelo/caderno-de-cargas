// Novidades por versão (mais recente primeiro). Fonte do CHANGELOG.md (npm run changelog).
window.CG_CHANGELOG = [
  { version: 'v0.4.3', date: '2026-11-11', items: [
    'Imagens de compartilhar refeitas no visual novo: seguem o tema e as fontes da Aparência (claro ou escuro), com cartões arredondados, cor do dia, indicadores em blocos e a cor da técnica na última série.',
    'Imagem do treino: séries feitas, volume e duração no topo, exercícios em lista e a anotação do treino inteira, num bloco próprio.',
    'Imagem do progresso: grade do programa e evolução de cada exercício com minigráfico.',
    'Correção: a etiqueta da técnica da última série (ex.: Along. estático) ficava atrás do campo de carga. Agora fica numa faixa no topo da série, com o nome inteiro.',
    'Alarme do descanso: o toque (agora em dois tons, mais suave) é agendado no início do descanso, para tocar mesmo se o celular deixar o app lento com a tela apagada.'
  ] },
  { version: 'v0.4.2', date: '2026-11-10', items: [
    'Correção: com uma folha aberta (Progresso, Programas, Aparência…), tocar em Editar ou Modo foco mudava a tela por baixo e a folha continuava por cima. Agora a folha fecha antes.',
    'Correção: abrir uma folha fecha a janela de dica (Glossário, Anilhas, Histórico) que tivesse ficado aberta.',
    'Mais leve: trocar de dia ou de semana e marcar série não forçam mais o celular a recalcular a tela duas vezes (animação de entrada e indicador das abas sem medições).',
    'Mais leve: sem desfoque de fundo no cabeçalho, na barra inferior e nas folhas (pesado em Android); as cores continuam as mesmas, agora quase opacas.',
    'A Aparência abre na hora e as fontes de exemplo carregam logo em seguida.'
  ] },
  { version: 'v0.4.1', date: '2026-11-10', items: [
    'Nova tela Aparência (Mais → Aparência): modo automático, claro ou escuro, 7 temas (Areia, Sálvia, Ardósia, Vinho, Terracota, Meia-noite e Tinta, que é preto puro no escuro) e fontes separadas para títulos, números e texto.',
    '19 fontes embutidas, funcionando offline: sem serifa (Bricolage, Geist, Space Grotesk, Manrope, Schibsted, Hanken, Sora, IBM Plex Sans, Unbounded), com serifa (Fraunces, Instrument Serif) e mono (Geist Mono, JetBrains Mono, Lilex, IBM Plex Mono, Commit Mono, Fira Code, Martian Mono, Red Hat Mono).',
    'Todas as fontes mono usam zero cortado (0 com barra).',
    'Correção: números longos (ex.: 102,5) eram cortados no campo de carga. A unidade (kg/rep) foi para o canto do campo e o número diminui sozinho se ainda não couber.',
    '"Restaurar o visual padrão" volta ao visual original. Os treinos não são afetados.'
  ] },
  { version: 'v0.4.0', date: '2026-11-10', items: [
    'Visual novo: tipografia própria (Bricolage Grotesque nos títulos e números, Geist no texto), embutida no app e sem internet.',
    'Cores mais sóbrias: fundo papel quente no tema claro e grafite no escuro; cores dos dias e das técnicas em tons suaves.',
    'Barra inferior enxuta (Editar, Progresso, Modo foco, Mais) com ícones; o resto foi para o menu "Mais", em grupos (Treino, Dados, App).',
    'Progresso, Nuvem, Programas e Versão abrem como folhas que sobem de baixo, uma por vez, com fundo escurecido e botão de fechar.',
    'Abas dos dias com indicador que desliza, cartões e campos maiores, ✓ redondo, cronômetro flutuando acima da barra.',
    'Os seus dados não mudam: só a aparência.'
  ] },
  { version: 'v0.3.6', date: '2026-11-10', items: [
    'Correção: treinos antigos (antes da v0.2.7, sem horário nas séries) voltam a usar o dia da última alteração no calendário; o dia em que foram abertos não era confiável. Se algum estiver no dia errado, corrija em "Como foi o treino? → Data do treino · Alterar".',
    'Desmarcar e marcar de novo uma série mantém o horário original, então o treino não muda de dia.'
  ] },
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
