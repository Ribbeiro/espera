// Efeitos de scroll. Com "reduzir movimento" ligado, tudo vira fade simples.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
if (import.meta.env.DEV) window.__ST = ScrollTrigger;

export const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TEMAS = {
  noite: '#1C0812',
  estrada: '#170A16',
  bar: '#240716',
  vinho: '#2E0B1C',
  carmim: '#3B0D1E',
  'carmim-forte': '#5A0F22',
  ameixa: '#2A1240',
  rosa: '#3A1430',
  'por-do-sol': '#3A1430',
  mar: '#0D2D52',
  perola: '#1C0812',
};

const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

let lenis = null;

export function iniciarRolagem() {
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (reduzido) return null;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export const pararRolagem = () => lenis && lenis.stop();
export const voltarRolagem = () => lenis && lenis.start();

/* ---------- abertura (o único momento que anima sozinho) ---------- */
export function animarAbertura() {
  const nome = document.querySelector('[data-split-hero]');
  const subs = $$('[data-hero-sub]');
  if (!nome) return;
  if (reduzido) {
    gsap.from([nome, ...subs], { opacity: 0, duration: 0.15 });
    return;
  }
  const split = SplitText.create(nome, { type: 'chars', charsClass: 'letra' });
  gsap.timeline({ delay: 0.2 })
    .from(split.chars, { yPercent: 60, opacity: 0, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: 0.07 })
    .from(subs, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.out', stagger: 0.1 }, '-=0.4');

  // Faróis desfocados: só se mexem com a rolagem (sem loop infinito).
  $$('[data-bokeh] i').forEach((b, i) => {
    const r = (n) => ((Math.sin(i * 12.9898 + n) * 43758.5453) % 1 + 1) % 1;
    gsap.set(b, { left: `${r(1) * 100}%`, top: `${10 + r(2) * 80}%`, scale: 0.4 + r(3) * 1.4, opacity: 0.15 + r(4) * 0.45 });
    gsap.to(b, { yPercent: -120 - r(5) * 260, ease: 'none',
      scrollTrigger: { trigger: '.abertura', start: 'top top', end: 'bottom top', scrub: true } });
  });
}

/* ---------- utilidades ---------- */
function aparecer(alvos, extra = {}) {
  return reduzido
    ? { opacity: 0, duration: 0.15, ...extra.reduzido }
    : { opacity: 0, y: 16, duration: 0.6, ease: 'power3.out', ...extra.normal };
}

function titulos() {
  $$('[data-split]').forEach((el) => {
    if (reduzido) {
      gsap.from(el, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: el, start: 'top 85%' } });
      return;
    }
    const split = SplitText.create(el, { type: 'words,chars', charsClass: 'letra', mask: 'words' });
    gsap.from(split.chars, {
      yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.025,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
}

function textos() {
  $$('[data-revela-texto], .cap-rotulo, .cap-data').forEach((el) => {
    gsap.from(el, { ...aparecer(el), scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
}

function fotos() {
  $$('[data-revela-foto]').forEach((m, i) => {
    const img = m.querySelector('img, video');
    if (reduzido) {
      gsap.from(m, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: m, start: 'top 85%' } });
      return;
    }
    gsap.fromTo(m, { clipPath: 'inset(18% 10% 18% 10% round 4px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 4px)', ease: 'none',
      scrollTrigger: { trigger: m, start: 'top 95%', end: 'top 35%', scrub: 0.6 },
    });
    // A foto "pousa" girando de leve até ficar reta.
    gsap.fromTo(m.parentElement, { rotate: i % 2 ? 4 : -4, y: 40 }, {
      rotate: 0, y: 0, ease: 'none',
      scrollTrigger: { trigger: m, start: 'top 100%', end: 'top 40%', scrub: 0.6 },
    });
    if (img) {
      gsap.fromTo(img, { scale: 1.25, yPercent: -6 }, {
        scale: 1, yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }
  });
}

// Balões chegam um a um, com "digitando…" antes de cada.
function conversas() {
  $$('[data-conversa]').forEach((c) => {
    const msgs = $$('.msg', c);
    if (!msgs.length) return;
    if (reduzido) {
      gsap.from(msgs, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: c, start: 'top 85%' } });
      return;
    }
    // Cada balão chega do lado de quem mandou.
    msgs.forEach((m) => {
      const ela = m.classList.contains('msg--ela');
      gsap.set(m, { opacity: 0, y: 14, x: ela ? -24 : 24, scale: 0.9, transformOrigin: ela ? '0% 100%' : '100% 100%' });
    });
    ScrollTrigger.create({
      trigger: c, start: 'top 82%', once: true,
      onEnter: () => {
        const tl = gsap.timeline();
        msgs.forEach((m, i) => {
          const dig = digitando(m);
          tl.add(() => m.before(dig), i ? '+=0.05' : 0)
            .fromTo(dig, { opacity: 0 }, { opacity: 1, duration: 0.15 })
            .to(dig, { opacity: 0, duration: 0.1, delay: Math.min(0.55, 0.2 + m.textContent.length * 0.006), onComplete: () => dig.remove() })
            .to(m, { opacity: 1, y: 0, x: 0, scale: 1, duration: 0.35, ease: 'power3.out' });
        });
      },
    });
  });
}

function digitando(msg) {
  const d = document.createElement('div');
  d.className = 'digitando ' + (msg.classList.contains('msg--ela') ? 'digitando--ela' : 'digitando--ele');
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<i></i><i></i><i></i>';
  return d;
}

/* ---------- momentos ---------- */

function memoria() {
  $$('[data-memoria]').forEach((el) => {
    if (reduzido) return;
    gsap.fromTo(el, { filter: 'blur(10px)', opacity: 0.25 }, {
      filter: 'blur(0px)', opacity: 1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 45%', scrub: true },
    });
  });
}

function story() {
  $$('[data-story]').forEach((bloco) => {
    const img = bloco.querySelector('[data-story-img]');
    const citacao = bloco.querySelector('.resposta-story');
    if (reduzido) {
      gsap.from([img, citacao], { opacity: 0, duration: 0.15, scrollTrigger: { trigger: bloco, start: 'top 80%' } });
      return;
    }
    // O story chega inteiro e nítido: só cresce um pouco ao entrar.
    gsap.fromTo(img, { scale: 0.9, opacity: 0.4 }, {
      scale: 1, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: img, start: 'top 95%', end: 'top 45%', scrub: 0.6 },
    });
    if (citacao) {
      gsap.from(citacao, { opacity: 0, y: 8, duration: 0.3, ease: 'power3.out',
        scrollTrigger: { trigger: citacao, start: 'top 82%' } });
    }
  });
}

function beijo(abaixar) {
  $$('[data-beijo]').forEach((palco) => {
    const mascara = palco.querySelector('[data-beijo-mascara]');
    const video = palco.querySelector('video');
    const botao = palco.querySelector('[data-som-video]');
    let soltar = null;
    let visivel = false;

    // Com "reduzir movimento", o vídeo não toca sozinho: ganha os controles nativos.
    if (reduzido) { video.controls = true; botao.hidden = true; }

    // Toca mudo quando visível; pausa fora da tela.
    if (!reduzido) new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if (!video.src) return;
      if (visivel) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.25 }).observe(video);
    video.addEventListener('loadeddata', () => { if (visivel && !reduzido) video.play().catch(() => {}); });
    if (reduzido) {
      video.addEventListener('play', () => { if (!soltar) soltar = abaixar(); });
      video.addEventListener('pause', () => { if (soltar) { soltar(); soltar = null; } });
    }

    botao.addEventListener('click', () => {
      video.muted = !video.muted;
      if (!video.muted) {
        video.currentTime = 0;
        video.play().catch(() => {});
        soltar = abaixar();
      } else if (soltar) { soltar(); soltar = null; }
      botao.replaceChildren(iconeSom(!video.muted));
      const rotulo = video.muted ? 'Ligar o som do vídeo' : 'Desligar o som do vídeo';
      botao.setAttribute('aria-label', rotulo);
      botao.dataset.dica = rotulo;
    });

    if (reduzido) return;
    gsap.timeline({ scrollTrigger: { trigger: palco, start: 'top top', end: '+=140%', pin: true, scrub: 0.6 } })
      .fromTo(mascara, { clipPath: 'circle(14% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', ease: 'none', duration: 1 })
      .fromTo(video, { scale: 1.3 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .from(palco.querySelector('.beijo-legenda'), { opacity: 0, y: 10, duration: 0.3 }, 0.8)
      .to({}, { duration: 0.5 });
  });
}

let iconeSom = () => document.createTextNode('');
export function definirIconeSom(fn) { iconeSom = fn; }

function adesivo() {
  $$('[data-adesivo]').forEach((palco) => {
    const c = palco.querySelector('[data-adesivo-circulo]');
    if (reduzido) { gsap.from(c, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: palco, start: 'top 60%' } }); return; }
    gsap.fromTo(c, { scale: 3.2, rotate: -40, opacity: 0 }, {
      scale: 1, rotate: -12, opacity: 1, duration: 0.3, ease: 'power4.in',
      scrollTrigger: { trigger: palco, start: 'top 45%' },
      onComplete: () => gsap.fromTo(palco, { x: -3 }, { x: 0, duration: 0.2, ease: 'power2.out' }),
    });
  });
}

function placar() {
  $$('[data-placar]').forEach((p) => {
    const fitas = $$('[data-placar-fita]', p);
    // O último número de cada fita é o gol real: termina sempre parado nele.
    const fim = (f) => -100 * (f.children.length - 1) / f.children.length;
    if (reduzido) { fitas.forEach((f) => gsap.set(f, { yPercent: fim(f) })); return; }
    fitas.forEach((f) => gsap.set(f, { yPercent: 0 }));
    ScrollTrigger.create({
      trigger: p, start: 'top 75%', once: true,
      onEnter: () => fitas.forEach((f, i) => gsap.to(f, {
        yPercent: fim(f), duration: 1.4 + i * 0.35, ease: 'power3.out',
      })),
    });
  });
}

function lados() {
  $$('[data-lados]').forEach((l) => {
    const [a, b] = $$('[data-lado]', l);
    if (reduzido) { gsap.from([a, b], { opacity: 0, duration: 0.15, scrollTrigger: { trigger: l, start: 'top 80%' } }); return; }
    gsap.from(a, { xPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: l, start: 'top 90%', end: 'top 50%', scrub: 0.6 } });
    gsap.from(b, { xPercent: 30, opacity: 0, ease: 'none', scrollTrigger: { trigger: b, start: 'top 90%', end: 'top 50%', scrub: 0.6 } });
  });
}

function teAmo() {
  $$('[data-teamo]').forEach((palco) => {
    const txt = palco.querySelector('[data-teamo-texto]');
    const hora = palco.querySelector('.teamo-hora');
    if (reduzido) { gsap.from([hora, txt], { opacity: 0, duration: 0.15, scrollTrigger: { trigger: palco, start: 'top 70%' } }); return; }
    const split = SplitText.create(txt, { type: 'words', wordsClass: 'palavra' });
    gsap.timeline({ scrollTrigger: { trigger: palco, start: 'top top', end: '+=130%', pin: true, scrub: 0.6 } })
      .from(hora, { opacity: 0, y: 10, duration: 0.3 })
      .from(split.words, { opacity: 0, scale: 0.4, yPercent: 30, ease: 'expo.out', stagger: 0.25, duration: 0.6 })
      .fromTo(palco, { backgroundColor: 'rgba(122, 16, 41, 0)' }, { backgroundColor: 'rgba(122, 16, 41, 1)', duration: 0.6 }, '<0.2')
      .to({}, { duration: 0.4 })
      .to(palco, { backgroundColor: 'rgba(122, 16, 41, 0)', duration: 0.4 });
  });
}

function galeria() {
  $$('[data-galeria]').forEach((g) => {
    const trilho = g.querySelector('[data-galeria-trilho]');
    if (reduzido) { g.classList.add('galeria--nativa'); return; }
    const distancia = () => Math.max(0, trilho.scrollWidth - window.innerWidth);
    gsap.to(trilho, {
      x: () => -distancia(), ease: 'none',
      scrollTrigger: { trigger: g, start: 'top top', end: () => '+=' + distancia(), pin: true, scrub: 0.6, invalidateOnRefresh: true },
    });
    $$('.galeria__item', trilho).forEach((it, i) => {
      gsap.fromTo(it, { rotate: i % 2 ? 2 : -2 }, { rotate: i % 2 ? -1 : 1, ease: 'none',
        scrollTrigger: { trigger: g, start: 'top top', end: () => '+=' + distancia(), scrub: true } });
    });
  });
}

function muito() {
  $$('[data-muito]').forEach((palco) => {
    const parede = palco.querySelector('[data-muito-parede]');
    const mais = palco.querySelector('[data-muito-mais]');
    const palavra = palco.parentElement.querySelector('[data-muito-palavra]').dataset.muitoPalavra;
    const n = window.innerWidth < 768 ? 140 : 260;
    parede.append(...Array.from({ length: n }, () => { const s = document.createElement('span'); s.textContent = palavra; return s; }));
    const pals = [...parede.children];
    if (reduzido) { gsap.from(mais, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: palco, start: 'top 60%' } }); return; }
    gsap.set(pals, { opacity: 0 });
    gsap.timeline({ scrollTrigger: { trigger: palco, start: 'top top', end: '+=180%', pin: true, scrub: 0.5 } })
      .to(pals, { opacity: 1, duration: 0.05, stagger: { each: 0.02 } })
      .fromTo(mais, { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' })
      .to(parede, { opacity: 0.25, duration: 0.4 }, '<')
      .to({}, { duration: 0.4 });
  });
}

function ponto() {
  $$('[data-ponto]').forEach((p) => {
    const de = p.querySelector('[data-ponto-de]');
    const para = p.querySelector('[data-ponto-para]');
    gsap.set(para, { opacity: 0, yPercent: reduzido ? 0 : 60 });
    function trocar(v) {
      gsap.to(de, { opacity: v ? 0 : 1, yPercent: reduzido ? 0 : (v ? -60 : 0), duration: 0.3, ease: 'power2.out' });
      gsap.to(para, { opacity: v ? 1 : 0, yPercent: reduzido ? 0 : (v ? 0 : 60), duration: 0.3, ease: 'power2.out' });
    }
    ScrollTrigger.create({
      trigger: p, start: 'top 55%', end: 'max',
      onEnter: () => trocar(true), onLeaveBack: () => trocar(false),
    });
  });
}

function elaDiz() {
  $$('[data-ela-diz]').forEach((lista) => {
    const msgs = $$('.msg', lista);
    if (reduzido) { gsap.from(msgs, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: lista, start: 'top 80%' } }); return; }
    msgs.forEach((m) => {
      gsap.fromTo(m, { opacity: 0, y: 30, scale: 0.94 }, {
        opacity: 1, y: 0, scale: 1, ease: 'power2.out',
        scrollTrigger: { trigger: m, start: 'top 92%', end: 'top 70%', scrub: 0.5 },
      });
    });
  });
}

