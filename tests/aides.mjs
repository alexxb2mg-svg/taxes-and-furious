// Aides partagees par les tests (pas un fichier de test).
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembler } from '../js/moteur.js';

export const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DONNEES_DEMO = join(DEPOT, 'tests', 'donnees');
export const DONNEES = join(DEPOT, 'data');
export const TEMOINS = join(DEPOT, 'tests', 'donnees-invalides');
const PREFIXE_TMP = 'fiscfiction-test-';

export function lireJson(racine, rel) {
  return JSON.parse(readFileSync(join(racine, ...rel.split('/')), 'utf8'));
}

/** Charge et assemble un profil d'une racine de donnees (communs/decors.json facultatif). */
export function chargerScenario(racine, id) {
  const tronc = lireJson(racine, 'tronc.json');
  const communs = lireJson(racine, 'communs/personnages.json');
  const decors = existsSync(join(racine, 'communs', 'decors.json')) ? lireJson(racine, 'communs/decors.json') : undefined;
  const profil = lireJson(racine, `profils/${id}/profil.json`);
  const variantes = existsSync(join(racine, 'profils', id, 'variantes.json'))
    ? lireJson(racine, `profils/${id}/variantes.json`)
    : {};
  return { tronc, communs, decors, profil, variantes, scenario: assembler(tronc, profil, variantes, communs, decors) };
}

/** Copie un dossier de donnees dans un dossier temporaire ; renvoie { racine, nettoyer }. */
export function copieTemporaire(source = DONNEES_DEMO) {
  const tmp = mkdtempSync(join(tmpdir(), PREFIXE_TMP));
  const racine = join(tmp, 'donnees');
  cpSync(source, racine, { recursive: true });
  return {
    racine,
    nettoyer() {
      // Garde-fou : ne supprime que le dossier temporaire cree ci-dessus.
      if (basename(tmp).startsWith(PREFIXE_TMP) && resolve(tmp).startsWith(resolve(tmpdir()))) {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  };
}

function atteindre(objet, chemin) {
  let o = objet;
  for (const cle of chemin.slice(0, -1)) {
    if (o[cle] === undefined) o[cle] = {};
    o = o[cle];
  }
  return [o, chemin[chemin.length - 1]];
}

/**
 * Applique les modifications d'un temoin negatif (tests/donnees-invalides/*.json) a une racine.
 * Operations : { fichier, brut } remplace le fichier par un texte ; { fichier, valeur_fichier } par un JSON ;
 * { fichier, chemin, valeur } affecte ; { fichier, chemin, supprimer: true } supprime (element de tableau ou cle) ;
 * { fichier, chemin, repeter: n } ajoute n copies du dernier element du tableau (ids suffixes) ;
 * { fichier, copier: '<chemin relatif au depot>' } remplace le fichier par une copie (images d'essai) ;
 * { fichier, effacer: true } supprime le fichier.
 */
export function appliquerModifs(racine, modifs) {
  for (const m of modifs) {
    const chemin = join(racine, ...m.fichier.split('/'));
    if (m.copier !== undefined) {
      mkdirSync(dirname(chemin), { recursive: true });
      copyFileSync(join(DEPOT, ...m.copier.split('/')), chemin);
      continue;
    }
    if (m.effacer) {
      rmSync(chemin);
      continue;
    }
    if (m.brut !== undefined) {
      writeFileSync(chemin, m.brut);
      continue;
    }
    if (m.valeur_fichier !== undefined) {
      writeFileSync(chemin, `${JSON.stringify(m.valeur_fichier, null, 2)}\n`);
      continue;
    }
    const json = JSON.parse(readFileSync(chemin, 'utf8'));
    const [parent, cle] = atteindre(json, m.chemin);
    if (m.supprimer) {
      if (Array.isArray(parent)) parent.splice(cle, 1);
      else delete parent[cle];
    } else if (m.repeter) {
      const tableau = parent[cle];
      const modele = tableau[tableau.length - 1];
      for (let i = 1; i <= m.repeter; i += 1) {
        const copie = structuredClone(modele);
        if (copie.id) copie.id = `${copie.id}-copie${i}`;
        tableau.push(copie);
      }
    } else {
      parent[cle] = m.valeur;
    }
    writeFileSync(chemin, `${JSON.stringify(json, null, 2)}\n`);
  }
}
