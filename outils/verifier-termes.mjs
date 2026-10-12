#!/usr/bin/env node
// Termes interdits sans les publier (EX-101, controle de EX-001 / EX-100).
// Usage : node outils/verifier-termes.mjs [--racine <dossier>] [--termes <fichier>]
//   --racine : dossier a parcourir (defaut : racine du depot)
//   --termes : fichier de termes (defaut : <racine>/.termes-prives.txt, local et non suivi)
// Cherche chaque terme (un par ligne, `#` = commentaire) dans le chemin et le contenu de tous les
// fichiers sous la racine (suivis ou non), hors .git/, .worktrees/, node_modules/ et dist/,
// insensible a la casse et aux accents. Les termes eux-memes ne sont jamais affiches : une
// trouvaille est signalee par fichier, ligne et numero de ligne du terme dans le fichier de termes.
// Fichier de termes absent : message et code 0 (contributeurs externes), sauf avec
// TERMES_PRIVES_OBLIGATOIRE=1 (code 1). Trouvaille : code 1.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RACINE_DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NOM_TERMES = '.termes-prives.txt';
export const DOSSIERS_EXCLUS = ['.git', '.worktrees', 'node_modules', 'dist'];

/** Minuscules, sans diacritiques (NFD puis marques retirees), espaces regroupes. */
export function normaliser(texte) {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s\u00a0\u202f]+/g, ' ');
}

/** Termes d'un fichier : un par ligne, lignes vides et commentaires `#` ignores. */
export function lireTermes(fichier) {
  return readFileSync(fichier, 'utf8')
    .split(/\r?\n/)
    .map((l, i) => ({ numero: i + 1, brut: l.trim() }))
    .filter((t) => t.brut && !t.brut.startsWith('#'))
    .map((t) => ({ numero: t.numero, norme: normaliser(t.brut) }))
    .filter((t) => t.norme.trim());
}

function* fichiers(racine, dossier = racine) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    // .git est un dossier dans le depot principal et un fichier dans un worktree : exclu dans les deux cas.
    if (dossier === racine && DOSSIERS_EXCLUS.includes(entree.name)) continue;
    if (entree.isDirectory()) {
      yield* fichiers(racine, chemin);
    } else if (entree.isFile()) {
      yield chemin;
    }
  }
}

/**
 * Verifie `racine`. Renvoie { termes: chemin | null, absent, nbTermes, nbFichiers, trouvailles }
 * ou chaque trouvaille = { fichier (relatif, separateur /), ligne (0 = chemin du fichier), terme (numero de ligne) }.
 */
export function verifierTermes({ racine = RACINE_DEPOT, termes = null } = {}) {
  const base = resolve(racine);
  const fichierTermes = resolve(termes ?? join(base, NOM_TERMES));
  if (!existsSync(fichierTermes) || !statSync(fichierTermes).isFile()) {
    return { termes: fichierTermes, absent: true, nbTermes: 0, nbFichiers: 0, trouvailles: [] };
  }
  const liste = lireTermes(fichierTermes);
  const trouvailles = [];
  let nbFichiers = 0;
  for (const chemin of fichiers(base)) {
    if (resolve(chemin) === fichierTermes) continue;
    nbFichiers += 1;
    const rel = relative(base, chemin).split(sep).join('/');
    const nomNorme = normaliser(rel);
    for (const t of liste) if (nomNorme.includes(t.norme)) trouvailles.push({ fichier: rel, ligne: 0, terme: t.numero });
    const lignes = normaliser(readFileSync(chemin).toString('utf8').replace(/\r?\n/g, '\u0000')).split('\u0000');
    lignes.forEach((l, i) => {
      for (const t of liste) if (l.includes(t.norme)) trouvailles.push({ fichier: rel, ligne: i + 1, terme: t.numero });
    });
  }
  return { termes: fichierTermes, absent: false, nbTermes: liste.length, nbFichiers, trouvailles };
}

function options(argv) {
  const o = { racine: RACINE_DEPOT, termes: null };
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!(cle in o) || argv[i + 1] === undefined) throw new Error(`option ${argv[i]} inconnue ou sans valeur`);
    o[cle] = resolve(argv[i + 1]);
  }
  return o;
}

export function principal(argv = process.argv.slice(2), env = process.env) {
  let o;
  try {
    o = options(argv);
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    console.error('Usage : node outils/verifier-termes.mjs [--racine <dossier>] [--termes <fichier>]');
    return 2;
  }
  const r = verifierTermes(o);
  if (r.absent) {
    const message = `fichier de termes absent (${relative(process.cwd(), r.termes) || r.termes}) : aucune verification`;
    if (env.TERMES_PRIVES_OBLIGATOIRE === '1') {
      console.error(`ECHEC : ${message} (TERMES_PRIVES_OBLIGATOIRE=1)`);
      return 1;
    }
    console.log(`OK : ${message} (normal hors du poste du mainteneur)`);
    return 0;
  }
  for (const t of r.trouvailles) {
    const ou = t.ligne === 0 ? 'nom du fichier' : `ligne ${t.ligne}`;
    console.error(`${t.fichier} : ${ou} : terme interdit (ligne ${t.terme} du fichier de termes)`);
  }
  if (r.trouvailles.length) {
    console.error(`ECHEC : ${r.trouvailles.length} occurrence(s) de termes interdits dans ${new Set(r.trouvailles.map((t) => t.fichier)).size} fichier(s)`);
    return 1;
  }
  console.log(`OK : ${r.nbTermes} terme(s) cherche(s) dans ${r.nbFichiers} fichier(s) : aucune occurrence`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = principal();
}
