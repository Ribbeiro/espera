import 'lenis/dist/lenis.css';
import './estilos.css';
import { entrarComSenha, entrarComSessao, urlDaMidia } from './cripto.js';
import { montarSite, montarSegredo, h, icone } from './render.js';
import * as audio from './audio.js';
import {
  iniciarRolagem, animarAbertura, iniciarEfeitos, definirIconeSom, pararRolagem, voltarRolagem, reduzido, atualizar,
} from './efeitos.js';

const cadeado = document.getElementById('cadeado');
const form = document.getElementById('cadeado-form');
const input = document.getElementById('senha');
const campo = document.getElementById('cadeado-campo');
const msg = document.getElementById('cadeado-msg');
const entrar = document.getElementById('cadeado-entrar');
const app = document.getElementById('app');
const slots = [...document.querySelectorAll('.cadeado__slots span')];

/* ---------- tela de senha ---------- */

function pintarSlots() {
  const v = input.value;
  slots.forEach((s, i) => {
    s.textContent = v[i] || '';
    s.classList.toggle('cheio', !!v[i]);
    s.classList.toggle('atual', i === Math.min(v.length, 5) && document.activeElement === input);
  });
}

input.addEventListener('input', () => {
  input.value = input.value.replace(/\D/g, '').slice(0, 6);
  msg.textContent = '';
  campo.classList.remove('erro');
  pintarSlots();
});
input.addEventListener('focus', pintarSlots);
input.addEventListener('blur', pintarSlots);
campo.addEventListener('click', () => input.focus());

let ocupado = false;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (ocupado) return;
  if (input.value.length < 6) {
    avisar('Faltam números. São 6: dia, mês e ano.');
    return;
  }
  audio.destravar(); // precisa estar dentro do toque (iPhone)
  ocupado = true;
  entrar.setAttribute('aria-busy', 'true');
  const giro = setTimeout(() => entrar.classList.add('carregando'), 100);
  try {
    const site = await entrarComSenha(input.value);
    await abrirSite(site, true);
  } catch (err) {
    if (err.message === 'senha') {
      avisar('Não é essa, amor. Pensa na data de novo (ddmmaa).');
      input.select();
    } else {
      avisar('A internet falhou no meio do caminho. Confere a conexão e toca em Entrar de novo.');
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
  ligarSegredo(segredo);
  ligarDicas();

  await new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 60); });
  cadeado.classList.add('saindo');
  setTimeout(() => cadeado.remove(), reduzido ? 0 : 320);
  document.documentElement.classList.add('aberto');
  window.scrollTo(0, 0);

  iniciarRolagem();
  iniciarEfeitos({ barra, abaixar: audio.abaixar });
  animarAbertura();
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
      if (el.tagName === 'IMG') el.addEventListener('load', () => atualizar(), { once: true });
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
  tocar.addEventListener('click', () => { audio.destravar(); audio.alternar(); });
  trocar.addEventListener('click', () => { audio.destravar(); audio.proxima(); });
  if (musicas.filter((m) => m.m).length < 2) trocar.hidden = true;
  audio.aoMudar(({ tocando, faixa }) => {
    tocar.replaceChildren(icone(tocando ? 'pause' : 'play'));
    const r = tocando ? 'Pausar música' : 'Tocar música';
    tocar.setAttribute('aria-label', r);
    tocar.dataset.dica = r;
    nome.textContent = faixa ? `${faixa.titulo} · ${faixa.artista}` : '';
    nome.classList.toggle('visivel', !!tocando);
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
  }));
  const tick = () => {
    const agora = Date.now();
    for (const c of conts) {
      const futuro = agora < c.inicio;
      if (c.antes) { c.antes.hidden = !futuro; c.el.classList.toggle('futuro', futuro); }
      let s = Math.max(0, Math.floor((agora - c.inicio) / 1000));
      const v = { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 };
      for (const [u, p] of Object.entries(c.partes)) {
        const t = u === 'dias' ? String(v[u]) : String(v[u]).padStart(2, '0');
        if (p.textContent !== t) p.textContent = t;
      }
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- segredo (a pontinho) ---------- */

function ligarSegredo(dlg) {
  const pontinho = document.querySelector('[data-pontinho]');
  if (!pontinho) return;
  let retomar = null;
  let parado;
  const acordar = () => {
    pontinho.classList.remove('pulsando');
    clearTimeout(parado);
    parado = setTimeout(() => pontinho.classList.add('pulsando'), 5000);
  };
  ['scroll', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, acordar, { passive: true }));
  acordar();

  pontinho.addEventListener('click', () => {
    pararRolagem();
    dlg.showModal();
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
  dlg.addEventListener('close', () => { voltarRolagem(); pontinho.focus(); if (retomar) { retomar(); retomar = null; } });
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
      b.querySelector('.vale__estado').textContent = on ? 'Destacado. Toque de novo pra devolver' : 'Toque pra destacar';
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
    pintarSlots();
  }
})();
