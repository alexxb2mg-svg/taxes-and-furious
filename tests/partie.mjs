// Aides des tests d'interface (pas un fichier de test) : lecture du DOM et partie complète
// vérifiée scène par scène contre le moteur. Partagées par interface.test.mjs (données de
// démonstration) et interface-donnees.test.mjs (data/ réel).
import assert from 'node:assert/strict';
import { nouvellePartie, resoudre, estTerminee, fin, sceneCourante, typeDe, issuePour } from '../js/moteur.js';
import * as modulesTypes from '../js/types/index.js';
import * as modulesJoueurs from './joueurs/index.mjs';
import { chargerScenario, lireJson } from './aides.mjs';

/** Seule tolérance console : la 404 d'un variantes.json absent (fichier facultatif, section 4). */
export const tolerance404Variantes = /^log network : Failed to load resource: the server responded with a status of 404 \(Not Found\) \S+\/profils\/[^/]+\/variantes\.json$/;

const TYPES = new Map(Object.values(modulesTypes).map((t) => [t.type, t]));

/**
 * Étapes possibles d'une scène pour les suites et l'exploration (EX-110) : ids des choix d'une scène
 * `choix`, sinon résultats possibles déclarés par le type (`resultatsPossibles`, ex. 0..N pour le tri).
 */
export function etapesPossibles(scene) {
  if (typeDe(scene) === 'choix') return scene.choix.map((c) => c.id);
  const type = TYPES.get(typeDe(scene));
  if (!type?.resultatsPossibles) throw new Error(`type "${typeDe(scene)}" : resultatsPossibles absent, exploration impossible`);
  return type.resultatsPossibles(scene.parametres);
}

/** Choix ou issue retenu par une étape (id de choix ou résultat d'un autre type). */
export function sortieDe(scene, etape) {
  return typeDe(scene) === 'choix' ? scene.choix.find((c) => c.id === etape) : issuePour(scene, etape);
}

/** Joueurs de test par type (tests/joueurs/index.mjs, une ligne par type). */
export const JOUEURS = new Map(Object.values(modulesJoueurs).map((j) => [j.type, j]));

/**
 * Joue une étape dans le navigateur avec le joueur de test du type de la scène : id du choix
 * pour une scène `choix`, résultat à produire pour un autre type (ex. nombre de pièces bien rangées).
 */
export async function jouerEtape(p, scene, etape) {
  const type = typeDe(scene);
  const joueur = JOUEURS.get(type);
  if (!joueur) {
    throw new Error(`${scene.id} : type "${type}" sans joueur de test ; ajouter tests/joueurs/${type}.mjs et une ligne dans tests/joueurs/index.mjs (docs/AJOUTER_UN_TYPE_DE_SCENE.md, section 7)`);
  }
  await joueur.jouer(p, scene, etape);
}

export const ecran = (p) => p.eval('document.body.dataset.ecran');
export const texte = (p, sel) => p.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? null`);
export const visible = (p, sel) => p.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && e.getClientRects().length > 0; })()`);

export function dateFr(iso) {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

export const avertissementAttendu = (racine) => `Jeu humoristique. Ce n'est pas un conseil fiscal. Textes vérifiés au ${dateFr(lireJson(racine, 'references.json').date_verification)}.`;

export async function allerAuChoix(p) {
  await p.cliquer('#bouton-commencer');
  await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'ecran de choix');
}

export async function cartes(p) {
  return p.eval(`[...document.querySelectorAll('#liste-profils .carte-profil')].map((b) => ({
    id: b.dataset.profil,
    nom: b.querySelector('.carte-nom').textContent,
    entreprise: b.querySelector('.carte-entreprise').textContent,
    accroche: b.querySelector('.carte-accroche').textContent,
    portrait: b.querySelector('img').getAttribute('src'),
    role: b.querySelector('img').getAttribute('role'),
    label: b.querySelector('img').getAttribute('aria-label'),
    charge: b.querySelector('img').complete && b.querySelector('img').naturalWidth > 0,
    meilleur: b.querySelector('.carte-meilleur').hidden ? null : b.querySelector('.carte-meilleur-valeur').textContent,
  }))`);
}

export async function jaugesAffichees(p) {
  return p.eval(`Object.fromEntries([...document.querySelectorAll('[data-jauge]')].map((e) =>
    [e.dataset.jauge, { attr: Number(e.dataset.valeur), texte: Number(e.querySelector('.jauge-valeur').textContent.replace(/\\D/g, '')) }]))`);
}

/** Clé d'un personnage pour la fiche de présentation (même règle que js/interface.js). */
const clePersonnage = (perso) => `${perso.id}|${perso.portrait ?? ''}`;

