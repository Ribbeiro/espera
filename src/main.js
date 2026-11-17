import 'lenis/dist/lenis.css';
import './estilos.css';
import { entrarComSenha, entrarComSessao, urlDaMidia } from './cripto.js';
import { montarSite, montarSegredo, h, icone } from './render.js';
import * as audio from './audio.js';
import {
  iniciarRolagem, animarAbertura, iniciarEfeitos, definirIconeSom, pararRolagem, voltarRolagem, reduzido, irPara, aoChegarNoFim,
} from './efeitos.js';

const cadeado = document.getElementById('cadeado');
const form = document.getElementById('cadeado-form');
const input = document.getElementById('senha');
const campo = document.getElementById('cadeado-campo');
const msg = document.getElementById('cadeado-msg');
const entrar = document.getElementById('cadeado-entrar');
const app = document.getElementById('app');

// As fontes da história começam a baixar já na tela de senha. Se chegarem depois
// da página montada, tudo teria que ser medido de novo (e isso engasga).
const FONTES = ['400 1em "Bodoni Moda"', 'italic 500 1em "Bodoni Moda"', '400 1em Figtree', '500 1em Figtree', '600 1em Figtree', '400 1em "Reenie Beanie"'];
const fontesProntas = Promise.all(FONTES.map((f) => document.fonts.load(f).catch(() => null)));

/* ---------- tela de senha ---------- */

// A senha vale do jeito que ela digitar: sem diferença de maiúscula, acento ou espaço.
const normalizar = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

input.addEventListener('input', () => {
  msg.textContent = '';
  campo.classList.remove('erro');
});

let ocupado = false;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (ocupado) return;
  const senha = normalizar(input.value);
  if (!senha) {
    avisar('Escreve a senha aqui em cima.');
    return;
  }
  audio.destravar(); // precisa estar dentro do toque (iPhone)
  ocupado = true;
  entrar.setAttribute('aria-busy', 'true');
  const giro = setTimeout(() => entrar.classList.add('carregando'), 100);
  try {
    const site = await entrarComSenha(senha);
    await abrirSite(site, true);
  } catch (err) {
    if (err.message === 'senha') {
      avisar('Ainda não é essa. Espera a senha certa.');
      input.select();
    } else {
      avisar('A internet falhou no meio do caminho. Confere a conexão e toca em Abrir de novo.');
    }
  } finally {
    clearTimeout(giro);
    ocupado = false;
    entrar.classList.remove('carregando');
    entrar.removeAttribute('aria-busy');
  }
});

function avisar(texto) {
  msg.textContent = texto;
  campo.classList.remove('erro');
  void campo.offsetWidth;
  campo.classList.add('erro');
}

/* ---------- abrir o site ---------- */

async function abrirSite(dados, comMusica) {
  document.title = dados.config.titulo_aba || document.title;
  const barra = h('div', { class: 'progresso', 'aria-hidden': 'true' });
  const main = h('main', { id: 'historia' }, montarSite(dados));
  const segredo = montarSegredo(dados.segredo);
  const player = montarPlayer(dados.config.musicas);
  app.replaceChildren(barra, main, player, segredo);
  app.hidden = false;

  definirIconeSom((ligado) => icone(ligado ? 'somOn' : 'somOff'));
  audio.configurar(dados.config.musicas);
  if (comMusica) audio.tocar(0);

  carregarMidiaPreguicosa();
  iniciarContadores();
  ligarSegredo(segredo, dados.config.ui || {});
  ligarDicas();

  // Monta todas as animações ainda atrás da tela de senha (o botão continua girando),
  // e só depois abre a cortina: assim nada engasga na frente dela.
  entrar.classList.add('carregando');
  await Promise.race([fontesProntas, new Promise((r) => setTimeout(r, 2500))]);
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  window.scrollTo(0, 0);
  document.documentElement.classList.add('aberto');
  iniciarRolagem();
  iniciarEfeitos({ barra, abaixar: audio.abaixar, trilha: { final: audio.trilhaFinal, nivel: audio.definirNivel }, ui: dados.config.ui || {} });
  animarAbertura();
  ligarNavegacao(barra, dados.config.ui || {}, comMusica);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  cadeado.classList.add('saindo');
  setTimeout(() => cadeado.remove(), reduzido ? 0 : 600);
}