function numeros() {
  $$('[data-conta]').forEach((el) => {
    const alvo = parseFloat(el.dataset.conta);
    const dec = parseInt(el.dataset.decimais, 10) || 0;
    const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (reduzido) return;
    const obj = { v: 0 };
    el.textContent = fmt(0);
    gsap.to(obj, {
      v: alvo, duration: alvo > 1000 ? 2.2 : 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
      onUpdate: () => { el.textContent = fmt(dec ? obj.v : Math.round(obj.v)); },
    });
  });
  $$('[data-duelo]').forEach((b) => {
    if (reduzido) return;
    gsap.from(b, { scaleX: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 90%' } });
  });
}

function painel() {
  const CHARS = 'ABCDEFGHIJLMNOPQRSTUVXZ';
  $$('[data-flap]').forEach((linha) => {
    const alvo = linha.dataset.flap.toUpperCase();
    const flaps = [...linha.children];
    const fim = () => flaps.forEach((f, i) => { f.textContent = alvo[i] === ' ' ? ' ' : alvo[i]; });
    if (reduzido) { fim(); return; }
    flaps.forEach((f) => { f.textContent = ' '; });
    ScrollTrigger.create({
      trigger: linha, start: 'top 85%', once: true,
      onEnter: () => flaps.forEach((f, i) => {
        let passos = 6 + i * 2;
        const id = setInterval(() => {
          if (--passos <= 0) { clearInterval(id); f.textContent = alvo[i] === ' ' ? ' ' : alvo[i]; return; }
          f.textContent = CHARS[(Math.random() * CHARS.length) | 0];
        }, 55);
      }),
    });
  });
}

function poente() {
  $$('[data-poente]').forEach((palco) => {
    const sol = $$('[data-sol], [data-sol-nucleo]', palco);
    const ceu = $$('[data-ceu]', palco);
    const frase = palco.querySelector('[data-poente-frase]');
    const reflexo = palco.querySelector('[data-reflexo]');
    if (reduzido) {
      gsap.set(sol, { attr: { cy: 360 } });
      gsap.from(frase, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: palco, start: 'top 50%' } });
      return;
    }
    gsap.timeline({ scrollTrigger: { trigger: palco, start: 'top top', end: '+=160%', pin: true, scrub: 0.8 } })
      .to(sol, { attr: { cy: 445 }, ease: 'none', duration: 1 })
      .to(ceu[0], { attr: { 'stop-color': '#16173F' }, duration: 1, ease: 'none' }, 0)
      .to(ceu[1], { attr: { 'stop-color': '#E0607E' }, duration: 1, ease: 'none' }, 0)
      .to(ceu[2], { attr: { 'stop-color': '#FFB38A' }, duration: 1, ease: 'none' }, 0)
      .to(reflexo, { opacity: 0.95, scaleX: 1.4, transformOrigin: '50% 0%', duration: 1, ease: 'none' }, 0)
      .from(frase, { opacity: 0, y: 16, duration: 0.3 }, 0.75)
      .to({}, { duration: 0.3 });
  });
}

