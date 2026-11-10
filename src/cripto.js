// Descriptografia no navegador (WebCrypto). Formato de cada .bin: iv(12) + cifra + tag(16).
const BASE = import.meta.env.BASE_URL + 'c/';
const CHAVE_SESSAO = 'lm-k';
let chave = null;
const cacheMidia = new Map();

async function buscar(nome) {
  const r = await fetch(BASE + nome, { cache: 'no-cache' });
  if (!r.ok) throw new Error('rede');
  return r.arrayBuffer();
}

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function deB64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function importar(bruta) {
  return crypto.subtle.importKey('raw', bruta, 'AES-GCM', false, ['decrypt']);
}

async function abrir(buf) {
  const dados = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: dados.slice(0, 12) }, chave, dados.slice(12));
}

/** Deriva a chave da senha e devolve o conteúdo do site. Lança 'senha' se não abrir. */
export async function entrarComSenha(senha) {
  const cfg = JSON.parse(new TextDecoder().decode(await buscar('k.json')));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bruta = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deB64(cfg.s), iterations: cfg.i }, base, 256);
  chave = await importar(bruta);
  const site = await lerSite();
  try { sessionStorage.setItem(CHAVE_SESSAO, b64(bruta)); } catch { /* aba anônima */ }
  return site;
}

/** Tenta reabrir com a chave guardada nesta aba. Devolve null se não houver. */
export async function entrarComSessao() {
  let salva = null;
  try { salva = sessionStorage.getItem(CHAVE_SESSAO); } catch { return null; }
  if (!salva) return null;
  try {
    chave = await importar(deB64(salva));
    return await lerSite();
  } catch {
    try { sessionStorage.removeItem(CHAVE_SESSAO); } catch { /* nada */ }
    return null;
  }
}

async function lerSite() {
  const buf = await buscar('s.bin');
  let claro;
  try { claro = await abrir(buf); } catch { throw new Error('senha'); }
  return JSON.parse(new TextDecoder().decode(claro));
}

/** Devolve uma Object URL para a mídia criptografada `m` ({id, mime}). */
export function urlDaMidia(m) {
  if (!m) return Promise.resolve(null);
  if (!cacheMidia.has(m.id)) {
    cacheMidia.set(m.id, buscar(m.id + '.bin')
      .then(abrir)
      .then((claro) => URL.createObjectURL(new Blob([claro], { type: m.mime }))));
  }
  return cacheMidia.get(m.id);
}