/* ---------- navegação: continuar, índice e "ler de novo" ---------- */

const CH_POS = 'lm-pos';
const CH_FIM = 'lm-fim';
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

function ligarNavegacao(barra, ui, comMusica) {
  // Guarda onde ela está, pra poder continuar depois.
  let ultimo = 0;
  window.addEventListener('scroll', () => {
    const agora = performance.now();
    if (agora - ultimo < 1000) return;
    ultimo = agora;
    gravar(CH_POS, String(Math.round(window.scrollY)));
  }, { passive: true });

  // Voltando no meio da história: pergunta se quer continuar (e o toque já liga a música).
  const pos = Number(ler(CH_POS) || 0);
  const altura = document.documentElement.scrollHeight;
  if (pos > 1500 && pos < altura - window.innerHeight * 1.5) {
    const sim = h('button', { class: 'botao', type: 'button' }, ui.continuar_sim);
    const nao = h('button', { class: 'botao botao--leve', type: 'button' }, ui.continuar_nao);
    const cartao = h('div', { class: 'continuar', role: 'dialog', 'aria-label': ui.continuar_pergunta },
      h('p', { class: 'continuar__pergunta' }, ui.continuar_pergunta), h('div', { class: 'continuar__acoes' }, sim, nao));
    document.body.append(cartao);
    requestAnimationFrame(() => cartao.classList.add('visivel'));
    const fechar = (continuar) => {
      if (!comMusica) { audio.destravar(); audio.tocar(); }
      cartao.classList.remove('visivel');
      setTimeout(() => cartao.remove(), 320);
      if (continuar) irPara(pos);
    };
    sim.addEventListener('click', () => fechar(true));
    nao.addEventListener('click', () => fechar(false));
    sim.focus({ preventScroll: true });
  }

  // "Ler tudo de novo"
  document.querySelectorAll('[data-ler-de-novo]').forEach((b) => b.addEventListener('click', () => irPara(0, true)));

  // Índice dos capítulos: liberado depois que ela chega no fim uma vez.
  const itens = [...document.querySelectorAll('[data-indice]')].filter((el) => el.dataset.indice);
  const lista = h('ul', { class: 'indice__lista' }, itens.map((el) => h('li', {},
    h('button', { class: 'indice__item', type: 'button', onclick: () => { dlg.close(); setTimeout(() => irPara(el.getBoundingClientRect().top + window.scrollY - 8), 60); } },
      el.dataset.indice))));
  const fecharBtn = h('button', { class: 'icone-botao indice__fechar', type: 'button', 'aria-label': ui.indice_fechar, 'data-dica': ui.indice_fechar }, icone('fechar'));
  const dlg = h('dialog', { class: 'indice', 'aria-labelledby': 'indice-titulo' },
    h('div', { class: 'indice__caixa', 'data-lenis-prevent': '' },
      fecharBtn, h('h2', { class: 'indice__titulo', id: 'indice-titulo' }, ui.indice_titulo), lista,
      h('p', { class: 'indice__dica' }, ui.indice_dica)));
  document.body.append(dlg);
  let posAntes = 0;
  fecharBtn.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('travado'); voltarRolagem(); });
  const abrirIndice = () => { posAntes = pararRolagem(); document.documentElement.classList.add('travado'); dlg.showModal(); };
  const liberar = () => {
    if (barra.querySelector('.progresso__abrir')) return;
    barra.classList.add('progresso--indice');
    barra.removeAttribute('aria-hidden');
    barra.append(h('button', { class: 'progresso__abrir', type: 'button', 'aria-label': ui.indice_abrir, onclick: abrirIndice }));
  };
  if (ler(CH_FIM)) liberar();
  aoChegarNoFim(() => { gravar(CH_FIM, '1'); liberar(); });
}

/* ---------- mídia sob demanda ---------- */