/** La fiche de présentation (EX-156) est attendue avant la scène : personnage illustré, pas encore présenté. */
export const ficheAttendue = (perso, presentes) => perso.role !== 'narrateur' && !!perso.illustration && !presentes.has(clePersonnage(perso));

/** Contenu affiché de la fiche de présentation. */
export const etatFiche = (p) => p.eval(`(() => {
  const f = document.querySelector('#fiche');
  const illu = f.querySelector('.fiche-illustration');
  const portrait = f.querySelector('.fiche-portrait');
  return {
    visible: !f.hidden && f.getClientRects().length > 0, scene: f.dataset.scene ?? null, personnage: f.dataset.personnage ?? null,
    nom: f.querySelector('#fiche-nom').textContent, description: f.querySelector('#fiche-description').textContent,
    illustration: illu && { src: illu.getAttribute('src'), charge: illu.complete && illu.naturalWidth > 0, cache: illu.getAttribute('aria-hidden') },
    portrait: portrait && { src: portrait.getAttribute('src'), role: portrait.getAttribute('role'), label: portrait.getAttribute('aria-label'), charge: portrait.tagName !== 'IMG' || (portrait.complete && portrait.naturalWidth > 0) },
    focus: document.activeElement?.id ?? null,
  };
})()`);

/**
 * Attend la scène `scene` ; si sa fiche de présentation (EX-156) s'affiche d'abord, la vérifie
 * (illustration + portrait + nom + description) puis la ferme par « Suivant ». `presentes` (Set,
 * modifié) suit les personnages déjà présentés : la fiche doit apparaître exactement à leur première
 * réplique. Renvoie true si une fiche a été fermée.
 */
export async function passerFiche(p, scene, presentes = new Set()) {
  const id = JSON.stringify(scene.id);
  const pret = `document.querySelector('#scene').dataset.scene === ${id} && !document.querySelector('#scene').hidden`;
  const fiche = `!document.querySelector('#fiche').hidden && document.querySelector('#fiche').dataset.scene === ${id}`;
  await p.attendre(`(${pret}) || (${fiche})`, `scene ${scene.id} ou sa fiche`);
  const montree = await p.eval(fiche);
  const perso = scene.personnage;
  assert.equal(montree, ficheAttendue(perso, presentes), `${scene.id} : fiche de presentation de ${perso.id} (EX-156)`);
  if (!montree) return false;
  presentes.add(clePersonnage(perso));
  await p.attendre(`(() => { const i = document.querySelector('#fiche .fiche-illustration'); return !!i && i.complete; })()`, `${scene.id} : illustration de la fiche`);
  const f = await etatFiche(p);
  assert.equal(f.personnage, perso.id);
  assert.equal(f.nom, perso.nom ?? '', `${scene.id} : nom sur la fiche`);
  assert.equal(f.description, perso.description ?? '', `${scene.id} : description sur la fiche`);
  assert.ok(f.illustration?.src.endsWith(perso.illustration), `${scene.id} : illustration ${f.illustration?.src}, attendu ${perso.illustration}`);
  assert.equal(f.illustration.charge, true, `${scene.id} : illustration chargee`);
  if (perso.portrait) {
    assert.ok(f.portrait, `${scene.id} : portrait sur la fiche`);
    assert.equal(f.portrait.role, 'img');
    assert.equal(f.portrait.label, perso.nom, `${scene.id} : aria-label du portrait = nom (EX-034)`);
  }
  assert.equal(f.focus, 'fiche-nom', `${scene.id} : focus sur le nom de la fiche`);
  await p.cliquer('#bouton-fiche-suivant');
  await p.attendre(pret, `scene ${scene.id} apres la fiche`);
  return true;
}

/**
 * Image attendue sur la carte d'un profil (EX-156 a) : illustration du personnage `joueur` du profil,
 * sinon portrait du vérificateur (aria-label = nom du personnage montré).
 */
export function imageCarte(scenario) {
  const joueur = scenario.personnages.roles.joueur;
  const verif = scenario.personnages.roles.verificateur;
  return joueur?.illustration ? { src: joueur.illustration, label: joueur.nom, classe: 'carte-illustration' } : { src: verif.portrait, label: verif.nom, classe: 'carte-portrait' };
}

export async function verifierJauges(p, etat, contexte) {
  const aff = await jaugesAffichees(p);
  for (const j of ['redressement', 'patience', 'stress']) {
    assert.equal(aff[j].attr, etat.jauges[j], `${contexte} : jauge ${j} (attribut)`);
    assert.equal(aff[j].texte, etat.jauges[j], `${contexte} : jauge ${j} (texte affiche)`);
  }
}

