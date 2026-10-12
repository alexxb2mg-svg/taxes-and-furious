// Point d'entree de `node --test tests/` : avec un dossier en argument, Node 26 charge
// tests/index.js comme module ; ce fichier importe alors tous les tests/*.test.mjs.
// (`node --test` sans argument trouve les memes fichiers par son motif par defaut.)
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const fichiers = readdirSync(__dirname).filter((n) => n.endsWith('.test.mjs')).sort();
  for (const f of fichiers) await import(pathToFileURL(join(__dirname, f)).href);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