function carregarMidiaPreguicosa() {
  const carregar = (el) => {
    if (el.__carregando) return;
    el.__carregando = true;
    urlDaMidia(el.__m).then((url) => {
      if (!url) return;
      el.src = url;
      el.classList.add('pronto');
    }).catch(() => el.classList.add('falhou'));
  };
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const grupo = e.target.dataset.lazyGrupo;
      if (grupo) document.querySelectorAll(`[data-lazy-grupo="${grupo}"]`).forEach(carregar);
      else carregar(e.target);
    });
  }, { rootMargin: '150% 0px 150% 0px' });
  document.querySelectorAll('#historia [data-lazy]').forEach((el) => {
    if (el.dataset.lazyGrupo) io.observe(el.closest('[data-galeria]') || el);
    else io.observe(el);
  });
  // a galeria é observada pelo container
  document.querySelectorAll('[data-galeria]').forEach((g) => {
    g.dataset.lazyGrupo = 'galeria';
  });
}

/* ---------- player ---------- */

function montarPlayer(musicas) {
  const tocar = h('button', { class: 'icone-botao', type: 'button', 'aria-label': 'Tocar música', 'data-dica': 'Tocar música' }, icone('play'));
  const trocar = h('button', { class: 'icone-botao', type: 'button', 'aria-label': 'Trocar de música', 'data-dica': 'Trocar de música' }, icone('trocar'));
  const nome = h('p', { class: 'player__nome', 'aria-live': 'polite' });
  let ultima = '';
  let some;
  tocar.addEventListener('click', () => { audio.destravar(); audio.alternar(); });
  trocar.addEventListener('click', () => { audio.destravar(); audio.proxima(); });
  if (musicas.filter((m) => m.m).length < 2) trocar.hidden = true;
  audio.aoMudar(({ tocando, faixa }) => {
    tocar.replaceChildren(icone(tocando ? 'pause' : 'play'));
    const r = tocando ? 'Pausar música' : 'Tocar música';
    tocar.setAttribute('aria-label', r);
    tocar.dataset.dica = r;
    const chave = tocando && faixa ? faixa.titulo : '';
    if (chave && chave !== ultima) {
      nome.textContent = `${faixa.titulo} · ${faixa.artista}`;
      nome.classList.add('visivel');
      clearTimeout(some);
      some = setTimeout(() => nome.classList.remove('visivel'), 2600);
    }
    if (!tocando) { nome.classList.remove('visivel'); clearTimeout(some); }
    ultima = chave;
  });
  return h('div', { class: 'player' }, nome, tocar, trocar);
}

/* ---------- dicas (tooltip) dos botões de ícone ---------- */

function ligarDicas() {
  const dica = h('div', { class: 'dica', role: 'tooltip', id: 'dica', hidden: true });
  document.body.append(dica);
  const mostrar = (b) => {
    if (!b.dataset.dica) return;
    dica.textContent = b.dataset.dica;
    dica.hidden = false;
    const r = b.getBoundingClientRect();
    const w = dica.offsetWidth;
    dica.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    dica.style.top = `${r.top - dica.offsetHeight - 8}px`;
    b.setAttribute('aria-describedby', 'dica');
  };
  const esconder = (b) => { dica.hidden = true; b && b.removeAttribute('aria-describedby'); };
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-dica]');
    if (b && e.pointerType === 'mouse') mostrar(b);
  });
  document.addEventListener('pointerout', (e) => { const b = e.target.closest('[data-dica]'); if (b) esconder(b); });
  document.addEventListener('focusin', (e) => { const b = e.target.closest('[data-dica]'); if (b && b.matches(':focus-visible')) mostrar(b); });
  document.addEventListener('focusout', (e) => { const b = e.target.closest('[data-dica]'); if (b) esconder(b); });
  document.addEventListener('click', () => esconder());
}

/* ---------- contadores ao vivo ---------- */