/**
 * Joue une partie complète depuis l'écran de choix, en vérifiant à chaque scène :
 * orateur (portrait + aria-label, ou encadré narratif sans portrait), textes, jauges = moteur,
 * encadré loi = article/resume de references.json. Renvoie { etat, resultat, vus, scenario }.
 * `largeurMax` : si fourni, vérifie aussi l'absence de défilement horizontal sur chaque écran (EX-035).
 */
export async function jouerPartie(p, racine, id, suite, { references, largeurMax } = {}) {
  const { scenario } = chargerScenario(racine, id);
  const refs = new Map((references ?? lireJson(racine, 'references.json')).references.map((r) => [r.id, r]));
  const largeur = async (quoi) => {
    if (largeurMax === undefined) return;
    const w = await p.eval('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)');
    assert.ok(w <= largeurMax, `${id} ${quoi} : scrollWidth ${w} > ${largeurMax}`);
  };
  await p.cliquer(`.carte-profil[data-profil="${id}"]`);
  await p.attendre(`['ecran-partie', 'ecran-fin'].includes(document.body.dataset.ecran)`, 'debut de partie');
  let etat = nouvellePartie(scenario);
  const vus = { narrateur: 0, roles: {}, fiches: [] };
  const presentes = new Set();
  for (const idChoix of suite) {
    const scene = sceneCourante(etat);
    const estChoix = typeDe(scene) === 'choix';
    if (await passerFiche(p, scene, presentes)) vus.fiches.push(scene.personnage.id);
    assert.equal(await texte(p, '#scene-texte'), scene.texte.trim(), `${scene.id} : texte`);
    await verifierJauges(p, etat, `${scene.id} avant choix`);
    await p.attendre(`(() => { const i = document.querySelector('#scene-orateur img'); return !i || i.complete; })()`, `${scene.id} : chargement du portrait`);
    const orateur = await p.eval(`(() => {
      const o = document.querySelector('#scene-orateur');
      const img = o.querySelector('img');
      return { role: o.dataset.role, narrateurVisible: o.getClientRects().length > 0, img: img && { src: img.getAttribute('src'), role: img.getAttribute('role'), label: img.getAttribute('aria-label'), charge: img.complete && img.naturalWidth > 0 },
        nom: o.querySelector('.orateur-nom')?.textContent ?? null, bulleNarrative: document.querySelector('#scene-texte').classList.contains('bulle-narrateur') };
    })()`);
    const perso = scene.personnage;
    vus.roles[perso.role] = vus.roles[perso.role] ?? new Set();
    vus.roles[perso.role].add(orateur.nom);
    if (perso.role === 'narrateur') {
      vus.narrateur += 1;
      assert.equal(orateur.img, null, `${scene.id} : le narrateur n'a pas de portrait`);
      assert.equal(orateur.bulleNarrative, true, `${scene.id} : narrateur en encadre narratif`);
    } else {
      assert.ok(orateur.img, `${scene.id} : portrait affiche`);
      assert.ok(orateur.img.src.endsWith(perso.portrait), `${scene.id} : portrait ${orateur.img.src} attendu ${perso.portrait}`);
      assert.equal(orateur.img.role, 'img');
      assert.equal(orateur.img.label, perso.nom, `${scene.id} : aria-label = nom (EX-034)`);
      assert.equal(orateur.img.charge, true, `${scene.id} : portrait charge`);
      assert.equal(orateur.nom, perso.nom);
      assert.equal(orateur.bulleNarrative, false);
    }
    if (estChoix) {
      const boutons = await p.eval(`[...document.querySelectorAll('#scene-choix .choix')].map((b) => [b.dataset.choix, b.querySelector('.choix-texte').textContent])`);
      assert.deepEqual(boutons, scene.choix.map((c) => [c.id, c.texte]), `${scene.id} : choix affiches`);
    } else {
      assert.equal(await p.eval(`document.querySelector('#scene').dataset.type`), typeDe(scene), `${scene.id} : type`);
    }
    await largeur(`scene ${scene.id}`);

    await jouerEtape(p, scene, idChoix);
    await p.attendre(`!document.querySelector('#encadre').hidden`, `encadre ${idChoix}`);
    const choix = sortieDe(scene, idChoix);
    assert.ok(choix, `${idChoix} : choix absent de la scene ${scene.id}`);
    assert.equal(await p.eval(`document.querySelector('#encadre').dataset.choix`), choix.id, `${scene.id} : issue retenue`);
    etat = resoudre(etat, idChoix);
    await verifierJauges(p, etat, `${idChoix} apres choix`);
    assert.equal(await texte(p, '#encadre-reaction'), (choix.reaction ?? '').trim(), `${idChoix} : reaction`);
    assert.equal(await texte(p, '#loi-titre'), 'Ce que dit vraiment la loi');
    // EX-131 : le libelle n'apparait qu'une fois dans l'encadre (son titre), jamais repete dans l'explication.
    const libelles = await p.eval(`(document.querySelector('#encadre').textContent.match(/ce que dit vraiment la loi/gi) || []).length`);
    assert.equal(libelles, 1, `${idChoix} : libelle "Ce que dit vraiment la loi" ${libelles} fois dans l'encadre (EX-131)`);
    assert.equal(await texte(p, '#loi-explication'), choix.explication.trim(), `${idChoix} : explication`);
    const loi = await p.eval(`[...document.querySelectorAll('#loi-references .loi-reference')].map((li) => ({
      id: li.dataset.reference, article: li.querySelector('.loi-article').textContent, resume: li.querySelector('.loi-resume').textContent }))`);
    assert.deepEqual(loi, choix.references.map((r) => ({ id: r, article: refs.get(r).article, resume: refs.get(r).resume })), `${idChoix} : encadre loi = references.json (EX-007)`);
    assert.equal(await p.eval(`document.querySelector('#encadre').dataset.juste`), String(choix.juste === true));
    await largeur(`encadre ${idChoix}`);
    await p.cliquer('#bouton-suivant');
  }
  assert.ok(estTerminee(etat), 'la suite de choix doit terminer la partie');
  await p.attendre(`document.body.dataset.ecran === 'ecran-fin'`, 'ecran de fin');
  const resultat = fin(etat, scenario);
  assert.equal(await p.eval(`document.querySelector('#ecran-fin').dataset.fin`), resultat.id);
  assert.equal(await texte(p, '#fin-titre'), resultat.titre);
  assert.equal(await texte(p, '#fin-texte'), resultat.texte);
  assert.equal(Number((await texte(p, '[data-score="redressement"]')).replace(/\D/g, '')), resultat.redressement);
  assert.equal(Number(await texte(p, '[data-score="bons"]')), resultat.bonsReflexes);
  assert.equal(Number(await texte(p, '[data-score="scenes"]')), resultat.scenesJouees);
  assert.equal(await visible(p, '#fin-anticipee'), resultat.anticipee);
  // EX-156 c : illustration en pied du vérificateur du profil, sinon son portrait.
  const verif = scenario.personnages.roles.verificateur;
  await p.attendre(`(() => { const i = document.querySelector('#fin-verificateur img'); return !i || i.complete; })()`, 'image de fin');
  const imgFin = await p.eval(`(() => { const i = document.querySelector('#fin-verificateur [role="img"]');
    return i && { src: i.getAttribute('src'), label: i.getAttribute('aria-label'), illustration: i.classList.contains('fin-illustration') }; })()`);
  assert.ok(imgFin, "image du verificateur a l'ecran de fin");
  assert.equal(imgFin.label, verif.nom, 'fin : aria-label = nom du verificateur');
  assert.equal(imgFin.illustration, !!verif.illustration, 'fin : illustration si declaree, sinon portrait');
  if (imgFin.src !== null) assert.ok(imgFin.src.endsWith(verif.illustration ?? verif.portrait), `fin : ${imgFin.src}`);
  await largeur('fin');
  return { etat, resultat, vus, scenario };
}

