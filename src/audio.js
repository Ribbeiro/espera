// Música de fundo. No iPhone o volume de <audio> é fixo, então o volume (fade e
// "duck") passa por um GainNode do Web Audio. Tudo é destravado no toque de "Entrar".
import { urlDaMidia } from './cripto.js';

const VOLUME = 0.7;
const VOLUME_BAIXO = 0.08;
let ctx = null;
let ganho = null;
let el = null;
let faixas = [];
let atual = 0;
let tocando = false;
let abaixado = 0;
const ouvintes = new Set();

let carregado = false;

function silencio() {
  // WAV curtinho e mudo, só pra "abençoar" o elemento dentro do gesto.
  const n = 800;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Chamar de dentro do toque/clique (exigência do Safari). */
export function destravar() {
  if (el) return;
  el = new Audio();
  el.setAttribute('playsinline', '');
  el.preload = 'auto';
  el.loop = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    ganho = ctx.createGain();
    ganho.gain.value = 0;
    ctx.createMediaElementSource(el).connect(ganho).connect(ctx.destination);
    ctx.resume();
  } catch {
    ctx = null;
  }
  el.src = silencio();
  el.play().catch(() => {});
}

function rampa(alvo, segundos) {
  if (ctx && ganho) {
    const t = ctx.currentTime;
    ganho.gain.cancelScheduledValues(t);
    ganho.gain.setValueAtTime(ganho.gain.value, t);
    ganho.gain.linearRampToValueAtTime(alvo, t + segundos);
  } else if (el) {
    el.volume = Math.max(0, Math.min(1, alvo));
  }
}

function volumeAlvo() {
  return abaixado > 0 ? VOLUME_BAIXO : VOLUME;
}

function avisar() {
  ouvintes.forEach((fn) => fn({ tocando, faixa: faixas[atual], indice: atual }));
}

export function aoMudar(fn) {
  ouvintes.add(fn);
  fn({ tocando, faixa: faixas[atual], indice: atual });
}

export function configurar(lista) {
  faixas = lista.filter((f) => f.m);
}

async function carregar(i) {
  const url = await urlDaMidia(faixas[i].m);
  if (!el) destravar();
  el.src = url;
  carregado = true;
}

export async function tocar(i = atual) {
  if (!faixas.length) return;
  const trocar = i !== atual || !el || !carregado;
  atual = i;
  tocando = true;
  avisar();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (trocar) {
    rampa(0, 0.01);
    await carregar(i);
  }
  try {
    await el.play();
    rampa(volumeAlvo(), trocar ? 2.5 : 0.6);
  } catch {
    tocando = false;
    avisar();
  }
}

export function pausar() {
  tocando = false;
  avisar();
  rampa(0, 0.3);
  setTimeout(() => { if (!tocando && el) el.pause(); }, 320);
}

export function alternar() {
  return tocando ? pausar() : tocar();
}

export function proxima() {
  if (faixas.length < 2) return;
  return tocar((atual + 1) % faixas.length);
}

/** Abaixa a música enquanto um vídeo com som toca. Use o retorno pra soltar. */
export function abaixar() {
  abaixado++;
  if (tocando) rampa(VOLUME_BAIXO, 0.4);
  let solto = false;
  return () => {
    if (solto) return;
    solto = true;
    abaixado = Math.max(0, abaixado - 1);
    if (tocando) rampa(volumeAlvo(), 0.8);
  };
}

/** Pausa a música durante algo e retoma depois (vídeo do segredo). */
export function pausarDurante() {
  const estava = tocando;
  if (estava) pausar();
  return () => { if (estava) tocar(); };
}

export const estaTocando = () => tocando;