function iniciarContadores() {
  const conts = [...document.querySelectorAll('[data-contador]')].map((el) => ({
    el,
    inicio: new Date(el.dataset.contador).getTime(),
    partes: Object.fromEntries([...el.querySelectorAll('[data-u]')].map((p) => [p.dataset.u, p])),
    antes: el.querySelector('.contador__antes'),
    fator: el.classList.contains('contador--namoro') ? 0 : 1,
  }));
  for (const c of conts) {
    if (c.fator === 1) continue;
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (reduzido) { c.fator = 1; tick(); return; }
      const t0 = performance.now();
      const sobe = (t) => {
        const k = Math.min(1, (t - t0) / 1800);
        c.fator = 1 - Math.pow(1 - k, 3);
        tick();
        if (k < 1) requestAnimationFrame(sobe);
      };
      requestAnimationFrame(sobe);
    }, { threshold: 0.6 }).observe(c.el);
  }
  function tick() {
    const agora = Date.now();
    for (const c of conts) {
      const futuro = agora < c.inicio;
      if (c.antes) { c.antes.hidden = !futuro; c.el.classList.toggle('futuro', futuro); }
      let s = Math.max(0, Math.floor(((agora - c.inicio) / 1000) * c.fator));
      const v = { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 };
      for (const [u, p] of Object.entries(c.partes)) {
        const t = u === 'dias' ? String(v[u]) : String(v[u]).padStart(2, '0');
        if (p.textContent !== t) p.textContent = t;
      }
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------- segredo (a pontinho) ---------- */

function ligarSegredo(dlg, ui) {
  const pontinho = document.querySelector('[data-pontinho]');
  if (!pontinho) return;
  let retomar = null;
  let parado;
  let posicao = 0;
  const acordar = () => {
    pontinho.classList.remove('pulsando');
    clearTimeout(parado);
    parado = setTimeout(() => pontinho.classList.add('pulsando'), 5000);
  };
  ['scroll', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, acordar, { passive: true }));
  acordar();

  pontinho.addEventListener('click', () => {
    posicao = pararRolagem();
    document.documentElement.classList.add('travado');
    dlg.showModal();
    dlg.querySelector('.segredo__carta').scrollTop = 0;
    dlg.classList.remove('fechando');
    dlg.classList.add('abrindo');
    dlg.querySelector('[data-fechar]').focus();
    const v = dlg.querySelector('video[data-lazy]');
    if (v && !v.src) urlDaMidia(v.__m).then((u) => { v.src = u; });
  });

  const fechar = () => {
    if (!dlg.open) return;
    const v = dlg.querySelector('video');
    if (v) v.pause();
    dlg.classList.add('fechando');
    setTimeout(() => { dlg.close(); dlg.classList.remove('abrindo', 'fechando'); }, reduzido ? 0 : 150);
  };
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('travado');
    pontinho.focus({ preventScroll: true });
    voltarRolagem(posicao);
    if (retomar) { retomar(); retomar = null; }
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dlg.querySelector('[data-fechar]').addEventListener('click', fechar);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fechar(); });

  const v = dlg.querySelector('video');
  if (v) {
    v.addEventListener('play', () => { if (!retomar) retomar = audio.pausarDurante(); });
    v.addEventListener('pause', () => { if (retomar) { retomar(); retomar = null; } });
  }

  // Vales: tocar destaca (fica salvo neste aparelho).
  const CHAVE = 'lm-vales';
  let salvos = [];
  try { salvos = JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch { salvos = []; }
  dlg.querySelectorAll('[data-vale]').forEach((b) => {
    const i = Number(b.dataset.vale);
    const marcar = (on) => {
      b.setAttribute('aria-pressed', String(on));
      b.closest('.vale').classList.toggle('destacado', on);
      b.querySelector('.vale__estado').textContent = on ? ui.vale_devolver : ui.vale_destacar;
    };
    marcar(salvos.includes(i));
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      salvos = on ? [...new Set([...salvos, i])] : salvos.filter((x) => x !== i);
      try { localStorage.setItem(CHAVE, JSON.stringify(salvos)); } catch { /* sem armazenamento */ }
      marcar(on);
    });
  });
}

/* ---------- início ---------- */

(async () => {
  const site = await entrarComSessao().catch(() => null);
  if (site) {
    await abrirSite(site, false);
  } else {
    cadeado.classList.add('pronto');
    if (window.matchMedia('(hover: hover)').matches) input.focus();
  }
})();