/**
 * Suite de choix déterministe : `rang` = index du choix pris à chaque scène (borné),
 * ou fonction (numéro de scène jouée) -> index.
 */
export function suiteDe(racine, id, rang) {
  const { scenario } = chargerScenario(racine, id);
  let etat = nouvellePartie(scenario);
  const suite = [];
  while (!estTerminee(etat)) {
    const c = etapesPossibles(sceneCourante(etat));
    const r = typeof rang === 'function' ? rang(suite.length) : rang;
    const etape = c[Math.min(r, c.length - 1)];
    suite.push(etape);
    etat = resoudre(etat, etape);
  }
  return suite;
}

/**
 * Une suite de choix par fin atteignable (exploration exhaustive, première suite trouvée par fin) :
 * sert aux profils ajoutés après coup, qui n'ont pas de suites figées dans tests/suites-fins.mjs.
 */
export function suitesParFin(racine, id) {
  const { scenario } = chargerScenario(racine, id);
  const suites = {};
  const pile = [{ etat: nouvellePartie(scenario), suite: [] }];
  while (pile.length) {
    const { etat, suite } = pile.pop();
    if (estTerminee(etat)) {
      const idFin = fin(etat, scenario).id;
      if (!suites[idFin]) suites[idFin] = suite;
      continue;
    }
    for (const e of [...etapesPossibles(sceneCourante(etat))].reverse()) pile.push({ etat: resoudre(etat, e), suite: [...suite, e] });
  }
  return suites;
}
