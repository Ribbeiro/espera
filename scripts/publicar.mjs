// npm run publicar → otimiza, criptografa, gera o build, confere privacidade
// e envia só a pasta dist/ (já criptografada) pro branch gh-pages.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import ghpages from 'gh-pages';

const rodar = (cmd) => execSync(cmd, { stdio: 'inherit' });

try {
  rodar('node scripts/build-content.mjs');
  rodar('npx vite build --logLevel warn');
  rodar('node scripts/verificar.mjs');
} catch {
  console.error('\n✖ O build parou antes de publicar. Nada foi enviado.\n');
  process.exit(1);
}

let remoto = '';
try { remoto = execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* sem remoto */ }
if (!remoto) {
  console.error('\n✖ Este projeto ainda não está ligado a um repositório do GitHub.');
  console.error('  Veja o passo "Primeira publicação" no seu LEIA-ME.\n');
  process.exit(1);
}

writeFileSync('dist/.nojekyll', '');
console.log('\nEnviando pro GitHub Pages…');
ghpages.publish('dist', { branch: 'gh-pages', dotfiles: true, history: false, message: 'Atualização' }, (err) => {
  if (err) {
    console.error('\n✖ Não consegui enviar: ' + err.message);
    console.error('  Confere se você está logado no Git (git push funciona?) e tenta de novo.\n');
    process.exit(1);
  }
  const m = remoto.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  const url = m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : '(o endereço do seu GitHub Pages)';
  console.log(`\n✔ Publicado. Em 1 ou 2 minutos está no ar em:\n  ${url}\n`);
});
