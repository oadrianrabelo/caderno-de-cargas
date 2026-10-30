// Dicas: técnicas de intensidade da última série, RPE, aquecimento e foco do dia.
// Carregado antes do script principal; a janela de dica é criada só quando aberta.
(function (root) {
  // Técnicas da última série (campo "tec" do exercício).
  const TECH = {
    falha: {
      short: 'Falha', name: 'Até a falha',
      text: 'Na última série, faça repetições até não conseguir completar mais nenhuma com boa execução (RPE 10). ' +
        'Pare quando a repetição travar ou a técnica começar a quebrar, não quando ficar desconfortável.'
    },
    llp: {
      short: 'LLPs', name: 'LLPs (parciais alongadas)',
      text: 'Long-Length Partials. Quando chegar na falha com a amplitude completa, continue fazendo repetições ' +
        'parciais só na metade mais alongada do movimento (por exemplo, a parte de baixo da rosca, do supino ' +
        'ou do stiff) até não conseguir mais. Normalmente sai algo entre 3 e 8 parciais.'
    },
    myo: {
      short: 'Myo-reps', name: 'Myo-reps',
      text: 'Faça a série até perto da falha. Descanse só 3 a 5 respirações profundas (uns 5 segundos), ' +
        'faça mais 3 a 5 repetições com a mesma carga, e repita esse ciclo. Termine quando não conseguir ' +
        'completar as repetições da mini-série (geralmente 3 a 5 mini-séries).'
    },
    drop: {
      short: 'Drop set', name: 'Drop set',
      text: 'Chegando na falha, reduza a carga em cerca de 25 a 30% sem descansar e continue até a falha de novo. ' +
        'Pode repetir a redução mais uma vez se o programa pedir.'
    },
    estatico: {
      short: 'Along. estático', name: 'Alongamento estático com carga',
      text: 'Depois da última repetição, segure a posição de maior alongamento do músculo (por exemplo, embaixo ' +
        'no crucifixo ou na panturrilha) por cerca de 30 segundos, mantendo a carga.'
    }
  };

  // Outros verbetes do glossário.
  const TOPICS = {
    rpe: {
      name: 'RPE (esforço percebido)',
      text: 'Escala de 1 a 10 de quão perto da falha a série terminou. RPE 10: não sairia mais nenhuma repetição. ' +
        'RPE 9: sobraria 1. RPE 8: sobrariam 2. RPE 7: sobrariam 3. "7-8" quer dizer terminar com 2 a 3 repetições ' +
        'sobrando. As séries iniciais costumam ficar num RPE menor e a última mais perto da falha.'
    },
    aquecimento: {
      name: 'Séries de aquecimento',
      text: 'Séries leves antes das séries válidas, para preparar articulações e músculos sem cansar. Uma forma comum: ' +
        'comece com cerca de 50% da carga de trabalho e vá subindo (por exemplo, 50% × 6-8 e 70% × 3-5). ' +
        'Elas não contam como séries do treino e não precisam chegar perto da falha.'
    },
    forca: {
      name: 'Dia de força',
      text: 'Foco em ficar mais forte nos exercícios principais: cargas mais pesadas, menos repetições e descansos ' +
        'mais longos. Nos compostos pesados, priorize execução e pare perto da falha (RPE alto) sem precisar ir até ela, ' +
        'a não ser que a técnica da última série peça.'
    },
    hipertrofia: {
      name: 'Dia de hipertrofia',
      text: 'Foco em crescimento muscular: mais repetições, descansos um pouco menores e séries terminando bem perto ' +
        'da falha. É onde as técnicas de intensidade (LLPs, myo-reps, drop set) mais aparecem.'
    }
  };

  const api = { TECH, TOPICS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  function show(key) {
    const item = TECH[key] || TOPICS[key];
    if (!item) return;
    open(item.name, [item.text]);
  }

  function glossary() {
    const parts = [];
    Object.values(TOPICS).forEach((t) => parts.push([t.name, t.text]));
    parts.push(['Técnicas da última série', '']);
    Object.values(TECH).forEach((t) => parts.push([t.name, t.text]));
    open('Glossário', parts);
  }

  // Janela simples (sem <dialog>, que nem todo WebView antigo tem).
  function open(title, parts) {
    let ov = document.getElementById('tipov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'tipov'; ov.className = 'tipov';
      ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
      document.body.appendChild(ov);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
    ov.textContent = '';
    const box = document.createElement('div'); box.className = 'tipbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    parts.forEach((p) => {
      if (Array.isArray(p)) {
        const t = document.createElement('h3'); t.textContent = p[0]; box.appendChild(t);
        if (p[1]) { const x = document.createElement('p'); x.textContent = p[1]; box.appendChild(x); }
      } else { const x = document.createElement('p'); x.textContent = p; box.appendChild(x); }
    });
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn pri'; b.textContent = 'Entendi';
    b.addEventListener('click', close); box.appendChild(b);
    ov.appendChild(box); ov.hidden = false;
    b.focus();
  }
  function close() { const ov = document.getElementById('tipov'); if (ov) ov.hidden = true; }

  root.CGTips = { TECH, TOPICS, show, glossary };

  const tools = document.querySelector('.tools');
  if (tools) {
    const g = document.createElement('button'); g.type = 'button'; g.className = 'btn'; g.id = 'bgloss'; g.textContent = 'Glossário';
    g.addEventListener('click', glossary);
    tools.appendChild(g);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