function virada() {
  $$('[data-virada]').forEach((v) => {
    const ponte = v.querySelector('[data-virada-ponte]');
    const namoro = v.querySelector('.contador--namoro');
    if (reduzido) { gsap.from([ponte, namoro], { opacity: 0, duration: 0.15, scrollTrigger: { trigger: v, start: 'top 70%' } }); return; }
    gsap.timeline({ scrollTrigger: { trigger: v, start: 'top top', end: '+=110%', pin: true, scrub: 0.6 } })
      .from(ponte, { opacity: 0, y: 20, duration: 0.4 })
      .to(ponte, { opacity: 0.35, scale: 0.9, duration: 0.4 }, '+=0.3')
      .fromTo(namoro, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, '<')
      .to({}, { duration: 0.4 });
  });
}

function carta() {
  $$('[data-linhas]').forEach((p) => {
    if (reduzido) { gsap.from(p, { opacity: 0, duration: 0.15, scrollTrigger: { trigger: p, start: 'top 85%' } }); return; }
    const split = SplitText.create(p, { type: 'lines', linesClass: 'linha' });
    split.lines.forEach((l) => {
      gsap.fromTo(l, { opacity: 0.12 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: l, start: 'top 85%', end: 'top 60%', scrub: true } });
    });
  });
}

