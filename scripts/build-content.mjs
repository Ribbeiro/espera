// Lê conteudo/site.json + conteudo/midia/, otimiza a mídia e criptografa tudo
// (AES-256-GCM, chave PBKDF2-SHA256) em public/c/. Nada sai daqui em texto claro.
import { createCipheriv, createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CONTEUDO = join(ROOT, 'conteudo');
const MIDIA = join(CONTEUDO, 'midia');
const CACHE = join(CONTEUDO, '.cache');
const SAIDA = join(ROOT, 'public', 'c');
const ITERACOES = 300000;

const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO = new Set(['.mp4', '.mov', '.m4v']);
const AUDIO = new Set(['.m4a', '.mp3', '.aac', '.wav']);

function lerSenha() {
  const arq = join(CONTEUDO, 'senha.txt');
  if (!existsSync(arq)) {
    console.error('\n✖ Falta o arquivo conteudo/senha.txt (só com a senha dentro).\n');
    process.exit(1);
  }
  // Mesma regra do site: sem diferença de maiúscula, acento ou espaço.
  return readFileSync(arq, 'utf8').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function lerSalt() {
  const arq = join(CONTEUDO, '.salt');
  if (!existsSync(arq)) writeFileSync(arq, randomBytes(16).toString('base64'));
  return Buffer.from(readFileSync(arq, 'utf8').trim(), 'base64');
}

function cifrar(chave, dados) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([iv, corpo, c.getAuthTag()]);
}

function hash(buf, extra = '') {
  return createHash('sha256').update(buf).update(extra).digest('hex').slice(0, 24);
}

async function otimizar(arquivo) {
  const ext = extname(arquivo).toLowerCase();
  const fonte = readFileSync(arquivo);
  mkdirSync(CACHE, { recursive: true });

  if (IMG.has(ext)) {
    const destino = join(CACHE, hash(fonte, 'img-v2') + '.webp');
    if (!existsSync(destino)) {
      await sharp(fonte).rotate().resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 }).toFile(destino);
    }
    const meta = await sharp(destino).metadata();
    return { dados: readFileSync(destino), mime: 'image/webp', w: meta.width, h: meta.height };
  }

  if (VIDEO.has(ext)) {
    const destino = join(CACHE, hash(fonte, 'vid-v2') + '.mp4');
    if (!existsSync(destino)) {
      console.log(`  convertendo vídeo ${arquivo.split(/[\\/]/).pop()} (pode levar um minuto)…`);
      execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', arquivo,
        '-vf', "scale='if(gt(iw,ih),min(1280,iw),min(720,iw))':-2",
        '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', destino]);
    }
    return { dados: readFileSync(destino), mime: 'video/mp4' };
  }

  if (AUDIO.has(ext)) {
    if (ext === '.m4a' || ext === '.aac') return { dados: fonte, mime: 'audio/mp4' };
    const destino = join(CACHE, hash(fonte, 'aud-v1') + '.m4a');
    if (!existsSync(destino)) {
      execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', arquivo, '-vn', '-c:a', 'aac', '-b:a', '128k', destino]);
    }
    return { dados: readFileSync(destino), mime: 'audio/mp4' };
  }

  throw new Error(`Formato não suportado: ${arquivo} (use jpg, png, mp4, mov ou m4a)`);
}

// Procura todo campo "arquivo" no JSON e devolve os objetos que o contêm.
function coletarRefs(no, lista = []) {
  if (Array.isArray(no)) no.forEach((x) => coletarRefs(x, lista));
  else if (no && typeof no === 'object') {
    if (typeof no.arquivo === 'string') lista.push(no);
    Object.values(no).forEach((x) => coletarRefs(x, lista));
  }
  return lista;
}

async function main() {
  const t0 = Date.now();
  const senha = lerSenha();
  const salt = lerSalt();
  const chave = pbkdf2Sync(senha, salt, ITERACOES, 32, 'sha256');

  let site;
  try {
    site = JSON.parse(readFileSync(join(CONTEUDO, 'site.json'), 'utf8'));
  } catch (e) {
    console.error('\n✖ O conteudo/site.json tem um erro de digitação:\n  ' + e.message + '\n');
    process.exit(1);
  }

  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(SAIDA, { recursive: true });

  const refs = coletarRefs(site);
  const feitos = new Map();
  const faltando = [];
  let total = 0;

  for (const ref of refs) {
    const caminho = join(MIDIA, ref.arquivo);
    if (!existsSync(caminho)) {
      ref.m = null;
      faltando.push({ arquivo: ref.arquivo, opcional: !!ref.opcional });
      continue;
    }
    if (!feitos.has(ref.arquivo)) {
      const { dados, mime, w, h } = await otimizar(caminho);
      const id = createHmac('sha256', chave).update(ref.arquivo).digest('hex').slice(0, 20);
      const cifrado = cifrar(chave, dados);
      writeFileSync(join(SAIDA, id + '.bin'), cifrado);
      total += cifrado.length;
      feitos.set(ref.arquivo, { id, mime, w, h, kb: Math.round(dados.length / 1024) });
    }
    ref.m = feitos.get(ref.arquivo);
  }

  const json = Buffer.from(JSON.stringify(site), 'utf8');
  writeFileSync(join(SAIDA, 's.bin'), cifrar(chave, json));
  writeFileSync(join(SAIDA, 'k.json'), JSON.stringify({ s: salt.toString('base64'), i: ITERACOES }));

  const naoUsados = readdirSync(MIDIA).filter((f) => !feitos.has(f) && statSync(join(MIDIA, f)).isFile());

  console.log(`✔ Conteúdo criptografado: ${feitos.size} arquivos de mídia, ${(total / 1048576).toFixed(1)} MB, em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const { arquivo, opcional } of faltando) {
    console.log(opcional ? `  · ainda sem ${arquivo} (o site mostra um espaço reservado)` : `  ⚠ o JSON cita ${arquivo}, mas ele não está em conteudo/midia/`);
  }
  for (const f of naoUsados) console.log(`  · ${f} está na pasta, mas nenhuma linha do JSON usa ele`);
}

main().catch((e) => {
  console.error('\n✖ ' + e.message);
  process.exit(1);
});
