#!/usr/bin/env node
// Construction du site statique (EX-105) : copie dans dist/ (ou --sortie <dossier>) uniquement
// index.html, css/, js/ et data/ sans data/profils/_modele/, plus _headers (en-tetes Cloudflare Pages).
// Aucune dependance. Usage : node outils/construire.mjs [--sortie <dossier>]

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SORTIE_DEFAUT = join(DEPOT, 'dist');
export const CONTENU = ['index.html', 'css', 'js', 'data'];
export const EXCLUS = ['data/profils/_modele'];

export const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
export const ENTETES = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/** Texte du fichier _headers de Cloudflare Pages : les en-tetes s'appliquent a toutes les URL. */
export function texteHeaders(entetes = ENTETES) {
  return `/*\n${Object.entries(entetes).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n`;
}

/** Lit un fichier _headers (format ci-dessus) : { motif: { en-tete: valeur } }. */
export function lireHeaders(texte) {
  const regles = {};
  let courant = null;
  for (const ligne of texte.split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith('#')) continue;
    if (!/^\s/.test(ligne)) {
      courant = ligne.trim();
      regles[courant] = {};
    } else if (courant) {
      const i = ligne.indexOf(':');
      regles[courant][ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
    }
  }
  return regles;
}

/**
 * Vide `sortie` sans risque : seules les entrees que la construction produit elle-meme peuvent y
 * figurer ; toute autre entree fait echouer (on ne supprime jamais un dossier qui n'est pas une construction).
 */
function preparerSortie(sortie) {
  if (!existsSync(sortie)) {
    mkdirSync(sortie, { recursive: true });
    return;
  }
  if (!statSync(sortie).isDirectory()) throw new Error(`${sortie} existe et n'est pas un dossier`);
  const attendues = new Set([...CONTENU, '_headers']);
  const etrangeres = readdirSync(sortie).filter((n) => !attendues.has(n));
  if (etrangeres.length) {
    throw new Error(`${sortie} contient des fichiers qui ne viennent pas de la construction (${etrangeres.join(', ')}) : dossier non vide, rien n'est supprime`);
  }
  for (const n of readdirSync(sortie)) rmSync(join(sortie, n), { recursive: true, force: true });
}

/** Construit le site dans `sortie` ; renvoie la liste triee des fichiers produits (chemins relatifs, separateur /). */
export function construire({ sortie = SORTIE_DEFAUT, depot = DEPOT } = {}) {
  const cible = resolve(sortie);
  const source = resolve(depot);
  if (cible === source || source.startsWith(cible + sep)) throw new Error(`sortie ${cible} : ne peut pas contenir le depot`);
  preparerSortie(cible);
  const exclus = EXCLUS.map((e) => resolve(source, ...e.split('/')));
  for (const n of CONTENU) {
    cpSync(join(source, n), join(cible, n), {
      recursive: true,
      filter: (src) => !exclus.some((e) => resolve(src) === e || resolve(src).startsWith(e + sep)),
    });
  }
  writeFileSync(join(cible, '_headers'), texteHeaders());
  return lister(cible);
}

export function lister(dossier, base = dossier) {
  const fichiers = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) fichiers.push(...lister(chemin, base));
    else fichiers.push(relative(base, chemin).split(sep).join('/'));
  }
  return fichiers.sort();
}

export function principal(argv = process.argv.slice(2)) {
  let sortie = SORTIE_DEFAUT;
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] !== '--sortie' || argv[i + 1] === undefined) {
      console.error(`Erreur : option ${argv[i]} inconnue ou sans valeur\nUsage : node outils/construire.mjs [--sortie <dossier>]`);
      return 2;
    }
    sortie = resolve(argv[i + 1]);
  }
  try {
    const fichiers = construire({ sortie });
    console.log(`OK : ${fichiers.length} fichier(s) dans ${relative(process.cwd(), sortie) || sortie}`);
    return 0;
  } catch (e) {
    console.error(`ECHEC : ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = principal();
}