function fundo() {
  $$('[data-tema]').forEach((s) => {
    const cor = TEMAS[s.dataset.tema] || TEMAS.noite;
    ScrollTrigger.create({
      trigger: s, start: 'top 55%', end: 'bottom 55%', refreshPriority: -1,
      onToggle: (st) => st.isActive && gsap.to(document.body, { backgroundColor: cor, duration: reduzido ? 0 : 0.8, ease: 'power1.out', overwrite: 'auto' }),
    });
  });
}

function progresso(barra) {
  const segs = $$('[data-seg]');
  barra.replaceChildren(...segs.map((s) => {
    const seg = document.createElement('span');
    seg.className = 'progresso__seg';
    seg.innerHTML = '<i></i>';
    return seg;
  }));
  const fills = $$('i', barra);
  segs.forEach((s, i) => {
    const prox = segs[i + 1];
    ScrollTrigger.create({
      trigger: s, start: 'top 60%', refreshPriority: -1,
      endTrigger: prox || document.body, end: prox ? 'top 60%' : 'bottom bottom',
      onUpdate: (st) => gsap.set(fills[i], { scaleX: st.progress }),
      onRefresh: (st) => gsap.set(fills[i], { scaleX: st.progress }),
    });
  });
}

// Número grande vazado do capítulo sobe mais devagar que o resto (parallax),
// e a linha ao lado do "Capítulo N" se desenha conforme a rolagem.
function cabecas() {
  $$('[data-cap-numero]').forEach((n) => {
    if (reduzido) return;
    gsap.fromTo(n, { yPercent: 40, opacity: 0 }, {
      yPercent: -40, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: n.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
  $$('[data-cap-linha]').forEach((l) => {
    if (reduzido) { gsap.set(l, { scaleX: 1 }); return; }
    gsap.fromTo(l, { scaleX: 0 }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: l, start: 'top 90%', end: 'top 55%', scrub: 0.6 },
    });
  });
}

// Faixas de frases: correm de lado com a rolagem, uma pra cada direção.
function faixas() {
  $$('[data-faixa]').forEach((f, i) => {
    const trilho = f.querySelector('[data-faixa-trilho]');
    if (reduzido) return;
    const ida = i % 2 === 0;
    gsap.fromTo(trilho, { xPercent: ida ? 0 : -33.333 }, {
      xPercent: ida ? -33.333 : 0, ease: 'none',
      scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: 0.4 },
    });
    gsap.fromTo(f, { rotate: ida ? -3 : 3 }, {
      rotate: ida ? 2 : -2, ease: 'none',
      scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

// "Eu amo…": a tela fica presa e cada coisa entra por baixo empurrando a anterior.
function amo() {
  $$('[data-amo]').forEach((palco) => {
    const itens = $$('.amo__item', palco);
    const n = palco.querySelector('[data-amo-n]');
    if (reduzido || !itens.length) { palco.classList.add('amo-palco--lista'); return; }
    gsap.set(itens, { yPercent: 110, opacity: 0 });
    gsap.set(itens[0], { yPercent: 0, opacity: 1 });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: palco, start: 'top top', end: `+=${itens.length * 55}%`, pin: true, scrub: 0.5,
        onUpdate: (st) => { n.textContent = String(Math.min(itens.length, 1 + Math.floor(st.progress * itens.length))); },
      },
    });
    itens.forEach((it, i) => {
      if (!i) return;
      // Sai uma, entra a outra (sem as duas na tela ao mesmo tempo), e segura um pouco.
      tl.to(itens[i - 1], { yPercent: -110, opacity: 0, duration: 0.6, ease: 'power2.in' })
        .fromTo(it, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power2.out' })
        .to({}, { duration: 0.5 });
    });
    tl.to({}, { duration: 0.8 });
  });
}

export function iniciarEfeitos({ barra, abaixar }) {
  fundo();
  cabecas();
  faixas();
  amo();
  titulos();
  textos();
  memoria();
  story();
  beijo(abaixar);
  adesivo();
  placar();
  lados();
  teAmo();
  galeria();
  muito();
  ponto();
  elaDiz();
  numeros();
  painel();
  poente();
  virada();
  carta();
  fotos();
  conversas();
  progresso(barra);
  // Os gatilhos foram criados por tipo, não na ordem da página: reordena antes de medir.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  document.fonts.ready.then(() => ScrollTrigger.refresh());

  // Se qualquer coisa mudar a altura da história depois (foto, fonte, vídeo),
  // recalcula todas as posições, senão textos podem ficar sem aparecer.
  const historia = document.getElementById('historia');
  let altura = historia.offsetHeight;
  let espera;
  new ResizeObserver(() => {
    const nova = historia.offsetHeight;
    if (Math.abs(nova - altura) < 2) return;
    altura = nova;
    clearTimeout(espera);
    espera = setTimeout(() => ScrollTrigger.refresh(), 200);
  }).observe(historia);
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

export const atualizar = () => ScrollTrigger.refresh();
