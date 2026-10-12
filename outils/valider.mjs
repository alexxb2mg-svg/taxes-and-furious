#!/usr/bin/env node
// Validateur des donnees de Taxes & Furious (EX-020, EX-002, EX-003, EX-005, EX-052, EX-053, EX-131).
// Usage : node outils/valider.mjs [--racine <dossier>] [--profil <id>] [--sans-couverture] [--exigences-lot4]
// --exigences-lot4 ajoute les regles de profondeur EX-140 a EX-143 (ouverture, tronc habille, 3 ou 4 choix,
// chapitres, fins, nombre de scenes) pour les profils verifies, et EX-142 pour le tronc.
// Code de sortie 0 si valide, 1 sinon ; un message par erreur, en francais, nommant fichier, id et champ.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, normalize, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assembler,
  nouvellePartie,
  JAUGES,
  ROLES_TRONC,
  ROLES_GENERIQUES,
  OPERATEURS,
  ID_FIN_PATIENCE,
  TYPE_DEFAUT,
} from '../js/moteur.js';
import * as modulesTypes from '../js/types/index.js';
import { ANIMATIONS } from '../js/animations.js';

export const RACINE_DEFAUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const ID_MODELE = '_modele';
// Types de scene enregistres dans js/types/index.js (EX-111).
export const TYPES = new Map(Object.values(modulesTypes).map((t) => [t.type, t]));

// Section 2.2 de la spec : liste "Tronc commun" et colonne "References obligatoires" (EX-005).
export const TRONC_OBLIGATOIRES = [
  'R-L47', 'R-L10', 'R-L52', 'R-L169', 'R-L176', 'R-L47A', 'R-1729D',
  'R-L57', 'R-L11', 'R-L59', 'R-1651', 'R-1727', 'R-1729', 'R-L62',
];
export const PROFILS_OBLIGATOIRES = {
  restaurateur: ['R-279-MN', 'R-278-0B-A1', 'R-278', 'R-286', 'R-1770DUO', 'R-L8221-5'],
  influenceuse: ['R-92', 'R-L169', 'R-1729'],
  plombier: ['R-278', 'R-279-0B', 'R-279-0B-3', 'R-278-0BA', 'R-283-2N', 'R-L8221-1', 'R-L8221-5', 'R-L8221-6'],
  consultant: ['R-39-1', 'R-39-4', 'R-1729'],
  coiffeuse: ['R-286', 'R-1770DUO', 'R-L8221-6', 'R-L8221-5', 'R-39-1'],
  galeriste: ['R-238BAB', 'R-39-4', 'R-1729'],
};

// EX-131 : le titre de l'encadre n'est ecrit qu'une fois, par l'interface.
export const LIBELLE_LOI = 'Ce que dit vraiment la loi';
// EX-131 : part maximale des mots d'une explication deja presents dans le resume d'une reference citee.
export const SEUIL_RECOUVREMENT = 0.6;
// EX-140 a EX-143 (option --exigences-lot4).
export const LOT4 = {
  scenesOuverture: [1, 2],
  choixParScene: [3, 4],
  chapitresHorsOuverture: 2,
  finsPropres: 3,
  scenesParcours: [16, 24],
};

const CHAMPS_VARIANTE_SCENE = ['texte', 'choix'];
const CHAMPS_VARIANTE_CHOIX = ['texte', 'reaction'];
const PREFIXES_PARCOURS = { 'tronc:': 'tronc', 'profil:': 'profil' };

// ---------------------------------------------------------------- EX-003

const ESPACES = '[ \\u00a0\\u202f]';
const UNITE = '(%|pour\\s+cent|€|euros?|eur|jours?|mois|ans?)(?![\\p{L}\\p{N}])';
const NOMBRE = `\\d{1,3}(?:${ESPACES}\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?`;
const RE_CHIFFRES = new RegExp(`(?<![\\p{L}\\p{N},.])(${NOMBRE})${ESPACES}?${UNITE}`, 'giu');
// Nombre a point (decimal ou milliers : 19.6, 1.500, 1 500.50) suivi d'une unite :
// RE_CHIFFRES ne l'extrait pas, il serait donc soustrait au controle -> rejete explicitement.
const RE_POINT = new RegExp(`(?<![\\p{L}\\p{N},.])(\\d+(?:(?:[.,]|${ESPACES})\\d+)*)${ESPACES}?${UNITE}`, 'giu');
const LETTRES = 'un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingts?|trente|quarante|cinquante|soixante|cents?|mille';
const RE_LETTRES = new RegExp(`(?<![\\p{L}\\p{N}])(${LETTRES})(?:${ESPACES}|-)+${UNITE}`, 'giu');

function normaliserUnite(u) {
  const x = u.toLowerCase().replace(/\s+/g, ' ');
  if (x === '%' || x === 'pour cent') return '%';
  if (x === '€' || x === 'euro' || x === 'euros' || x === 'eur') return '€';
  if (x === 'jour' || x === 'jours') return 'jours';
  if (x === 'an' || x === 'ans') return 'ans';
  return x;
}

/** Nombres en chiffres suivis d'une unite, normalises en "<nombre> <unite>" (EX-003). */
export function extraireChiffres(texte) {
  const res = [];
  for (const m of String(texte ?? '').matchAll(RE_CHIFFRES)) {
    res.push({ brut: m[0], cle: `${m[1].replace(/[ \u00a0\u202f]/g, '')} ${normaliserUnite(m[2])}` });
  }
  return res;
}

/** Nombres ecrits en lettres suivis d'une unite (interdits dans une explication). */
export function extraireLettres(texte) {
  return [...String(texte ?? '').matchAll(RE_LETTRES)].map((m) => m[0]);
}

/** Nombres ecrits avec un point (decimal ou milliers) suivis d'une unite (interdits, EX-003). */
export function extrairePoints(texte) {
  return [...String(texte ?? '').matchAll(RE_POINT)].filter((m) => m[1].includes('.')).map((m) => m[0]);
}

/**
 * Verifie les chiffres d'une explication contre les `valeur` des references citees.
 * @returns {string[]} problemes (vide si conforme)
 */
export function verifierChiffres(explication, idsReferences, referencesParId) {
  const autorises = new Set();
  for (const id of idsReferences ?? []) {
    for (const v of referencesParId.get(id)?.valeur ?? []) {
      for (const c of extraireChiffres(v)) autorises.add(c.cle);
    }
  }
  const problemes = [];
  for (const c of extraireChiffres(explication)) {
    if (!autorises.has(c.cle)) {
      problemes.push(`chiffre "${c.brut}" absent des valeurs des references citees (${(idsReferences ?? []).join(', ') || 'aucune'})`);
    }
  }
  for (const p of extrairePoints(explication)) {
    problemes.push(`nombre "${p}" : ecrire la virgule decimale et l'espace de milliers (19,6 %, 1 500 €)`);
  }
  for (const l of extraireLettres(explication)) {
    problemes.push(`nombre en lettres "${l}" : ecrire les chiffres d'une explication en chiffres`);
  }
  return problemes;
}

// ---------------------------------------------------------------- EX-131

/** Mots d'au moins 4 lettres, sans casse ni accents (ensemble). */
export function motsSignificatifs(texte) {
  return new Set(String(texte ?? '')
    .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .split(/[^a-z]+/)
    .filter((m) => m.length >= 4));
}

/** Part des mots de l'explication (4 lettres et plus) qui figurent aussi dans le resume. */
export function recouvrement(explication, resume) {
  const mots = motsSignificatifs(explication);
  if (mots.size === 0) return 0;
  const dansResume = motsSignificatifs(resume);
  let communs = 0;
  for (const m of mots) if (dansResume.has(m)) communs += 1;
  return communs / mots.size;
}

/** Explication qui commence par le titre de l'encadre (casse et accents ignores). */
export function commenceParLibelle(explication) {
  const sans = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return sans(explication).trimStart().startsWith(sans(LIBELLE_LOI));
}

// ---------------------------------------------------------------- rapport

