// EX-101 : termes interdits cherches sans etre publies. Le fichier de termes est genere ici,
// dans un dossier temporaire : le .termes-prives.txt local du mainteneur n'est jamais lu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { DEPOT } from './aides.mjs';
import { verifierTermes, normaliser, NOM_TERMES } from '../outils/verifier-termes.mjs';

const SCRIPT = join(DEPOT, 'outils', 'verifier-termes.mjs');
const PREFIXE = 'fiscfiction-termes-';

function arbre(fichiersParChemin, { termes = '# commentaire : ignore\n\nSociete Exemple\n' } = {}) {
  const racine = mkdtempSync(join(tmpdir(), PREFIXE));
  if (termes !== null) writeFileSync(join(racine, NOM_TERMES), termes);
  for (const [rel, contenu] of Object.entries(fichiersParChemin)) {
    const f = join(racine, ...rel.split('/'));
    mkdirSync(resolve(f, '..'), { recursive: true });
    writeFileSync(f, contenu);
  }
  return {
    racine,
    nettoyer() {
      if (basename(racine).startsWith(PREFIXE) && resolve(racine).startsWith(resolve(tmpdir()))) rmSync(racine, { recursive: true, force: true });
    },
  };
}

const cli = (racine, env = {}) => spawnSync(process.execPath, [SCRIPT, '--racine', racine], {
  encoding: 'utf8', env: { ...process.env, TERMES_PRIVES_OBLIGATOIRE: '', ...env },
});

test('EX-101 : normalisation insensible a la casse et aux accents', () => {
  assert.equal(normaliser('SOCIÉTÉ EXEMPLE'), 'societe exemple');
  assert.equal(normaliser('Société\u00a0Exemple'), 'societe exemple');
  assert.equal(normaliser('Ça déménage'), 'ca demenage');
});

// Le temoin "Societe Exemplaire" de la spec ne contient pas la chaine "societe exemple"
// (exempl-a-ire) : la sous-chaine assumee est verifiee avec "Societe Exemples", et
// "Exemplaire" est garde comme temoin de ce que la recherche ne fait pas (pas de flou).
test('EX-101 : "SOCIÉTÉ EXEMPLE" et une sous-chaine trouves, fichier sans le terme accepte', () => {
  const a = arbre({
    'majuscules.txt': 'ligne 1\nUne facture de la SOCIÉTÉ EXEMPLE.\n',
    'docs/sous-chaine.md': 'Rien.\nRien.\nChez Societe Exemples reunies.\r\n',
    'docs/voisin.md': 'Societe Exemplaire\n',
    'propre.json': '{ "nom": "Au Pain Perdu" }\n',
  });
  try {
    const r = verifierTermes({ racine: a.racine });
    assert.equal(r.absent, false);
    assert.equal(r.nbTermes, 1);
    assert.equal(r.nbFichiers, 4, 'le fichier de termes lui-meme n\'est pas verifie');
    assert.deepEqual(
      r.trouvailles.sort((x, y) => x.fichier.localeCompare(y.fichier)),
      [{ fichier: 'docs/sous-chaine.md', ligne: 3, terme: 3 }, { fichier: 'majuscules.txt', ligne: 2, terme: 3 }],
    );
    const sortie = cli(a.racine);
    assert.equal(sortie.status, 1);
    assert.match(sortie.stderr, /majuscules\.txt : ligne 2 : terme interdit \(ligne 3 du fichier de termes\)/);
    assert.match(sortie.stderr, /ECHEC : 2 occurrence\(s\)/);
    assert.equal(/exemple/i.test(sortie.stdout + sortie.stderr), false, 'le terme n\'est jamais affiche');
  } finally {
    a.nettoyer();
  }
  const propre = arbre({ 'propre.json': '{ "nom": "Au Pain Perdu" }\n' });
  try {
    const sortie = cli(propre.racine);
    assert.equal(sortie.status, 0, sortie.stderr);
    assert.match(sortie.stdout, /^OK : 1 terme\(s\) cherche\(s\) dans 1 fichier\(s\) : aucune occurrence/);
  } finally {
    propre.nettoyer();
  }
});

test('EX-101 : nom de fichier verifie ; .git/, .worktrees/, node_modules/ et dist/ exclus', () => {
  const a = arbre({
    'img/societe-exemple.svg': '<svg/>',
    'img/Société Exemple.svg': '<svg/>',
    '.git/x': 'Societe Exemple',
    '.worktrees/w/x': 'Societe Exemple',
    'node_modules/m/x': 'Societe Exemple',
    'dist/x': 'Societe Exemple',
  });
  try {
    const r = verifierTermes({ racine: a.racine });
    assert.deepEqual(r.trouvailles, [{ fichier: 'img/Société Exemple.svg', ligne: 0, terme: 3 }]);
  } finally {
    a.nettoyer();
  }
});

test('EX-101 : fichier de termes absent = 0, sauf TERMES_PRIVES_OBLIGATOIRE=1 ; --termes explicite', () => {
  const a = arbre({ 'x.txt': 'Societe Exemple' }, { termes: null });
  try {
    let s = cli(a.racine);
    assert.equal(s.status, 0);
    assert.match(s.stdout, /fichier de termes absent/);
    s = cli(a.racine, { TERMES_PRIVES_OBLIGATOIRE: '1' });
    assert.equal(s.status, 1);
    assert.match(s.stderr, /ECHEC : fichier de termes absent/);
    const ailleurs = arbre({}, { termes: 'societe exemple\n' });
    try {
      s = spawnSync(process.execPath, [SCRIPT, '--racine', a.racine, '--termes', join(ailleurs.racine, NOM_TERMES)], { encoding: 'utf8' });
      assert.equal(s.status, 1);
      assert.match(s.stderr, /x\.txt : ligne 1 : terme interdit/);
    } finally {
      ailleurs.nettoyer();
    }
  } finally {
    a.nettoyer();
  }
});

test('EX-101 : .termes-prives.txt ignore par git et jamais suivi', () => {
  const ignore = spawnSync('git', ['check-ignore', NOM_TERMES], { cwd: DEPOT, encoding: 'utf8' });
  assert.equal(ignore.status, 0, 'git check-ignore doit repondre');
  assert.equal(ignore.stdout.trim(), NOM_TERMES);
  const suivis = spawnSync('git', ['ls-files'], { cwd: DEPOT, encoding: 'utf8' });
  assert.equal(suivis.status, 0);
  assert.equal(suivis.stdout.split('\n').some((f) => f.includes('termes-prives')), false);
});
