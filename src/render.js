// Monta o DOM a partir do site.json descriptografado. Nenhum texto da história
// fica no código: tudo vem do JSON e entra via textContent.

export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'midia') el.__m = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

const svg = (markup, cls = 'icone') => {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${markup}</svg>`;
  return t.content.firstChild;
};
export const ICONES = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  trocar: '<path d="M5 6.5v11l8-5.5zM14 6.5v11l8-5.5z" fill="currentColor" transform="translate(-1.5 0)"/>',
  somOn: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  somOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  seta: '<path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};
export const icone = (nome, cls) => svg(ICONES[nome], cls);

const quem = (de) => (de === 'ela' ? 'você' : 'eu');

// Textos de interface, lidos do JSON (config.ui).
let UI = {};

/* ---------- peças reutilizáveis ---------- */

function mensagem(m, extra = '', comHora = true) {
  const hora = comHora && m.quando && h('span', { class: 'msg__hora' }, m.quando);
  if (m.tipo === 'sistema') {
    return h('div', { class: `msg msg--sistema ${extra}` },
      h('span', { class: 'msg__ligacao' }, svg('<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM15 10.5l6-3.5v10l-6-3.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>')),
      h('p', { class: 'msg__texto' }, m.texto),
      hora);
  }
  return h('div', { class: `msg msg--${m.de} ${extra}` },
    h('span', { class: 'sr' }, quem(m.de) + ': '),
    h('p', { class: 'msg__texto' }, m.texto),
    hora);
}

// Mensagens seguidas da mesma pessoa viram um grupo, como no Insta/Zap:
// cantos "colados" e horário só quando o grupo acaba ou o minuto muda.
export function conversa(lista = [], extra = '') {
  const msgs = lista.filter(Boolean);
  if (!msgs.length) return null;
  const autor = (m) => (m.tipo === 'sistema' ? 'sistema' : m.de);
  return h('div', { class: `conversa ${extra}`, 'data-conversa': '' }, msgs.map((m, i) => {
    const ant = msgs[i - 1];
    const prox = msgs[i + 1];
    const ini = !ant || autor(ant) !== autor(m);
    const fim = !prox || autor(prox) !== autor(m);
    const cls = [ini && 'msg--ini', fim && 'msg--fim', m.destaque && 'msg--grande', m.explode && 'msg--explode'].filter(Boolean).join(' ');
    return mensagem(m, cls, fim || prox.quando !== m.quando);
  }));
}

function manuscrito(q, nota) {
  if (!q) return null;
  return h('figure', { class: `manuscrito manuscrito--${q.de || 'ela'}`, 'data-revela-texto': '' },
    h('blockquote', {}, h('span', { class: 'sr' }, quem(q.de) + ': '), q.texto),
    (nota || q.quando) && h('figcaption', {}, nota || q.quando));
}

function paragrafos(lista = [], cls = 'prosa') {
  return lista.map((t) => h('p', { class: cls, 'data-revela-texto': '' }, t));
}

function proporcao(m) {
  return m && m.w ? `aspect-ratio:${m.w}/${m.h}` : 'aspect-ratio:3/4';
}

export function foto(f, extra = '') {
  if (!f) return null;
  return h('figure', { class: `foto ${extra}` },
    h('div', { class: 'foto__moldura', 'data-revela-foto': '', style: proporcao(f.m) },
      h('img', { 'data-lazy': '', midia: f.m, alt: f.legenda || '', decoding: 'async' })),
    f.legenda && h('figcaption', { class: 'foto__legenda' }, f.legenda));
}

// Conversa "revivida": um celular estilizado onde as mensagens chegam com a rolagem.
function celular(c, { antes, trilha } = {}) {
  if (!c) return null;
  const explode = c.mensagens.find((m) => m.explode);
  return h('div', { class: 'celular-palco', 'data-celular': '', 'data-trilha': trilha },
    h('div', { class: 'celular' },
      h('div', { class: 'celular__topo' },
        h('span', { class: 'celular__avatar', 'aria-hidden': 'true' }, [...c.nome][0]),
        h('div', { class: 'celular__quem' },
          h('p', { class: 'celular__nome' }, c.nome),
          h('p', { class: 'celular__status' },
            h('span', { 'data-celular-data': '' }, c.quando),
            h('span', { class: 'celular__digitando', 'data-celular-digitando': '', 'aria-hidden': 'true' }, UI.digitando)))),
      h('div', { class: 'celular__tela', 'data-celular-tela': '' },
        h('div', { class: 'celular__lista', 'data-celular-lista': '' }, antes, conversa(c.mensagens, 'conversa--celular'))),
      h('div', { class: 'celular__barra', 'aria-hidden': 'true' }, h('span'), h('i'))),
    explode && h('p', { class: 'celular__explode', 'data-celular-explode': '', 'aria-hidden': 'true' }, explode.texto),
    c.fecho && h('p', { class: 'celular__fecho manuscrito-curto', 'data-celular-fecho': '' }, c.fecho));
}

function fotoOuReserva(f, extra = '') {
  if (!f) return null;
  if (f.m) return foto(f, extra);
  return h('figure', { class: `foto ${extra} foto--reserva`, 'data-revela-texto': '' },
    h('div', { class: 'reserva', style: 'aspect-ratio:4/5' },
      svg('<circle cx="12" cy="13" r="6.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M10 6.2l2-2.4 2 2.4-2 1.2z" fill="none" stroke="currentColor" stroke-width="1"/>', 'reserva__anel'),
      h('p', {}, f.placeholder)));
}

function cabeca(s) {
  // Número grande vazado atrás do título (só nos capítulos numerados).
  const num = (s.rotulo || '').match(/\d+/);
  return h('header', { class: 'cap-cabeca' },
    num && h('span', { class: 'cap-numero', 'data-cap-numero': '', 'aria-hidden': 'true' }, num[0].padStart(2, '0')),
    h('p', { class: 'cap-rotulo' }, s.rotulo, h('span', { class: 'cap-linha', 'data-cap-linha': '', 'aria-hidden': 'true' })),
    h('h2', { class: 'cap-titulo', 'data-split': '' }, s.titulo),
    s.data && h('p', { class: 'cap-data' }, s.data));
}

/* ---------- capítulos por "momento" ---------- */

const momentos = {
  memoria(s) {
    return [
      h('p', { class: 'memoria', 'data-memoria': '' }, s.memoria),
      paragrafos(s.texto),
      manuscrito(s.manuscrito, s.manuscrito_nota),
      s.antes_mensagens && paragrafos([s.antes_mensagens]),
      conversa(s.mensagens),
      h('div', { class: 'dupla' }, (s.fotos || []).map((f, i) => foto(f, i ? 'foto--desce' : ''))),
    ];
  },

  // O story e, ao lado (embaixo no celular), a conversa do Direct revivida.
  story(s) {
    const st = s.story;
    const resposta = st.resposta && h('div', { class: 'resposta-story', 'aria-hidden': 'true' },
      h('img', { class: 'resposta-story__mini', 'data-lazy': '', midia: st.m, alt: '', decoding: 'async' }),
      h('span', {}, st.resposta));
    return [
      paragrafos(s.texto),
      h('div', { class: 'story-dm', 'data-story': '' },
        h('figure', { class: 'story-dm__story' },
          h('div', { class: 'story-moldura', style: proporcao(st.m), 'data-story-img': '' },
            h('img', { 'data-lazy': '', midia: st.m, alt: st.legenda, decoding: 'async' })),
          h('figcaption', { class: 'foto__legenda' }, st.legenda)),
        celular(s.celular, { antes: resposta })),
      (s.blocos || []).map((b) => h('div', { class: 'bloco' }, paragrafos([b.texto]), conversa(b.mensagens))),
    ];
  },

  beijo(s) {
    return [
      paragrafos(s.texto),
      s.comedia && h('div', { class: 'bloco bloco--comedia' }, paragrafos([s.comedia.texto]), conversa(s.comedia.mensagens)),
      h('div', { class: 'beijo-palco', 'data-beijo': '' },
        h('div', { class: 'beijo-mascara', 'data-beijo-mascara': '' },
          h('video', { 'data-lazy': '', midia: s.video.m, muted: true, playsinline: true, loop: true, preload: 'none',
            'aria-label': s.video.legenda })),
        h('p', { class: 'beijo-legenda manuscrito-curto' }, s.video.legenda),
        h('button', { class: 'icone-botao icone-botao--video', type: 'button', 'data-som-video': '', 'aria-label': 'Ligar o som do vídeo', 'data-dica': 'Ligar o som do vídeo' }, icone('somOff'))),
      paragrafos([s.depois]),
      celular(s.celular),
      s.fecho && h('div', { class: 'fecho' }, s.fecho.texto && paragrafos([s.fecho.texto]), conversa([s.fecho.mensagem]), manuscrito(s.fecho.manuscrito)),
    ];
  },

  adesivo(s) {
    const f = (s.fotos || [])[0];
    return [
      paragrafos(s.texto),
      h('div', { class: 'adesivo-palco', 'data-adesivo': '' },
        foto(f),
        h('div', { class: 'adesivo', 'data-adesivo-circulo': '', 'aria-hidden': 'true' }, h('span', {}, s.adesivo))),
      conversa(s.mensagens),
    ];
  },

  placar(s) {
    // Cada rolo gira pelos números como um placar eletrônico e para no gol real.
    const p = s.placar;
    const rolo = (gols) => h('span', { class: 'placar__rolo', 'aria-hidden': 'true' },
      h('span', { class: 'placar__fita', 'data-placar-fita': '' },
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', String(gols)].map((d) => h('span', {}, d))));
    return [
      paragrafos(s.texto),
      h('div', { class: 'placar', 'data-placar': '', role: 'img', 'aria-label': `${p.casa} ${p.gols_casa} a ${p.gols_fora} ${p.fora}` },
        h('div', { class: 'placar__linha' }, h('span', { class: 'placar__time' }, p.casa), rolo(p.gols_casa)),
        h('div', { class: 'placar__linha' }, h('span', { class: 'placar__time' }, p.fora), rolo(p.gols_fora))),
      h('p', { class: 'placar__legenda', 'data-revela-texto': '' }, s.placar.legenda),
      conversa(s.mensagens),
    ];
  },

  familias(s) {
    return [
      paragrafos(s.texto),
      h('div', { class: 'lados', 'data-lados': '' },
        s.lados.map((l, i) => h('div', { class: `lado lado--${i ? 'b' : 'a'}`, 'data-lado': '' },
          h('p', { class: 'lado__data' }, l.data),
          h('p', { class: 'prosa' }, l.texto),
          conversa(l.mensagens)))),
      (s.fotos || []).map((f) => foto(f, 'foto--larga')),
    ];
  },

  'te-amo'(s) {
    return [
      paragrafos(s.texto),
      celular(s.celular),
      s.depois && h('div', { class: 'bloco' }, paragrafos([s.depois_texto]), manuscrito(s.depois)),
      s.ritual && h('div', { class: 'bloco ritual' }, paragrafos([s.ritual.texto]), conversa(s.ritual.mensagens, 'conversa--ritual')),
    ];
  },

  galeria(s) {
    const cartao = (it) => h('article', { class: `galeria__item ${it.arquivo ? '' : 'galeria__item--texto'} ${it.destaque ? 'galeria__item--destaque' : ''}` },
      it.data && h('p', { class: 'galeria__data' }, it.data),
      it.arquivo && h('div', { class: 'foto__moldura', style: proporcao(it.m) },
        h('img', { 'data-lazy': '', 'data-lazy-grupo': 'galeria', midia: it.m, alt: it.legenda || '', decoding: 'async' })),
      !it.legenda_depois && it.legenda && h('p', { class: 'galeria__legenda' }, it.legenda),
      conversa(it.mensagens),
      it.legenda_depois && it.legenda && h('p', { class: 'galeria__legenda' }, it.legenda));
    const mu = s.muito;
    return [
      paragrafos(s.texto),
      h('div', { class: 'galeria', 'data-galeria': '' },
        h('div', { class: 'galeria__trilho', 'data-galeria-trilho': '', tabindex: '0', 'aria-label': 'Galeria de fotos, role para o lado' },
          s.itens.map(cartao))),
      mu && h('div', { class: 'muito-bloco' },
        h('p', { class: 'cap-data' }, mu.data),
        paragrafos([mu.texto]),
        h('div', { class: 'muito-palco', 'data-muito': '' },
          conversa([mu.antes], 'conversa--fixa'),
          h('div', { class: 'muito-parede', 'data-muito-parede': '', 'aria-hidden': 'true' }),
          h('p', { class: 'muito-mais', 'data-muito-mais': '' }, h('span', { class: 'sr' }, `você: ${mu.palavra} ${mu.palavra} ${mu.palavra}… `), mu.final.texto)),
        conversa([mu.rodape]),
        h('template', { 'data-muito-palavra': mu.palavra })),
    ];
  },

  futuro(s) {
    const linha = (rot, txt) => h('div', { class: 'painel__linha' },
      h('span', { class: 'painel__rotulo' }, rot),
      h('span', { class: 'painel__texto', 'data-flap': txt, 'aria-label': txt }, txt.split('').map(() => h('span', { class: 'flap', 'aria-hidden': 'true' }, ' '))));
    return [
      paragrafos(s.texto),
      h('div', { class: 'painel', 'data-painel': '' },
        linha('de', s.painel.de), linha('para', s.painel.para), linha('quando', s.painel.quando)),
      conversa(s.mensagens),
      s.fecho_mensagens && h('div', { class: 'bloco' }, paragrafos([s.fecho_texto]), conversa(s.fecho_mensagens)),
    ];
  },

  poente(s) {
    return [
      paragrafos(s.texto),
      celular(s.celular, { trilha: 'baixo' }),
      s.revelacao && h('div', { class: 'revelacao', 'data-revelacao': '' },
        s.revelacao.map((l) => h('p', { class: 'revelacao__linha' }, l))),
      h('div', { class: 'poente-palco', 'data-poente': '' }, cenaPoente(),
        h('p', { class: 'poente-frase', 'data-poente-frase': '' }, s.frase_final)),
    ];
  },
};

function cenaPoente() {
  const t = document.createElement('template');
  t.innerHTML = `
<svg class="cena" viewBox="0 0 400 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2B1240" data-ceu="0"/>
      <stop offset=".55" stop-color="#C2456B" data-ceu="1"/>
      <stop offset="1" stop-color="#FF9A5A" data-ceu="2"/>
    </linearGradient>
    <linearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1F5FA8" data-mar="0"/>
      <stop offset="1" stop-color="#0D2D52"/>
    </linearGradient>
    <radialGradient id="sol"><stop offset="0" stop-color="#FFE3B8"/><stop offset=".55" stop-color="#FFB070"/><stop offset="1" stop-color="#FF9A5A" stop-opacity="0"/></radialGradient>
    <clipPath id="acima"><rect x="0" y="0" width="400" height="430"/></clipPath>
  </defs>
  <rect x="-600" width="1600" height="640" fill="url(#ceu)"/>
  <g clip-path="url(#acima)"><circle data-sol cx="200" cy="250" r="70" fill="url(#sol)"/><circle data-sol-nucleo cx="200" cy="250" r="30" fill="#FFE9C9"/></g>
  <rect x="-600" y="330" width="592" height="100" fill="#1A0A18"/><rect x="408" y="300" width="592" height="130" fill="#1A0A18"/>
  <path d="M-10 430 L-10 330 C 30 300 70 296 110 320 C 140 338 160 372 186 430 Z" fill="#1A0A18"/>
  <path d="M410 430 L410 300 C 370 280 330 286 300 312 C 270 338 252 380 236 430 Z" fill="#1A0A18"/>
  <rect x="-600" y="430" width="1600" height="210" fill="url(#mar)"/>
  <g data-reflexo fill="#FFD3A1" opacity=".55">
    <rect x="180" y="438" width="40" height="2" rx="1"/><rect x="170" y="447" width="60" height="2" rx="1"/>
    <rect x="186" y="457" width="28" height="2" rx="1"/><rect x="164" y="468" width="72" height="2" rx="1"/>
    <rect x="190" y="479" width="20" height="2" rx="1"/>
  </g>
</svg>`;
  return t.content.firstElementChild;
}

/* ---------- seções ---------- */

const secoes = {
  abertura(s) {
    return h('section', { class: 'secao abertura', 'data-tema': 'noite', id: 'inicio' },
      h('div', { class: 'bokeh', 'data-bokeh': '', 'aria-hidden': 'true' },
        Array.from({ length: 16 }, () => h('i'))),
      h('h1', { class: 'abertura__nome', 'data-split-hero': '' }, s.nome),
      h('p', { class: 'abertura__sub', 'data-hero-sub': '' }, s.subtitulo),
      h('p', { class: 'abertura__dica', 'data-hero-sub': '' }, s.dica, icone('seta')));
  },

  capitulo(s) {
    const corpo = (momentos[s.momento] || momentos.memoria)(s);
    return h('section', { class: `secao capitulo momento--${s.momento}`, 'data-tema': s.tema, 'data-seg': s.rotulo },
      cabeca(s), corpo);
  },

  // Tela quase vazia entre os atos, com uma frase só.
  respiro(s) {
    return h('section', { class: `respiro respiro--ato${s.ato}`, 'data-tema': s.tema, 'data-respiro': '', 'data-ato': s.ato },
      h('p', { class: 'respiro__frase', 'data-respiro-frase': '' }, s.frase));
  },

  // Faixa de frases reais que corre de lado conforme a rolagem.
  faixa(s) {
    const linha = () => h('span', { class: 'faixa__linha' },
      s.linhas.map((t) => [h('span', { class: 'faixa__frase' }, t), h('span', { class: 'faixa__ponto', 'aria-hidden': 'true' })]));
    return h('section', { class: 'faixa', 'data-faixa': '', 'aria-label': s.linhas.join(' · ') },
      h('div', { class: 'faixa__trilho', 'data-faixa-trilho': '', 'aria-hidden': 'true' }, linha(), linha(), linha()));
  },

  // "Eu amo…" com as coisas trocando uma por uma, presa na tela.
  amo(s) {
    return h('section', { class: 'secao interludio amo', 'data-tema': s.tema },
      h('h2', { class: 'interludio__titulo', 'data-split': '' }, s.titulo),
      h('div', { class: 'amo-palco', 'data-amo': '' },
        h('p', { class: 'amo__prefixo' }, s.prefixo),
        h('ul', { class: 'amo__lista', 'data-amo-lista': '' }, s.itens.map((t) => h('li', { class: 'amo__item' }, t))),
        h('p', { class: 'amo__contador', 'aria-hidden': 'true' },
          h('span', { 'data-amo-n': '' }, '1'), ` de ${s.itens.length}`)),
      h('p', { class: 'amo__fecho manuscrito-curto', 'data-revela-texto': '' }, s.fecho));
  },

  ponto(s) {
    return h('section', { class: 'secao interludio ponto', 'data-tema': s.tema },
      h('div', { class: 'ponto-placa', 'aria-hidden': 'true' },
        svg('<rect x="4" y="5" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 11h16M8 16v2.5M16 16v2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', 'ponto-placa__icone')),
      h('h2', { class: 'interludio__titulo', 'data-split': '' }, s.titulo),
      h('p', { class: 'ponto-relogio', 'data-ponto': '' },
        h('span', { class: 'ponto-relogio__de', 'data-ponto-de': '' }, s.relogio_de),
        h('span', { class: 'ponto-relogio__para', 'data-ponto-para': '' }, s.relogio_para)),
      paragrafos([s.texto]),
      conversa(s.mensagens));
  },

  'ela-diz'(s) {
    return h('section', { class: 'secao interludio ela-diz', 'data-tema': s.tema },
      h('h2', { class: 'interludio__titulo', 'data-split': '' }, s.titulo),
      h('div', { class: 'ela-diz__lista', 'data-ela-diz': '' }, s.mensagens.map((m) => mensagem(m, 'msg--ini msg--fim'))),
      s.ele_mensagens && s.ele_mensagens.length && [
        h('h3', { class: 'ela-diz__subtitulo', 'data-split': '' }, s.ele_titulo),
        h('div', { class: 'ela-diz__lista ela-diz__lista--ele', 'data-ela-diz': '' }, s.ele_mensagens.map((m) => mensagem(m, 'msg--ini msg--fim'))),
      ],
      h('p', { class: 'ela-diz__fecho manuscrito-curto', 'data-revela-texto': '' }, s.fecho));
  },

  numeros(s) {
    const fmt = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return h('section', { class: 'secao interludio numeros', 'data-tema': s.tema },
      h('h2', { class: 'interludio__titulo', 'data-split': '' }, s.titulo),
      s.nota && h('p', { class: 'numeros__nota manuscrito-curto' }, s.nota),
      h('div', { class: 'numeros__grade' },
        s.itens.map((it) => h('div', { class: `numero ${it.grande ? 'numero--grande' : ''}` },
          h('p', { class: 'numero__valor' },
            h('span', { 'data-conta': it.valor, 'data-decimais': it.decimais || 0 }, fmt(it.valor, it.decimais || 0)),
            it.sufixo && h('span', { class: 'numero__sufixo' }, it.sufixo),
            it.comentario && h('span', { class: 'numero__comentario' }, ' ' + it.comentario)),
          h('p', { class: 'numero__rotulo' }, it.rotulo),
          it.detalhe && h('p', { class: 'numero__detalhe' }, it.detalhe),
          it.ela != null && h('div', { class: 'duelo' },
            h('div', { class: 'duelo__barra', role: 'img', 'aria-label': `Você ${fmt(it.ela)}, eu ${fmt(it.ele)}` },
              h('span', { class: 'duelo__ela', style: `--p:${it.ela / (it.ela + it.ele)}`, 'data-duelo': '' }),
              h('span', { class: 'duelo__ele', style: `--p:${it.ele / (it.ela + it.ele)}`, 'data-duelo': '' })),
            h('p', { class: 'duelo__nomes', 'aria-hidden': 'true' },
              h('span', {}, `você ${fmt(it.ela)}`), h('span', {}, `eu ${fmt(it.ele)}`)))))));
  },

  contadores(s) {
    const relogio = (it, cls = '') => h('div', { class: `contador ${cls}`, 'data-contador': it.inicio, 'data-antes': it.antes || '', 'data-revela-texto': cls === 'contador--um' ? '' : null },
      h('p', { class: 'contador__rotulo' }, it.rotulo),
      h('p', { class: 'contador__valor' },
        ['dias', 'horas', 'min', 'seg'].map((u) => h('span', { class: 'contador__parte' },
          h('span', { class: 'contador__num', 'data-u': u }, '0'), h('span', { class: 'contador__un' }, u)))),
      it.antes && h('p', { class: 'contador__antes', hidden: true }, it.antes));
    const n = s.namoro;
    return h('section', { class: 'secao interludio contadores', 'data-tema': s.tema },
      h('h2', { class: 'interludio__titulo', 'data-split': '' }, s.titulo),
      h('div', { class: 'contadores__lista' }, s.itens.map((it) => relogio(it, 'contador--um'))),
      h('div', { class: 'contadores__virada', 'data-virada': '' },
        h('p', { class: 'contadores__ponte', 'data-virada-ponte': '' }, s.ponte)),
      h('div', { class: 'contadores__namoro', 'data-namoro': '' },
        fotoOuReserva(n.foto, 'foto--sim'),
        relogio(n, 'contador--namoro'),
        n.depois && h('p', { class: 'contadores__depois', 'data-namoro-depois': '' }, n.depois)));
  },

  carta(s) {
    return h('section', { class: 'secao carta', 'data-tema': 'noite', 'data-seg': 'Carta' },
      h('div', { class: 'carta__papel' },
        h('p', { class: 'carta__saudacao' }, s.saudacao),
        s.paragrafos.map((p) => h('p', { class: 'carta__p', 'data-linhas': '' }, p)),
        h('p', { class: 'carta__assinatura' }, s.assinatura)));
  },

  final(s) {
    return h('section', { class: 'secao final', 'data-tema': s.tema },
      h('p', { class: 'final__despedida', 'data-revela-texto': '' }, s.despedida),
      h('button', { class: 'pontinho', type: 'button', 'data-pontinho': '', 'aria-label': 'Abrir o segredo' }, h('span')),
      h('footer', { class: 'rodape' }, s.rodape));
  },
};

export function montarSite(dados) {
  UI = (dados.config && dados.config.ui) || {};
  const frag = document.createDocumentFragment();
  for (const s of dados.secoes) {
    const fn = secoes[s.tipo];
    if (fn) frag.append(fn(s));
  }
  return frag;
}

/* ---------- segredo ---------- */

export function montarSegredo(sg) {
  const video = sg.video && sg.video.m
    ? h('video', { class: 'segredo__video', 'data-lazy': '', midia: sg.video.m, controls: true, playsinline: true, preload: 'none', 'aria-label': sg.video.titulo })
    : h('div', { class: 'reserva reserva--video' },
      svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1"/><path d="M10 8.5v7l6-3.5z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>', 'reserva__anel'),
      h('p', {}, sg.video.placeholder));

  const vale = (v, i) => h('li', { class: 'vale' },
    h('button', { class: 'vale__botao', type: 'button', 'data-vale': i, 'aria-pressed': 'false' },
      h('span', { class: 'vale__canhoto', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'vale__corpo' },
        h('span', { class: 'vale__titulo' }, v.titulo),
        v.citacao && h('span', { class: 'vale__citacao' }, `${v.data ? v.data + ' · ' : ''}“${v.citacao.texto}”`),
        v.texto && h('span', { class: 'vale__texto' }, v.texto),
        h('span', { class: 'vale__estado' }, UI.vale_destacar)),
      v.carimbo && h('span', { class: 'vale__carimbo', 'aria-label': v.carimbo }, v.carimbo)));

  return h('dialog', { class: 'segredo', id: 'segredo', 'aria-labelledby': 'segredo-titulo' },
    h('div', { class: 'segredo__envelope', 'aria-hidden': 'true' }, h('span', { class: 'segredo__aba' })),
    h('div', { class: 'segredo__carta', 'data-lenis-prevent': '' },
      h('div', { class: 'segredo__topo' },
        h('button', { class: 'icone-botao segredo__fechar', type: 'button', 'data-fechar': '', 'aria-label': 'Fechar o segredo', 'data-dica': 'Fechar' }, icone('fechar'))),
      h('h2', { class: 'segredo__titulo', id: 'segredo-titulo' }, sg.titulo),
      h('p', { class: 'segredo__sub' }, sg.subtitulo),
      h('h3', { class: 'segredo__h3' }, sg.video.titulo),
      video,
      h('h3', { class: 'segredo__h3' }, sg.vales_titulo),
      h('p', { class: 'segredo__dica' }, sg.vales_dica),
      h('ul', { class: 'vales' }, sg.vales.map(vale))));
}
