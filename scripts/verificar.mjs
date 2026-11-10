// Confere que nenhum texto da história (nomes, citações, legendas) ficou em
// texto claro no build publicado (dist/). Roda sozinho no fim do `npm run build`.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(ROOT, 'dist');
const CONTEUDO = join(ROOT, 'conteudo');
if (!existsSync(DIST)) { console.error('✖ Não achei a pasta dist/. Rode npm run build.'); process.exit(1); }

const site = JSON.parse(readFileSync(join(CONTEUDO, 'site.json'), 'utf8'));
const senha = readFileSync(join(CONTEUDO, 'senha.txt'), 'utf8').trim();

// Todas as strings do JSON (menos nomes de arquivo e chaves técnicas), quebradas em trechos.
const IGNORAR = new Set(['arquivo', 'inicio', 'tipo', 'momento', 'tema', 'de', 'mime', 'id']);
const trechos = new Set();
(function coletar(no, chave) {
  if (Array.isArray(no)) return no.forEach((x) => coletar(x, chave));
  if (no && typeof no === 'object') return Object.entries(no).forEach(([k, v]) => coletar(v, k));
  if (typeof no !== 'string' || IGNORAR.has(chave)) return;
  for (const t of no.split(/[.,;:!?…“”"()\n]+/)) {
    const s = t.trim();
    if (s.length >= 10) trechos.add(s.toLowerCase());
  }
})(site);

// Palavras extras (nomes, lugares) ficam em conteudo/palavras-privadas.txt, uma por linha.
const arqPalavras = join(CONTEUDO, 'palavras-privadas.txt');
const extras = existsSync(arqPalavras)
  ? readFileSync(arqPalavras, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean)
  : [];
const palavras = [senha, ...extras];

// O caminho do site (nome do repositório) é público por natureza: não conta como vazamento.
const casa = readFileSync(join(ROOT, 'vite.config.js'), 'utf8').match(/base:\s*'\/([^/']+)\//);
const base = casa ? casa[1].toLowerCase() : null;

const arquivos = [];
(function andar(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) andar(p);
    else arquivos.push(p);
  }
})(DIST);

let problemas = 0;
for (const arq of arquivos) {
  if (extname(arq) === '.bin') continue;
  let txt = readFileSync(arq, 'utf8').toLowerCase();
  if (base) txt = txt.replaceAll(base, '');
  for (const p of [...palavras, ...trechos]) {
    if (txt.includes(p)) {
      console.error(`✖ "${p}" aparece em claro em ${arq.slice(DIST.length + 1)}`);
      problemas++;
    }
  }
}

// Nenhum arquivo publicado pode ter no nome um pedaço do nome de uma mídia original.
const pedacos = readdirSync(join(CONTEUDO, 'midia'))
  .flatMap((f) => f.replace(/\.[^.]+$/, '').toLowerCase().split(/[-_ .]+/))
  .filter((w) => w.length >= 4);
for (const a of arquivos) {
  const nome = a.slice(DIST.length).toLowerCase();
  if (pedacos.some((w) => nome.includes(w))) {
    console.error(`✖ nome de arquivo revela conteúdo: ${a}`);
    problemas++;
  }
}

if (problemas) {
  console.error(`\n✖ ${problemas} vazamento(s). Nada foi publicado.\n`);
  process.exit(1);
}
console.log(`✔ Verificação de privacidade: ${arquivos.length} arquivos no build, nenhum texto da história em claro.`);