class Rapport {
  constructor() {
    this.erreurs = [];
    this.avertissements = [];
  }
  static formater(fichier, contexte, champ, message) {
    const loc = [contexte, champ ? `champ "${champ}"` : null].filter(Boolean).join(', ');
    return loc ? `${fichier} : ${loc} : ${message}` : `${fichier} : ${message}`;
  }
  erreur(fichier, contexte, champ, message) {
    this.erreurs.push(Rapport.formater(fichier, contexte, champ, message));
  }
  avertissement(fichier, contexte, champ, message) {
    this.avertissements.push(Rapport.formater(fichier, contexte, champ, message));
  }
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estTexte = (v) => typeof v === 'string' && v.trim() !== '';

function lireJson(racine, rel, rapport) {
  const chemin = join(racine, ...rel.split('/'));
  if (!existsSync(chemin)) {
    rapport.erreur(rel, null, null, 'fichier introuvable');
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(chemin, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    rapport.erreur(rel, null, null, `JSON invalide (${e.message})`);
    return undefined;
  }
}

function decoderXml(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Portrait present sur disque, dans le dossier : SVG avec role="img" et aria-label = nom (EX-034), ou WebP (EX-152). */
function verifierPortrait(racine, dossierRel, fichier, contexte, personnage, rapport) {
  const portrait = personnage.portrait;
  if (!estTexte(portrait)) {
    rapport.erreur(fichier, contexte, 'portrait', 'portrait obligatoire (chemin d\'un fichier SVG ou WebP du dossier)');
    return;
  }
  if (portrait.toLowerCase().endsWith('.webp')) {
    // Portrait illustre (EX-152) : range dans img/, format et poids controles avec toutes les images (verifierImages).
    if (verifierCheminImage(racine, dossierRel, portrait, fichier, contexte, 'portrait', rapport, 'portrait')
      && !normalize(portrait).split(sep).includes('img')) {
      rapport.erreur(fichier, contexte, 'portrait', `"${portrait}" : un portrait illustre se range dans le dossier img/ (EX-152)`);
    }
    return;
  }
  const rel = normalize(portrait);
  if (isAbsolute(portrait) || rel.startsWith('..') || !portrait.toLowerCase().endsWith('.svg')) {
    rapport.erreur(fichier, contexte, 'portrait', `chemin "${portrait}" invalide (fichier .svg ou .webp relatif au dossier, sans "..")`);
    return;
  }
  const chemin = join(racine, ...dossierRel.split('/'), rel);
  if (!existsSync(chemin) || !statSync(chemin).isFile()) {
    rapport.erreur(fichier, contexte, 'portrait', `fichier "${dossierRel}/${portrait}" introuvable`);
    return;
  }
  const svg = readFileSync(chemin, 'utf8');
  const balise = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!balise) {
    rapport.erreur(fichier, contexte, 'portrait', `"${dossierRel}/${portrait}" n'est pas un SVG`);
    return;
  }
  if (!/\brole\s*=\s*"img"/.test(balise)) {
    rapport.erreur(fichier, contexte, 'portrait', `"${dossierRel}/${portrait}" : attribut role="img" absent de la balise <svg>`);
  }
  const label = balise.match(/\baria-label\s*=\s*"([^"]*)"/)?.[1];
  if (label === undefined || decoderXml(label) !== personnage.nom) {
    rapport.erreur(fichier, contexte, 'portrait',
      `"${dossierRel}/${portrait}" : aria-label ${label === undefined ? 'absent' : `"${decoderXml(label)}" different du nom`} (attendu "${personnage.nom}")`);
  }
}

// ---------------------------------------------------------------- images (EX-150, EX-152, EX-153)

// EX-153 : plafonds de poids et formats (memes valeurs que outils/preparer-images.py).
export const IMAGES = Object.freeze({
  decorMaxOctets: 250 * 1024,
  decorLargeur: Object.freeze([1024, 1600]),
  portraitCote: 512,
  portraitMaxOctets: 80 * 1024,
  illustrationLargeur: 768,
  illustrationHauteur: 1024,
  illustrationMaxOctets: 150 * 1024,
  illustrationSuffixe: '-situation.webp',
  totalMaxOctets: 12 * 1024 * 1024,
  accueilMaxOctets: 2 * 1024 * 1024,
});

/** Un .webp d'un dossier img/ est une illustration en pied (EX-156) s'il se nomme `<perso>-situation.webp`. */
export const estIllustration = (chemin) => typeof chemin === 'string' && chemin.toLowerCase().endsWith(IMAGES.illustrationSuffixe);

/**
 * Dimensions d'un fichier WebP lues dans son en-tete (VP8, VP8L ou VP8X), sans dependance ;
 * null si le contenu n'est pas un WebP.
 * @param {Buffer} b
 * @returns {{ largeur: number, hauteur: number } | null}
 */
export function dimensionsWebp(b) {
  if (!Buffer.isBuffer(b) || b.length < 30) return null;
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const bloc = b.toString('latin1', 12, 16);
  if (bloc === 'VP8X') return { largeur: 1 + b.readUIntLE(24, 3), hauteur: 1 + b.readUIntLE(27, 3) };
  if (bloc === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const v = b.readUInt32LE(21);
    return { largeur: 1 + (v & 0x3fff), hauteur: 1 + ((v >>> 14) & 0x3fff) };
  }
  if (bloc === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { largeur: b.readUInt16LE(26) & 0x3fff, hauteur: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

/**
 * Chemin d'image `.webp` (decor ou portrait illustre) relatif a `dossierRel`, sans "..", present
 * sur disque. Le format et le poids sont controles par verifierImages (tous les .webp du dossier).
 */
function verifierCheminImage(racine, dossierRel, chemin, fichier, contexte, champ, rapport, quoi) {
  if (!estTexte(chemin)) {
    rapport.erreur(fichier, contexte, champ, `chemin du ${quoi} attendu (fichier .webp relatif a ${dossierRel}/)`);
    return false;
  }
  const rel = normalize(chemin);
  if (isAbsolute(chemin) || rel.startsWith('..') || /^[a-z]+:/i.test(chemin)) {
    rapport.erreur(fichier, contexte, champ, `chemin "${chemin}" invalide (relatif a ${dossierRel}/, sans "..")`);
    return false;
  }
  if (!chemin.toLowerCase().endsWith('.webp')) {
    rapport.erreur(fichier, contexte, champ, `"${chemin}" : extension .webp attendue pour un ${quoi} (EX-150, EX-152)`);
    return false;
  }
  const absolu = join(racine, ...dossierRel.split('/'), rel);
  if (!existsSync(absolu) || !statSync(absolu).isFile()) {
    rapport.erreur(fichier, contexte, champ, `fichier "${dossierRel}/${chemin}" introuvable`);
    return false;
  }
  return true;
}

/** Decor (EX-150) : chemin .webp present, range dans un dossier decors/ relatif a `dossierRel`. */
function verifierDecor(racine, dossierRel, chemin, fichier, contexte, champ, rapport) {
  if (!verifierCheminImage(racine, dossierRel, chemin, fichier, contexte, champ, rapport, 'decor')) return false;
  if (!normalize(chemin).split(sep).includes('decors')) {
    rapport.erreur(fichier, contexte, champ, `"${chemin}" : un decor se range dans le dossier decors/ (EX-150)`);
    return false;
  }
  return true;
}

function fichiersWebp(dossier, rel = '') {
  const liste = [];
  for (const n of readdirSync(join(dossier, rel))) {
    const r = rel ? `${rel}/${n}` : n;
    const st = statSync(join(dossier, r));
    if (st.isDirectory()) liste.push(...fichiersWebp(dossier, r));
    else if (n.toLowerCase().endsWith('.webp')) liste.push({ rel: r, octets: st.size });
  }
  return liste;
}

/**
 * EX-152 / EX-153 sur tous les .webp du dossier de donnees : un fichier d'un dossier `decors/` est un
 * decor (<= 250 Ko, 1024 a 1600 px de large) ; d'un dossier `img/`, une illustration en pied s'il se
 * nomme `<perso>-situation.webp` (768x1024 px, <= 150 Ko), un portrait sinon (carre 512 px, <= 80 Ko) ;
 * total <= 12 Mo.
 */
function verifierImages(racine, rapport) {
  const {
    decorMaxOctets, decorLargeur: [lmin, lmax], portraitCote, portraitMaxOctets,
    illustrationLargeur, illustrationHauteur, illustrationMaxOctets, totalMaxOctets,
  } = IMAGES;
  let total = 0;
  for (const { rel, octets } of fichiersWebp(racine)) {
    total += octets;
    const dossiers = rel.split('/').slice(0, -1);
    const decor = dossiers.includes('decors');
    const portrait = !decor && dossiers.includes('img');
    if (!decor && !portrait) continue;
    const dim = dimensionsWebp(readFileSync(join(racine, ...rel.split('/'))));
    if (!dim) {
      rapport.erreur(rel, null, null, 'contenu illisible : ce n\'est pas un fichier WebP');
      continue;
    }
    const ko = (n) => `${Math.ceil(n / 1024)} Ko`;
    if (decor) {
      if (octets > decorMaxOctets) rapport.erreur(rel, null, null, `decor de ${ko(octets)} : plafond ${ko(decorMaxOctets)} (EX-153)`);
      if (dim.largeur < lmin || dim.largeur > lmax) rapport.erreur(rel, null, null, `decor de ${dim.largeur} px de large : de ${lmin} a ${lmax} px (EX-153)`);
    } else if (estIllustration(rel)) {
      if (octets > illustrationMaxOctets) {
        rapport.erreur(rel, null, null, `illustration de ${ko(octets)} : plafond ${ko(illustrationMaxOctets)} (EX-153)`);
      }
      if (dim.largeur !== illustrationLargeur || dim.hauteur !== illustrationHauteur) {
        rapport.erreur(rel, null, null,
          `illustration de ${dim.largeur}x${dim.hauteur} px : ${illustrationLargeur}x${illustrationHauteur} attendu (EX-156)`);
      }
    } else {
      if (octets > portraitMaxOctets) rapport.erreur(rel, null, null, `portrait de ${ko(octets)} : plafond ${ko(portraitMaxOctets)} (EX-153)`);
      if (dim.largeur !== portraitCote || dim.hauteur !== portraitCote) {
        rapport.erreur(rel, null, null, `portrait de ${dim.largeur}x${dim.hauteur} px : carre ${portraitCote}x${portraitCote} attendu (EX-152)`);
      }
    }
  }
  if (total > totalMaxOctets) {
    rapport.erreur('**/*.webp', null, null, `${(total / 1024 / 1024).toFixed(2)} Mo d'images WebP au total : plafond ${totalMaxOctets / 1024 / 1024} Mo (EX-153)`);
  }
}

/** communs/decors.json (EX-150, facultatif) : { "chapitres": { "<id tronc>": "decors/x.webp" }, "titre": "decors/y.webp" | null }. */
function verifierDecorsCommuns(racine, decors, tronc, rapport) {
  const F = 'communs/decors.json';
  if (!estObjet(decors)) {
    rapport.erreur(F, null, null, 'objet { "chapitres": { ... }, "titre": ... } attendu');
    return;
  }
  for (const cle of Object.keys(decors)) {
    if (!['chapitres', 'titre'].includes(cle)) rapport.erreur(F, null, cle, 'cle inconnue (chapitres, titre)');
  }
  if (decors.titre !== undefined && decors.titre !== null) verifierDecor(racine, 'communs', decors.titre, F, null, 'titre', rapport);
  if (decors.chapitres === undefined) return;
  if (!estObjet(decors.chapitres)) {
    rapport.erreur(F, null, 'chapitres', 'objet { "<id chapitre du tronc>": "decors/<fichier>.webp" } attendu');
    return;
  }
  const chTronc = new Set((estObjet(tronc) && Array.isArray(tronc.chapitres) ? tronc.chapitres : []).map((c) => c?.id));
  for (const [id, chemin] of Object.entries(decors.chapitres)) {
    if (!chTronc.has(id)) rapport.erreur(F, `chapitre "${id}"`, 'chapitres', 'chapitre inconnu du tronc');
    verifierDecor(racine, 'communs', chemin, F, `chapitre "${id}"`, 'chapitres', rapport);
  }
}

/** `decor` facultatif des scenes d'un fichier (EX-150), relatif a `dossierRel`. */
function verifierDecorsScenes(racine, dossierRel, chapitres, fichier, rapport) {
  for (const s of idsScenes(chapitres)) {
    if (s.decor !== undefined) verifierDecor(racine, dossierRel, s.decor, fichier, `scene "${s.id}"`, 'decor', rapport);
  }
}

/** `decors` d'un profil (EX-150) : { "<id chapitre du tronc ou du profil>": "decors/<fichier>.webp" }. */
function verifierDecorsProfil(racine, id, profil, tronc, F, rapport) {
  if (profil.decors === undefined) return;
  if (!estObjet(profil.decors)) {
    rapport.erreur(F, null, 'decors', 'objet { "<id chapitre>": "decors/<fichier>.webp" } attendu');
    return;
  }
  const chTronc = new Set((estObjet(tronc) && Array.isArray(tronc.chapitres) ? tronc.chapitres : []).map((c) => c?.id));
  const chProfil = new Set((Array.isArray(profil.chapitres) ? profil.chapitres : []).map((c) => c?.id));
  for (const [ch, chemin] of Object.entries(profil.decors)) {
    const ctx = `decor du chapitre "${ch}"`;
    if (!chTronc.has(ch) && !chProfil.has(ch)) {
      rapport.erreur(F, ctx, 'decors', 'chapitre inconnu (id d\'un chapitre du tronc ou du profil)');
    } else if (chTronc.has(ch) && chProfil.has(ch)) {
      rapport.erreur(F, ctx, 'decors', 'id porte a la fois par un chapitre du tronc et du profil : decor ambigu');
    }
    verifierDecor(racine, `profils/${id}`, chemin, F, ctx, 'decors', rapport);
  }
}

function verifierJauges(jauges, fichier, contexte, rapport) {
  if (jauges === undefined) return;
  if (!estObjet(jauges)) {
    rapport.erreur(fichier, contexte, 'jauges_initiales', 'objet attendu');
    return;
  }
  for (const [j, v] of Object.entries(jauges)) {
    if (!JAUGES.includes(j)) {
      rapport.erreur(fichier, contexte, 'jauges_initiales', `jauge "${j}" inconnue (attendu : ${JAUGES.join(', ')})`);
    } else if (!Number.isInteger(v) || v < 0 || (j !== 'redressement' && v > 100)) {
      rapport.erreur(fichier, contexte, 'jauges_initiales', `valeur de "${j}" invalide (${JSON.stringify(v)}) : entier ${j === 'redressement' ? '>= 0' : 'de 0 a 100'}`);
    }
  }
}

function verifierReferences(liste, fichier, contexte, champ, refs, rapport) {
  if (!Array.isArray(liste)) {
    rapport.erreur(fichier, contexte, champ, 'tableau d\'identifiants de references attendu');
    return [];
  }
  const ok = [];
  for (const id of liste) {
    if (!refs.has(id)) rapport.erreur(fichier, contexte, champ, `reference "${id}" inconnue de references.json`);
    else ok.push(id);
  }
  return ok;
}

// ---------------------------------------------------------------- scenes et chapitres

/** Choix d'une scene `choix`, ou issues d'une scene d'un autre type (tableaux d'objets). */
function sortiesScene(scene) {
  const liste = (scene?.type ?? TYPE_DEFAUT) === TYPE_DEFAUT ? scene?.choix : scene?.issues;
  return Array.isArray(liste) ? liste : [];
}

function verifierAnimation(valeur, fichier, ctx, rapport) {
  if (valeur === undefined) return;
  if (typeof valeur !== 'string' || !Object.hasOwn(ANIMATIONS, valeur)) {
    rapport.erreur(fichier, ctx, 'animation', `animation ${JSON.stringify(valeur)} inconnue (animations de js/animations.js : ${Object.keys(ANIMATIONS).join(', ')})`);
  }
}

/** Conditions `si` d'une issue (EX-110) : [ { "op": ">=", "valeur": 3 } ], "champ" facultatif. */
function verifierSi(si, fichier, ctx, rapport) {
  if (si === undefined) return;
  if (!Array.isArray(si)) {
    rapport.erreur(fichier, ctx, 'si', 'tableau de conditions attendu, ex. [ { "op": ">=", "valeur": 3 } ] (vide = sans condition)');
    return;
  }
  for (const c of si) {
    if (!estObjet(c) || !OPERATEURS.includes(c.op)) {
      rapport.erreur(fichier, ctx, 'si', `operateur ${JSON.stringify(c?.op)} inconnu (attendu : ${OPERATEURS.join(' ')})`);
    } else if (!['number', 'string', 'boolean'].includes(typeof c.valeur) || (typeof c.valeur === 'number' && !Number.isFinite(c.valeur))) {
      rapport.erreur(fichier, ctx, 'si', `valeur ${JSON.stringify(c.valeur)} invalide (nombre, texte ou booleen)`);
    } else if (c.champ !== undefined && !estTexte(c.champ)) {
      rapport.erreur(fichier, ctx, 'si', '"champ" doit etre un texte (champ du resultat compare)');
    }
    for (const cle of Object.keys(estObjet(c) ? c : {})) {
      if (!['op', 'valeur', 'champ'].includes(cle)) rapport.erreur(fichier, ctx, 'si', `cle "${cle}" inconnue dans une condition (op, valeur, champ)`);
    }
  }
}

/** Choix d'une scene `choix`, ou issue d'une scene d'un autre type (memes regles, EX-110). */
function verifierChoix(choix, fichier, ctxScene, refs, rapport, issue = false) {
  const quoi = issue ? 'issue' : 'choix';
  const ctx = `${ctxScene}, ${quoi} "${choix?.id ?? '?'}"`;
  if (!estObjet(choix)) {
    rapport.erreur(fichier, ctxScene, issue ? 'issues' : 'choix', `chaque ${quoi} doit etre un objet`);
    return;
  }
  if (!estTexte(choix.id)) rapport.erreur(fichier, ctx, 'id', 'identifiant obligatoire');
  for (const champ of issue ? ['reaction', 'explication'] : ['texte', 'reaction', 'explication']) {
    if (!estTexte(choix[champ])) rapport.erreur(fichier, ctx, champ, 'texte obligatoire');
  }
  if (issue && choix.texte !== undefined && !estTexte(choix.texte)) rapport.erreur(fichier, ctx, 'texte', 'texte non vide attendu (facultatif)');
  if (issue) verifierSi(choix.si, fichier, ctx, rapport);
  else if (choix.si !== undefined) rapport.erreur(fichier, ctx, 'si', 'reserve aux issues des scenes d\'un autre type que "choix"');
  verifierAnimation(choix.animation, fichier, ctx, rapport);
  if (typeof choix.juste !== 'boolean') rapport.erreur(fichier, ctx, 'juste', 'booleen obligatoire (true ou false)');
  if (!estObjet(choix.effets)) {
    rapport.erreur(fichier, ctx, 'effets', 'objet obligatoire, ex. { "redressement": 0, "patience": 5, "stress": -10 }');
  } else {
    for (const [j, v] of Object.entries(choix.effets)) {
      if (!JAUGES.includes(j)) rapport.erreur(fichier, ctx, 'effets', `jauge "${j}" inconnue (attendu : ${JAUGES.join(', ')})`);
      else if (!Number.isInteger(v)) rapport.erreur(fichier, ctx, 'effets', `delta de "${j}" non entier (${JSON.stringify(v)})`);
    }
  }
  if (!(choix.suivant === null || estTexte(choix.suivant))) {
    rapport.erreur(fichier, ctx, 'suivant', 'id de scene du meme chapitre ou null attendu');
  }
  const cites = verifierReferences(choix.references, fichier, ctx, 'references', refs, rapport);
  if (estTexte(choix.explication)) {
    for (const p of verifierChiffres(choix.explication, cites, refs)) rapport.erreur(fichier, ctx, 'explication', p);
    // EX-131 : le titre de l'encadre est affiche par l'interface, pas repete dans l'explication.
    if (commenceParLibelle(choix.explication)) {
      rapport.erreur(fichier, ctx, 'explication', `commence par "${LIBELLE_LOI}" : ce titre est deja celui de l'encadre, l'explication commence directement par le cas joue`);
    }
    // EX-131 : l'explication dit ce qui s'applique au cas joue, sans recopier le resume affiche dessous.
    for (const id of cites) {
      const part = recouvrement(choix.explication, refs.get(id)?.resume);
      if (part > SEUIL_RECOUVREMENT) {
        rapport.avertissement(fichier, ctx, 'explication',
          `${Math.round(part * 100)} % de ses mots figurent dans le resume de ${id} (seuil ${Math.round(SEUIL_RECOUVREMENT * 100)} %) : dire ce qui s'applique au cas joue plutot que repeter l'article`);
      }
    }
  }
}

function verifierScene(scene, fichier, ctxChap, personnageValide, refs, rapport, existe) {
  if (!estObjet(scene)) {
    rapport.erreur(fichier, ctxChap, 'scenes', 'chaque scene doit etre un objet');
    return false;
  }
  const ctx = `scene "${scene.id ?? '?'}"`;
  if (!estTexte(scene.id)) rapport.erreur(fichier, `${ctxChap}, ${ctx}`, 'id', 'identifiant obligatoire');
  if (!estTexte(scene.texte)) rapport.erreur(fichier, ctx, 'texte', 'texte obligatoire');
  const msgPerso = personnageValide(scene.personnage);
  if (msgPerso) rapport.erreur(fichier, ctx, 'personnage', msgPerso);
  verifierAnimation(scene.animation, fichier, ctx, rapport);

  // Type de scene (EX-110, EX-111) : "choix" par defaut, sinon un type de js/types/index.js.
  const type = scene.type ?? TYPE_DEFAUT;
  const module = typeof type === 'string' ? TYPES.get(type) : undefined;
  if (!module) {
    rapport.erreur(fichier, ctx, 'type', `type ${JSON.stringify(type)} inconnu (types enregistres dans js/types/index.js : ${[...TYPES.keys()].join(', ')})`);
  } else {
    for (const p of module.validerParametres(scene.parametres, { existe })) rapport.erreur(fichier, ctx, 'parametres', p);
  }

  if (type !== TYPE_DEFAUT) {
    if (scene.choix !== undefined) rapport.erreur(fichier, ctx, 'choix', `une scene de type "${type}" n'a pas de choix : ses issues sont dans "issues"`);
    if (!Array.isArray(scene.issues) || scene.issues.length === 0) {
      rapport.erreur(fichier, ctx, 'issues', 'tableau d\'issues obligatoire, la derniere sans condition "si"');
      return false;
    }
    const derniere = scene.issues[scene.issues.length - 1];
    if (estObjet(derniere) && Array.isArray(derniere.si) ? derniere.si.length > 0 : derniere?.si !== undefined) {
      rapport.erreur(fichier, ctx, 'issues', `la derniere issue ("${derniere?.id ?? '?'}") doit etre sans condition "si" : une issue est toujours trouvee`);
    }
    if (!scene.issues.some((c) => c?.juste === true)) {
      rapport.erreur(fichier, ctx, 'issues', 'aucune issue "juste" : il en faut au moins une');
    }
    for (const c of scene.issues) verifierChoix(c, fichier, ctx, refs, rapport, true);
    return true;
  }

  if (scene.issues !== undefined) rapport.erreur(fichier, ctx, 'issues', 'reserve aux scenes d\'un autre type que "choix"');
  if (!Array.isArray(scene.choix)) {
    rapport.erreur(fichier, ctx, 'choix', 'tableau de 2 a 4 choix obligatoire');
    return false;
  }
  if (scene.choix.length < 2 || scene.choix.length > 4) {
    rapport.erreur(fichier, ctx, 'choix', `${scene.choix.length} choix : il en faut de 2 a 4`);
  }
  if (!scene.choix.some((c) => c?.juste === true)) {
    rapport.erreur(fichier, ctx, 'choix', 'aucun choix "juste" : il en faut au moins un');
  }
  for (const c of scene.choix) verifierChoix(c, fichier, ctx, refs, rapport);
  return true;
}

/** Chapitre : scenes, suivant valides, pas de cycle, tout atteignable depuis la scene d'entree. */
function verifierChapitre(chap, fichier, personnageValide, refs, rapport, existe) {
  if (!estObjet(chap)) {
    rapport.erreur(fichier, null, 'chapitres', 'chaque chapitre doit etre un objet');
    return;
  }
  const ctxChap = `chapitre "${chap.id ?? '?'}"`;
  if (!estTexte(chap.id)) rapport.erreur(fichier, ctxChap, 'id', 'identifiant obligatoire');
  if (!estTexte(chap.titre)) rapport.erreur(fichier, ctxChap, 'titre', 'titre obligatoire');
  if (!Array.isArray(chap.scenes) || chap.scenes.length === 0) {
    rapport.erreur(fichier, ctxChap, 'scenes', 'au moins une scene obligatoire');
    return;
  }
  const scenes = new Map();
  for (const s of chap.scenes) {
    if (verifierScene(s, fichier, ctxChap, personnageValide, refs, rapport, existe) && estTexte(s.id)) scenes.set(s.id, s);
  }
  // suivant
  const voisins = new Map();
  for (const s of scenes.values()) {
    const v = [];
    for (const c of sortiesScene(s)) {
      if (!estObjet(c) || !estTexte(c.suivant)) continue;
      if (!scenes.has(c.suivant)) {
        rapport.erreur(fichier, `scene "${s.id}"`, 'suivant', `scene "${c.suivant}" introuvable dans le ${ctxChap} (choix "${c.id}")`);
      } else {
        v.push(c.suivant);
      }
    }
    voisins.set(s.id, v);
  }
  // cycles et atteignabilite depuis la scene d'entree (premiere du tableau)
  const entree = chap.scenes[0]?.id;
  if (!scenes.has(entree)) return;
  const etat = new Map(); // 1 = en cours, 2 = fini
  const cycles = new Set();
  const visiter = (id) => {
    etat.set(id, 1);
    for (const n of voisins.get(id) ?? []) {
      if (etat.get(n) === 1) cycles.add(n);
      else if (!etat.has(n)) visiter(n);
    }
    etat.set(id, 2);
  };
  visiter(entree);
  for (const id of cycles) {
    rapport.erreur(fichier, `${ctxChap}, scene "${id}"`, 'suivant', 'cycle : un chemin de "suivant" revient sur cette scene au lieu d\'aboutir a null');
  }
  for (const id of scenes.keys()) {
    if (!etat.has(id)) rapport.erreur(fichier, `${ctxChap}, scene "${id}"`, null, `scene inatteignable depuis la scene d'entree "${entree}"`);
  }
}

function verifierFins(fins, fichier, rapport) {
  if (!Array.isArray(fins)) {
    rapport.erreur(fichier, null, 'fins', 'tableau de fins obligatoire');
    return [];
  }
  for (const f of fins) {
    if (!estObjet(f)) {
      rapport.erreur(fichier, null, 'fins', 'chaque fin doit etre un objet');
      continue;
    }
    const ctx = `fin "${f.id ?? '?'}"`;
    if (!estTexte(f.id)) rapport.erreur(fichier, ctx, 'id', 'identifiant obligatoire');
    if (!estTexte(f.titre)) rapport.erreur(fichier, ctx, 'titre', 'titre obligatoire');
    if (!estTexte(f.texte)) rapport.erreur(fichier, ctx, 'texte', 'texte obligatoire');
    if (!Array.isArray(f.conditions)) {
      rapport.erreur(fichier, ctx, 'conditions', 'tableau obligatoire (vide = sans condition)');
      continue;
    }
    for (const c of f.conditions) {
      if (!estObjet(c) || !JAUGES.includes(c.jauge)) {
        rapport.erreur(fichier, ctx, 'conditions', `jauge ${JSON.stringify(c?.jauge)} inconnue (attendu : ${JAUGES.join(', ')})`);
      } else if (!OPERATEURS.includes(c.op)) {
        rapport.erreur(fichier, ctx, 'conditions', `operateur ${JSON.stringify(c.op)} inconnu (attendu : ${OPERATEURS.join(' ')})`);
      } else if (typeof c.valeur !== 'number' || !Number.isFinite(c.valeur)) {
        rapport.erreur(fichier, ctx, 'conditions', `valeur ${JSON.stringify(c.valeur)} non numerique`);
      }
    }
  }
  return fins.filter(estObjet);
}

function signalerDoublons(liste, fichier, quoi, rapport, contexte = null) {
  const vus = new Set();
  for (const id of liste) {
    if (vus.has(id)) rapport.erreur(fichier, contexte, 'id', `${quoi} "${id}" en double`);
    vus.add(id);
  }
}

const idsScenes = (chapitres) => (Array.isArray(chapitres) ? chapitres : [])
  .flatMap((c) => (Array.isArray(c?.scenes) ? c.scenes : []))
  .filter((s) => estTexte(s?.id));
const idsChoix = (chapitres) => idsScenes(chapitres)
  .flatMap(sortiesScene)
  .filter((c) => estTexte(c?.id))
  .map((c) => c.id);
const referencesCitees = (chapitres) => new Set(idsScenes(chapitres)
  .flatMap(sortiesScene)
  .flatMap((c) => (Array.isArray(c?.references) ? c.references : [])));

// ---------------------------------------------------------------- tronc, communs, index

function verifierTronc(tronc, refs, rapport, racine) {
  const F = 'tronc.json';
  if (!estObjet(tronc)) {
    rapport.erreur(F, null, null, 'objet JSON attendu');
    return;
  }
  if (!estTexte(tronc.titre)) rapport.erreur(F, null, 'titre', 'titre obligatoire');
  verifierJauges(tronc.jauges_initiales, F, null, rapport);
  verifierReferences(tronc.references_obligatoires, F, null, 'references_obligatoires', refs, rapport);
  if (!Array.isArray(tronc.chapitres) || tronc.chapitres.length === 0) {
    rapport.erreur(F, null, 'chapitres', 'au moins un chapitre obligatoire');
  } else {
    const roleValide = (r) => (ROLES_TRONC.includes(r) ? null : `role "${r}" inconnu (attendu : ${ROLES_TRONC.join(', ')})`);
    for (const ch of tronc.chapitres) verifierChapitre(ch, F, roleValide, refs, rapport, (rel) => existsSync(join(racine, ...rel.split('/'))));
    // EX-150 : decor d'une scene du tronc, relatif a communs/ (comme communs/decors.json).
    verifierDecorsScenes(racine, 'communs', tronc.chapitres, F, rapport);
    signalerDoublons(tronc.chapitres.filter(estObjet).map((c) => c.id), F, 'chapitre', rapport);
    signalerDoublons(idsScenes(tronc.chapitres).map((s) => s.id), F, 'scene', rapport);
    signalerDoublons(idsChoix(tronc.chapitres), F, 'choix', rapport);
  }
  const fins = verifierFins(tronc.fins, F, rapport);
  signalerDoublons(fins.map((f) => f.id), F, 'fin', rapport);
  const fp = fins.find((f) => f.id === ID_FIN_PATIENCE);
  if (!fp) {
    rapport.erreur(F, null, 'fins', `fin commune "${ID_FIN_PATIENCE}" absente`);
  } else {
    const c = fp.conditions;
    const ok = Array.isArray(c) && c.length === 1 && c[0]?.jauge === 'patience' && c[0]?.op === '<=' && c[0]?.valeur === 0;
    if (!ok) rapport.erreur(F, `fin "${ID_FIN_PATIENCE}"`, 'conditions', 'doit etre exactement [ { "jauge": "patience", "op": "<=", "valeur": 0 } ]');
  }
  const normales = fins.filter((f) => f.id !== ID_FIN_PATIENCE);
  if (normales.length === 0) {
    rapport.erreur(F, null, 'fins', `aucune fin commune hors "${ID_FIN_PATIENCE}" : il faut une fin par defaut sans condition`);
  } else {
    const derniere = normales[normales.length - 1];
    if (!Array.isArray(derniere.conditions) || derniere.conditions.length > 0) {
      rapport.erreur(F, `fin "${derniere.id}"`, 'conditions', 'la derniere fin commune doit etre sans condition (fin par defaut)');
    }
  }
}

function verifierCouvertureTronc(tronc, rapport) {
  const F = 'tronc.json';
  if (!estObjet(tronc)) return;
  const declarees = Array.isArray(tronc.references_obligatoires) ? tronc.references_obligatoires : [];
  const manquantes = TRONC_OBLIGATOIRES.filter((r) => !declarees.includes(r));
  const enTrop = declarees.filter((r) => !TRONC_OBLIGATOIRES.includes(r));
  if (manquantes.length || enTrop.length) {
    rapport.erreur(F, null, 'references_obligatoires',
      `different de la liste "Tronc commun" de la spec (2.2)${manquantes.length ? ` ; manquantes : ${manquantes.join(', ')}` : ''}${enTrop.length ? ` ; en trop : ${enTrop.join(', ')}` : ''}`);
  }
  const cites = referencesCitees(tronc.chapitres);
  const nonCitees = declarees.filter((r) => !cites.has(r));
  if (nonCitees.length) rapport.erreur(F, null, 'references_obligatoires', `references non citees par les chapitres du tronc : ${nonCitees.join(', ')}`);
  const ch = Array.isArray(tronc.chapitres) ? tronc.chapitres : [];
  if (ch.length !== 3) rapport.erreur(F, null, 'chapitres', `${ch.length} chapitre(s) : le tronc en compte 3`);
  for (const c of ch) {
    const n = Array.isArray(c?.scenes) ? c.scenes.length : 0;
    if (n < 3 || n > 6) rapport.erreur(F, `chapitre "${c?.id}"`, 'scenes', `${n} scene(s) : il en faut de 3 a 6`);
  }
}

function verifierCommuns(racine, communs, rapport) {
  const F = 'communs/personnages.json';
  if (communs === undefined) return;
  if (!estObjet(communs) || !Array.isArray(communs.personnages)) {
    rapport.erreur(F, null, 'personnages', 'objet { "personnages": [ ... ] } attendu');
    return;
  }
  for (const role of ROLES_GENERIQUES) {
    const p = communs.personnages.find((x) => x?.role === role);
    if (!p) {
      rapport.erreur(F, null, 'personnages', `personnage generique de role "${role}" absent`);
      continue;
    }
    const ctx = `personnage "${p.id ?? role}"`;
    if (!estTexte(p.nom)) rapport.erreur(F, ctx, 'nom', 'nom obligatoire');
    else verifierPortrait(racine, 'communs', F, ctx, p, rapport);
  }
}

function lireIndex(racine, rapport) {
  const F = 'profils/index.json';
  const index = lireJson(racine, F, rapport);
  if (index === undefined) return [];
  if (!Array.isArray(index) || !index.every((x) => typeof x === 'string' && x !== '')) {
    rapport.erreur(F, null, null, 'tableau d\'identifiants de profils attendu, ex. ["restaurateur", "plombier"]');
    return [];
  }
  signalerDoublons(index, F, 'profil', rapport);
  const dossierProfils = join(racine, 'profils');
  const dossiers = existsSync(dossierProfils)
    ? readdirSync(dossierProfils).filter((n) => statSync(join(dossierProfils, n)).isDirectory())
    : [];
  for (const id of index) {
    if (id === ID_MODELE) rapport.erreur(F, null, null, `"${ID_MODELE}" est le modele : il ne doit pas figurer dans l'index`);
    else if (!dossiers.includes(id)) rapport.erreur(F, null, null, `profil "${id}" sans dossier profils/${id}/`);
  }
  for (const d of dossiers) {
    if (d !== ID_MODELE && !index.includes(d)) {
      rapport.avertissement(`profils/${d}/`, null, null, 'dossier absent de profils/index.json : profil ignore par le jeu');
    }
  }
  return [...new Set(index)].filter((id) => id !== ID_MODELE && dossiers.includes(id));
}

// ---------------------------------------------------------------- profil

function verifierVariantes(variantes, F, tronc, rapport) {
  if (!estObjet(variantes)) {
    rapport.erreur(F, null, null, 'objet { "<id scene du tronc>": { ... } } attendu');
    return;
  }
  const scenesTronc = new Map(idsScenes(tronc?.chapitres).map((s) => [s.id, s]));
  for (const [idScene, v] of Object.entries(variantes)) {
    const ctx = `scene "${idScene}"`;
    const scene = scenesTronc.get(idScene);
    if (!scene) {
      rapport.erreur(F, ctx, null, 'variante d\'une scene inconnue du tronc');
      continue;
    }
    if (!estObjet(v)) {
      rapport.erreur(F, ctx, null, 'objet { "texte": ..., "choix": { ... } } attendu');
      continue;
    }
    for (const champ of Object.keys(v)) {
      if (!CHAMPS_VARIANTE_SCENE.includes(champ)) {
        rapport.erreur(F, ctx, champ, `non surchargeable par une variante (seuls ${CHAMPS_VARIANTE_SCENE.join(' et ')})`);
      }
    }
    if (v.texte !== undefined && !estTexte(v.texte)) rapport.erreur(F, ctx, 'texte', 'texte non vide attendu');
    if (v.choix === undefined) continue;
    if (!estObjet(v.choix)) {
      rapport.erreur(F, ctx, 'choix', 'objet { "<id choix>": { "texte": ..., "reaction": ... } } attendu');
      continue;
    }
    const choixTronc = new Set((scene.choix ?? []).map((c) => c?.id));
    for (const [idChoix, vc] of Object.entries(v.choix)) {
      const ctxC = `${ctx}, choix "${idChoix}"`;
      if (!choixTronc.has(idChoix)) {
        rapport.erreur(F, ctxC, null, `choix inconnu de la scene "${idScene}" du tronc`);
        continue;
      }
      if (!estObjet(vc)) {
        rapport.erreur(F, ctxC, null, 'objet { "texte": ..., "reaction": ... } attendu');
        continue;
      }
      for (const [champ, val] of Object.entries(vc)) {
        if (!CHAMPS_VARIANTE_CHOIX.includes(champ)) {
          rapport.erreur(F, ctxC, champ, `non surchargeable par une variante (seuls ${CHAMPS_VARIANTE_CHOIX.join(' et ')} ; la loi ne change pas selon le metier)`);
        } else if (!estTexte(val)) {
          rapport.erreur(F, ctxC, champ, 'texte non vide attendu');
        }
      }
    }
  }
}

function verifierParcours(profil, F, tronc, rapport) {
  const parcours = profil.parcours;
  if (!Array.isArray(parcours) || parcours.length === 0) {
    rapport.erreur(F, null, 'parcours', 'tableau obligatoire, ex. ["tronc:avis", "profil:metier", "tronc:fec", "tronc:rectification"]');
    return;
  }
  const chTronc = (Array.isArray(tronc?.chapitres) ? tronc.chapitres : []).map((c) => c?.id);
  const chProfil = (Array.isArray(profil.chapitres) ? profil.chapitres : []).map((c) => c?.id);
  const vusTronc = [];
  const vus = new Set();
  for (const entree of parcours) {
    const prefixe = Object.keys(PREFIXES_PARCOURS).find((p) => typeof entree === 'string' && entree.startsWith(p));
    if (!prefixe) {
      rapport.erreur(F, null, 'parcours', `entree ${JSON.stringify(entree)} invalide (attendu "tronc:<id>" ou "profil:<id>")`);
      continue;
    }
    if (vus.has(entree)) rapport.erreur(F, null, 'parcours', `chapitre "${entree}" en double`);
    vus.add(entree);
    const id = entree.slice(prefixe.length);
    if (PREFIXES_PARCOURS[prefixe] === 'tronc') {
      if (!chTronc.includes(id)) rapport.erreur(F, null, 'parcours', `chapitre "${entree}" inconnu du tronc`);
      else vusTronc.push(id);
    } else if (!chProfil.includes(id)) {
      rapport.erreur(F, null, 'parcours', `chapitre "${entree}" absent des chapitres du profil`);
    }
  }
  for (const id of chTronc) {
    if (!vusTronc.includes(id)) rapport.erreur(F, null, 'parcours', `chapitre du tronc "tronc:${id}" absent du parcours`);
  }
  const ordre = [...new Set(vusTronc)];
  const attendu = chTronc.filter((id) => ordre.includes(id));
  if (ordre.join('|') !== attendu.join('|')) {
    rapport.erreur(F, null, 'parcours', `chapitres du tronc dans le desordre (${ordre.join(', ')}) : ordre attendu ${chTronc.join(', ')}`);
  }
  for (const id of chProfil) {
    if (estTexte(id) && !vus.has(`profil:${id}`)) {
      rapport.avertissement(F, `chapitre "${id}"`, null, 'chapitre du profil absent du parcours : il ne sera jamais joue');
    }
  }
}

// ---------------------------------------------------------------- lot 4 (EX-140 a EX-143)

const cleEffets = (c) => JAUGES.map((j) => Number(c?.effets?.[j]) || 0).join('|');

/** EX-142 : scenes `choix` a 3 ou 4 choix, au moins un mauvais reflexe, effets deux a deux differents. */
function verifierProfondeurScenes(chapitres, fichier, rapport) {
  const [min, max] = LOT4.choixParScene;
  for (const s of idsScenes(chapitres)) {
    if ((s.type ?? TYPE_DEFAUT) !== TYPE_DEFAUT || !Array.isArray(s.choix)) continue;
    const ctx = `scene "${s.id}"`;
    if (s.choix.length < min || s.choix.length > max) {
      rapport.erreur(fichier, ctx, 'choix', `${s.choix.length} choix : il en faut ${min} ou ${max} (EX-142)`);
    }
    if (!s.choix.some((c) => c?.juste === false)) {
      rapport.erreur(fichier, ctx, 'choix', 'aucun mauvais reflexe ("juste": false) : il en faut au moins un (EX-142)');
    }
    const vus = new Map();
    for (const c of s.choix) {
      const cle = cleEffets(c);
      if (vus.has(cle)) {
        rapport.erreur(fichier, `${ctx}, choix "${c?.id ?? '?'}"`, 'effets', `effets identiques a ceux du choix "${vus.get(cle)}" : chaque choix d'une scene a ses propres effets (EX-142)`);
      } else {
        vus.set(cle, c?.id ?? '?');
      }
    }
  }
}

/** Regles du lot 4 pour un profil (option --exigences-lot4). */
function verifierLot4Profil(profil, variantes, tronc, F, FV, rapport) {
  const parcours = Array.isArray(profil.parcours) ? profil.parcours : [];
  const chapitres = Array.isArray(profil.chapitres) ? profil.chapitres.filter(estObjet) : [];
  const parId = new Map(chapitres.map((c) => [c.id, c]));

  // EX-140 : ouverture propre au profil, avant le tronc.
  const premiere = parcours[0];
  let ouverture = null;
  if (typeof premiere !== 'string' || !premiere.startsWith('profil:')) {
    rapport.erreur(F, null, 'parcours', `premiere entree ${JSON.stringify(premiere ?? null)} : le parcours commence par le chapitre d'ouverture du profil ("profil:<id>"), avant le tronc (EX-140)`);
  } else {
    ouverture = premiere.slice('profil:'.length);
    const n = Array.isArray(parId.get(ouverture)?.scenes) ? parId.get(ouverture).scenes.length : 0;
    const [min, max] = LOT4.scenesOuverture;
    if (parId.has(ouverture) && (n < min || n > max)) {
      rapport.erreur(F, `chapitre "${ouverture}"`, 'scenes', `${n} scene(s) dans le chapitre d'ouverture : il en faut de ${min} a ${max} (EX-140)`);
    }
  }

  // EX-141 : chaque scene du tronc habillee (texte), chaque choix avec sa reaction.
  const v = estObjet(variantes) ? variantes : {};
  for (const s of idsScenes(tronc?.chapitres)) {
    const vs = v[s.id];
    if (!estObjet(vs) || !estTexte(vs.texte)) {
      rapport.erreur(FV, `scene "${s.id}"`, 'texte', 'variante absente : chaque scene du tronc est reecrite pour le profil (EX-141)');
    }
    for (const c of sortiesScene(s)) {
      if (!estTexte(c?.id)) continue;
      if (!estTexte(vs?.choix?.[c.id]?.reaction)) {
        rapport.erreur(FV, `scene "${s.id}", choix "${c.id}"`, 'reaction', 'reaction absente : chaque choix du tronc a une reaction propre au profil (EX-141)');
      }
    }
  }

  // EX-142 : chapitres du profil.
  verifierProfondeurScenes(chapitres, F, rapport);

  // EX-143 : profondeur.
  const autres = chapitres.filter((c) => c.id !== ouverture).length;
  if (autres < LOT4.chapitresHorsOuverture) {
    rapport.erreur(F, null, 'chapitres', `${autres} chapitre(s) propre(s) hors ouverture : il en faut au moins ${LOT4.chapitresHorsOuverture} (EX-143)`);
  }
  const fins = Array.isArray(profil.fins) ? profil.fins.length : 0;
  if (fins < LOT4.finsPropres) {
    rapport.erreur(F, null, 'fins', `${fins} fin(s) propre(s) : il en faut au moins ${LOT4.finsPropres} (EX-143)`);
  }
  const chTronc = new Map((Array.isArray(tronc?.chapitres) ? tronc.chapitres : []).filter(estObjet).map((c) => [c.id, c]));
  let total = 0;
  for (const e of parcours) {
    if (typeof e !== 'string') continue;
    const ch = e.startsWith('tronc:') ? chTronc.get(e.slice(6)) : e.startsWith('profil:') ? parId.get(e.slice(7)) : undefined;
    total += Array.isArray(ch?.scenes) ? ch.scenes.length : 0;
  }
  const [min, max] = LOT4.scenesParcours;
  if (total < min || total > max) {
    rapport.erreur(F, null, 'parcours', `${total} scene(s) sur l'ensemble du parcours : il en faut de ${min} a ${max} (EX-143)`);
  }
}

function verifierProfil(racine, id, ctxGlobal, rapport, couverture, lot4 = false) {
  const dossier = `profils/${id}`;
  const F = `${dossier}/profil.json`;
  const { tronc, communs, decors, refs, troncValide } = ctxGlobal;
  const avant = rapport.erreurs.length;
  if (!existsSync(join(racine, 'profils', id))) {
    rapport.erreur(`${dossier}/`, null, null, 'dossier du profil introuvable');
    return;
  }
  const profil = lireJson(racine, F, rapport);
  if (profil === undefined) return;
  if (!estObjet(profil)) {
    rapport.erreur(F, null, null, 'objet JSON attendu');
    return;
  }
  if (profil.id !== id) rapport.erreur(F, null, 'id', `"${profil.id}" different du nom du dossier "${id}"`);
  if (typeof profil.actif !== 'boolean') rapport.erreur(F, null, 'actif', 'booleen obligatoire (true ou false)');
  for (const champ of ['nom', 'entreprise', 'accroche']) {
    if (!estTexte(profil[champ])) rapport.erreur(F, null, champ, 'texte obligatoire');
  }
  if (profil.inspiration !== undefined && typeof profil.inspiration !== 'string') rapport.erreur(F, null, 'inspiration', 'texte attendu');
  verifierJauges(profil.jauges_initiales, F, null, rapport);

  // Personnages
  const personnages = Array.isArray(profil.personnages) ? profil.personnages.filter(estObjet) : [];
  if (!Array.isArray(profil.personnages)) rapport.erreur(F, null, 'personnages', 'tableau obligatoire');
  for (const p of personnages) {
    const ctx = `personnage "${p.id ?? '?'}"`;
    if (!estTexte(p.id)) rapport.erreur(F, ctx, 'id', 'identifiant obligatoire');
    else if (p.id === 'narrateur') rapport.erreur(F, ctx, 'id', '"narrateur" est reserve (encadre narratif sans portrait)');
    if (!estTexte(p.role)) rapport.erreur(F, ctx, 'role', 'role obligatoire (verificateur, comptable, joueur ou role libre de second role)');
    else if (p.role === 'narrateur') rapport.erreur(F, ctx, 'role', '"narrateur" ne peut pas etre porte par un personnage');
    if (!estTexte(p.nom)) rapport.erreur(F, ctx, 'nom', 'nom obligatoire');
    else verifierPortrait(racine, dossier, F, ctx, p, rapport);
  }
  signalerDoublons(personnages.map((p) => p.id).filter(estTexte), F, 'personnage', rapport);
  if (!personnages.some((p) => p.role === 'verificateur')) {
    rapport.erreur(F, null, 'personnages', 'role "verificateur" porte par aucun personnage du profil (obligatoire, avec portrait)');
  }

  // Chapitres
  const idsPersos = new Set(personnages.map((p) => p.id));
  const persoValide = (x) => (x === 'narrateur' || idsPersos.has(x) ? null : `personnage "${x}" inconnu du profil (id d'un personnage ou "narrateur")`);
  if (!Array.isArray(profil.chapitres) || profil.chapitres.length === 0) {
    rapport.erreur(F, null, 'chapitres', 'au moins un chapitre propre obligatoire');
  } else {
    // Fichiers cites par les parametres des scenes (ex. portrait d'une piece du tri), relatifs au dossier du profil.
    const existe = (rel) => existsSync(join(racine, 'profils', id, ...rel.split('/')));
    for (const ch of profil.chapitres) verifierChapitre(ch, F, persoValide, refs, rapport, existe);
    signalerDoublons(profil.chapitres.filter(estObjet).map((c) => c.id), F, 'chapitre', rapport);
    verifierDecorsScenes(racine, dossier, profil.chapitres, F, rapport);
  }
  verifierParcours(profil, F, tronc, rapport);
  verifierDecorsProfil(racine, id, profil, tronc, F, rapport);

  // Fins
  const fins = verifierFins(profil.fins, F, rapport);
  if (Array.isArray(profil.fins) && profil.fins.length < 2) {
    rapport.erreur(F, null, 'fins', `${profil.fins.length} fin(s) propre(s) : il en faut au moins 2`);
  }
  if (fins.some((f) => f.id === ID_FIN_PATIENCE)) rapport.erreur(F, `fin "${ID_FIN_PATIENCE}"`, 'id', 'reserve a la fin commune du tronc');

  // Identifiants uniques dans le profil assemble (tronc + profil)
  const troncChapitres = estObjet(tronc) ? tronc.chapitres : [];
  const scenesT = new Set(idsScenes(troncChapitres).map((s) => s.id));
  for (const s of idsScenes(profil.chapitres)) {
    if (scenesT.has(s.id)) rapport.erreur(F, `scene "${s.id}"`, 'id', 'deja utilise par une scene du tronc');
  }
  signalerDoublons(idsScenes(profil.chapitres).map((s) => s.id), F, 'scene', rapport);
  const choixT = new Set(idsChoix(troncChapitres));
  for (const c of idsChoix(profil.chapitres)) {
    if (choixT.has(c)) rapport.erreur(F, `choix "${c}"`, 'id', 'deja utilise par un choix du tronc');
  }
  signalerDoublons(idsChoix(profil.chapitres), F, 'choix', rapport);
  const finsT = new Set((estObjet(tronc) && Array.isArray(tronc.fins) ? tronc.fins : []).map((f) => f?.id));
  for (const f of fins) {
    if (f.id !== ID_FIN_PATIENCE && finsT.has(f.id)) rapport.erreur(F, `fin "${f.id}"`, 'id', 'deja utilise par une fin commune du tronc');
  }
  signalerDoublons(fins.map((f) => f.id), F, 'fin', rapport);

  verifierReferences(profil.references_obligatoires, F, null, 'references_obligatoires', refs, rapport);

  // Variantes (facultatives)
  const FV = `${dossier}/variantes.json`;
  let variantes = {};
  if (existsSync(join(racine, 'profils', id, 'variantes.json'))) {
    variantes = lireJson(racine, FV, rapport);
    if (variantes !== undefined) verifierVariantes(variantes, FV, tronc, rapport);
  }

  // Lot 4 (EX-140 a EX-143), sur demande.
  if (lot4) verifierLot4Profil(profil, variantes, tronc, F, FV, rapport);

  // EX-005 (couverture)
  if (couverture) {
    const declarees = Array.isArray(profil.references_obligatoires) ? profil.references_obligatoires : [];
    const cites = referencesCitees(profil.chapitres);
    const manquantes = declarees.filter((r) => !cites.has(r));
    if (manquantes.length) {
      rapport.erreur(F, null, 'references_obligatoires', `references non citees par les chapitres du profil : ${manquantes.join(', ')}`);
    }
    const spec = PROFILS_OBLIGATOIRES[id];
    if (spec) {
      const manque = spec.filter((r) => !declarees.includes(r));
      const trop = declarees.filter((r) => !spec.includes(r));
      if (manque.length || trop.length) {
        rapport.erreur(F, null, 'references_obligatoires',
          `different de la colonne de la spec (2.2)${manque.length ? ` ; manquantes : ${manque.join(', ')}` : ''}${trop.length ? ` ; en trop : ${trop.join(', ')}` : ''}`);
      }
    }
    const ch = Array.isArray(profil.chapitres) ? profil.chapitres : [];
    if (ch.length < 1 || ch.length > 3) rapport.erreur(F, null, 'chapitres', `${ch.length} chapitre(s) propre(s) : il en faut de 1 a 3`);
    // Chapitre d'ouverture (EX-140) : premier du parcours, avant le tronc, 1 ou 2 scenes.
    const premiere = Array.isArray(profil.parcours) ? profil.parcours[0] : undefined;
    const ouverture = typeof premiere === 'string' && premiere.startsWith('profil:') ? premiere.slice('profil:'.length) : null;
    for (const c of ch) {
      const n = Array.isArray(c?.scenes) ? c.scenes.length : 0;
      const [min, max] = c?.id === ouverture ? LOT4.scenesOuverture : [2, 6];
      if (n < min || n > max) {
        rapport.erreur(F, `chapitre "${c?.id}"`, 'scenes', `${n} scene(s) : il en faut de ${min} a ${max}${c?.id === ouverture ? ' (chapitre d\'ouverture)' : ''}`);
      }
    }
  }

  // Assemblage par le moteur, seulement si tout le reste est propre.
  if (rapport.erreurs.length === avant && troncValide && communs !== undefined) {
    try {
      nouvellePartie(assembler(tronc, profil, variantes ?? {}, communs, decors));
    } catch (e) {
      rapport.erreur(F, null, null, `assemblage impossible : ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------- point d'entree

/**
 * @param {{ racine?: string, profil?: string|null, couverture?: boolean, exigencesLot4?: boolean }} options
 *   `exigencesLot4` : regles EX-140 a EX-143 pour les profils verifies (et EX-142 pour le tronc).
 * @returns {{ erreurs: string[], avertissements: string[], profils: string[] }}
 */
export function valider({ racine = RACINE_DEFAUT, profil = null, couverture = true, exigencesLot4 = false } = {}) {
  const rapport = new Rapport();
  racine = resolve(racine);
  if (!existsSync(racine)) {
    rapport.erreur(racine, null, null, 'dossier de donnees introuvable');
    return { ...rapport, profils: [] };
  }
  const references = lireJson(racine, 'references.json', rapport);
  const refs = new Map();
  if (references !== undefined) {
    if (!Array.isArray(references?.references)) rapport.erreur('references.json', null, 'references', 'tableau attendu');
    else for (const r of references.references) if (estTexte(r?.id)) refs.set(r.id, r);
  }

  const avantTronc = rapport.erreurs.length;
  const tronc = lireJson(racine, 'tronc.json', rapport);
  if (tronc !== undefined) verifierTronc(tronc, refs, rapport, racine);
  const troncValide = tronc !== undefined && rapport.erreurs.length === avantTronc;

  const communs = lireJson(racine, 'communs/personnages.json', rapport);
  verifierCommuns(racine, communs, rapport);

  // EX-150 : decors par defaut du tronc et de l'ecran titre (fichier facultatif : absent = aucun decor).
  let decors = { chapitres: {}, titre: null };
  if (existsSync(join(racine, 'communs', 'decors.json'))) {
    const lu = lireJson(racine, 'communs/decors.json', rapport);
    if (lu !== undefined) {
      verifierDecorsCommuns(racine, lu, tronc, rapport);
      if (estObjet(lu)) decors = lu;
    }
  }
  // EX-152 / EX-153 : format et poids de toutes les images WebP du dossier.
  verifierImages(racine, rapport);

  const ids = profil ? [profil] : lireIndex(racine, rapport);
  for (const id of ids) verifierProfil(racine, id, { tronc, communs, decors, refs, troncValide }, rapport, couverture, exigencesLot4);
  if (couverture && !profil) verifierCouvertureTronc(tronc, rapport);
  if (exigencesLot4 && estObjet(tronc)) verifierProfondeurScenes(tronc.chapitres, 'tronc.json', rapport);

  return { erreurs: rapport.erreurs, avertissements: rapport.avertissements, profils: ids };
}

function lireArguments(argv) {
  const opts = { racine: RACINE_DEFAUT, profil: null, couverture: true, exigencesLot4: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--racine' || a === '--profil') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`option ${a} : valeur manquante`);
      opts[a.slice(2)] = a === '--racine' ? resolve(v) : v;
      i += 1;
    } else if (a === '--sans-couverture') {
      opts.couverture = false;
    } else if (a === '--exigences-lot4') {
      opts.exigencesLot4 = true;
    } else if (a === '--aide' || a === '-h' || a === '--help') {
      opts.aide = true;
    } else {
      throw new Error(`option "${a}" inconnue`);
    }
  }
  return opts;
}

export function principal(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = lireArguments(argv);
  } catch (e) {
    console.error(`valider : ${e.message}`);
    console.error('usage : node outils/valider.mjs [--racine <dossier>] [--profil <id>] [--sans-couverture] [--exigences-lot4]');
    return 1;
  }
  if (opts.aide) {
    console.log('usage : node outils/valider.mjs [--racine <dossier>] [--profil <id>] [--sans-couverture] [--exigences-lot4]');
    return 0;
  }
  const { erreurs, avertissements, profils } = valider(opts);
  for (const a of avertissements) console.log(`avertissement : ${a}`);
  for (const e of erreurs) console.error(e);
  const rel = relative(process.cwd(), opts.racine);
  const affiche = rel === '' ? '.' : rel.startsWith('..') || isAbsolute(rel) ? opts.racine : rel;
  const cible = `${affiche.split(sep).join('/')}${opts.profil ? `, profil "${opts.profil}"` : ''}${opts.couverture ? '' : ', sans couverture'}${opts.exigencesLot4 ? ', exigences du lot 4' : ''}`;
  if (erreurs.length) {
    console.error(`ECHEC : ${erreurs.length} erreur(s) (${cible})`);
    return 1;
  }
  console.log(`OK : donnees valides (${cible}) ; profils verifies : ${profils.length ? profils.join(', ') : 'aucun'} ; ${avertissements.length} avertissement(s)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = principal();
}
