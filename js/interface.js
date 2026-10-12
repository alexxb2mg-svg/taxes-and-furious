// Interface du jeu : écrans, jauges, encadré « loi », animations. Le rendu propre à chaque type de
// scène est délégué aux modules de js/types/ (EX-111) ; aucun texte de contenu ici : les libellés
// sont dans index.html, le contenu dans les JSON de données.
// Dossier de données : `data/` par défaut, ou `?donnees=<chemin relatif>` (tests, copies).
import { assembler, nouvellePartie, resoudre, estTerminee, fin, sceneCourante, trouverChoix, typeDe, sorties } from './moteur.js';
import * as modulesTypes from './types/index.js';
import { ANIMATIONS, CLASSES_ANIMATIONS } from './animations.js';

const CLE_MEILLEUR = 'fiscfiction.meilleur';
const DONNEES_DEFAUT = 'data';
const TYPES = new Map(Object.values(modulesTypes).map((t) => [t.type, t]));

const $ = (sel, racine = document) => racine.querySelector(sel);
const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

const app = {
  donnees: DONNEES_DEFAUT,
  references: new Map(),
  profils: [], // { id, scenario } des profils actifs chargés, dans l'ordre de l'index
  indisponibles: 0,
  courant: null, // { id, scenario }
  etat: null,
};

// ------------------------------------------------------------------ données

/** Chemin de données relatif à la page, sans remontée ni origine externe. */
function dossierDonnees() {
  const brut = new URLSearchParams(location.search).get('donnees');
  if (brut === null || brut === '') return DONNEES_DEFAUT;
  const propre = brut.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = propre.split('/');
  const valide = /^[A-Za-z0-9_.\-/]+$/.test(propre) && !propre.startsWith('/')
    && segments.every((s) => s !== '' && s !== '.' && s !== '..');
  if (!valide) {
    console.warn(`parametre donnees ignore : "${brut}"`);
    return DONNEES_DEFAUT;
  }
  return propre;
}

function url(rel) {
  return `${app.donnees}/${rel}`;
}

async function lireJson(rel) {
  const r = await fetch(url(rel), { cache: 'no-store' });
  if (!r.ok) {
    const e = new Error(`${rel} : HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/** variantes.json est facultatif (section 4) : absent = aucune variante. */
async function lireVariantes(id) {
  try {
    return await lireJson(`profils/${id}/variantes.json`);
  } catch (e) {
    if (e.status === 404) return {};
    throw e;
  }
}

/** Contrôles minimaux à l'exécution (EX-054) : ce qui ferait planter l'affichage. */
function verifierScenario(scenario) {
  for (const ch of scenario.chapitres) {
    if (!Array.isArray(ch.scenes) || ch.scenes.length === 0) throw new Error(`chapitre ${ch.id} sans scene`);
    const ids = new Set(ch.scenes.map((s) => s.id));
    for (const s of ch.scenes) {
      if (typeof s.texte !== 'string') throw new Error(`scene ${s.id} sans texte`);
      if (!TYPES.has(typeDe(s))) throw new Error(`scene ${s.id} : type "${typeDe(s)}" non enregistre`);
      const liste = sorties(s);
      if (typeDe(s) === 'choix') {
        if (!Array.isArray(s.choix) || s.choix.length < 2 || s.choix.length > 4) throw new Error(`scene ${s.id} : 2 a 4 choix attendus`);
        if (liste.some((c) => typeof c.texte !== 'string')) throw new Error(`scene ${s.id} : choix sans texte`);
      } else {
        if (!Array.isArray(s.issues) || s.issues.length === 0) throw new Error(`scene ${s.id} : issues attendues`);
        const erreurs = TYPES.get(typeDe(s)).validerParametres(s.parametres);
        if (erreurs.length) throw new Error(`scene ${s.id} : ${erreurs[0]}`);
      }
      for (const c of liste) {
        if (typeof c.explication !== 'string') throw new Error(`choix ${c.id} incomplet`);
        if (c.suivant !== null && c.suivant !== undefined && !ids.has(c.suivant)) throw new Error(`choix ${c.id} : suivant ${c.suivant} introuvable`);
      }
    }
  }
  if (!scenario.fins.length || !scenario.personnages.roles.verificateur?.nom) throw new Error('fins ou verificateur absents');
}

async function chargerProfil(id, tronc, communs) {
  const profil = await lireJson(`profils/${id}/profil.json`);
  if (profil?.id !== id) throw new Error(`profils/${id}/profil.json : id "${profil?.id}" different du dossier`);
  if (profil.actif !== true) return null;
  const variantes = await lireVariantes(id);
  const scenario = assembler(tronc, profil, variantes, communs);
  verifierScenario(scenario);
  return { id, scenario };
}

async function charger() {
  app.donnees = dossierDonnees();
  const [references, tronc, communs, index] = await Promise.all([
    lireJson('references.json'),
    lireJson('tronc.json'),
    lireJson('communs/personnages.json'),
    lireJson('profils/index.json'),
  ]);
  if (!Array.isArray(index)) throw new Error('profils/index.json : tableau attendu');
  app.references = new Map((references.references ?? []).map((r) => [r.id, r]));
  app.dateVerification = references.date_verification;
  app.titre = tronc.titre;

  const resultats = await Promise.all(index.map((id) => chargerProfil(id, tronc, communs).then(
    (p) => ({ p }),
    (erreur) => ({ erreur, id }),
  )));
  app.profils = [];
  app.indisponibles = 0;
  for (const r of resultats) {
    if (r.erreur) {
      app.indisponibles += 1;
      console.warn(`profil "${r.id}" indisponible : ${r.erreur.message}`);
    } else if (r.p) {
      app.profils.push(r.p);
    }
  }
}

// ------------------------------------------------------------------ meilleur score (EX-036)

function lireMeilleurs() {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_MEILLEUR) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function enregistrerMeilleur(id, redressement) {
  const meilleurs = lireMeilleurs();
  if (meilleurs[id] === undefined || redressement < meilleurs[id]) {
    meilleurs[id] = redressement;
    try {
      localStorage.setItem(CLE_MEILLEUR, JSON.stringify(meilleurs));
    } catch { /* stockage indisponible : le jeu continue */ }
  }
  return meilleurs[id];
}

// ------------------------------------------------------------------ rendu commun

const nombre = new Intl.NumberFormat('fr-FR');

function dateFr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

function cheminDonnee(rel) {
  return rel ? url(rel) : null;
}

function portrait(img, personnage) {
  img.src = cheminDonnee(personnage.portrait);
  img.alt = personnage.nom ?? '';
  img.setAttribute('role', 'img');
  img.setAttribute('aria-label', personnage.nom ?? '');
}

function afficherEcran(id) {
  for (const s of $$('.ecran')) s.hidden = s.id !== id;
  $('#chargement').hidden = true;
  document.body.dataset.ecran = id;
  window.scrollTo(0, 0);
}

function focaliser(el) {
  el?.focus({ preventScroll: false });
}

/** Orateur d'une scène : portrait + nom, ou encadré narratif sans portrait. */
function remplirOrateur(conteneur, personnage) {
  conteneur.replaceChildren();
  const narrateur = personnage.role === 'narrateur';
  conteneur.dataset.role = personnage.role;
  conteneur.classList.toggle('orateur-narrateur', narrateur);
  if (narrateur || (!personnage.portrait && !personnage.nom)) return narrateur;
  const fig = $('#gabarit-orateur').content.firstElementChild.cloneNode(true);
  const img = $('img', fig);
  if (personnage.portrait) portrait(img, personnage);
  else img.remove();
  $('.orateur-nom', fig).textContent = personnage.nom ?? '';
  conteneur.append(fig);
  return narrateur;
}

function majJauges(jauges) {
  for (const el of $$('[data-jauge]')) {
    const v = jauges[el.dataset.jauge];
    el.dataset.valeur = String(v);
    $('.jauge-valeur', el).textContent = nombre.format(v);
    el.style.setProperty('--niveau', `${Math.max(0, Math.min(100, v))}%`);
    el.classList.toggle('jauge-alerte', el.dataset.jauge === 'patience' ? v <= 25 : el.dataset.jauge === 'stress' ? v >= 75 : false);
  }
}

// ------------------------------------------------------------------ écrans

function ecranTitre() {
  afficherEcran('ecran-titre');
  focaliser($('#titre-jeu'));
}

function ecranChoix() {
  const liste = $('#liste-profils');
  liste.replaceChildren();
  const meilleurs = lireMeilleurs();
  for (const { id, scenario } of app.profils) {
    const li = $('#gabarit-carte').content.firstElementChild.cloneNode(true);
    const bouton = $('.carte-profil', li);
    bouton.dataset.profil = id;
    const verif = scenario.personnages.roles.verificateur;
    portrait($('.carte-portrait', li), verif);
    $('.carte-nom', li).textContent = scenario.profil.nom ?? id;
    $('.carte-entreprise', li).textContent = scenario.profil.entreprise ?? '';
    $('.carte-accroche', li).textContent = scenario.profil.accroche ?? '';
    if (Number.isFinite(meilleurs[id])) {
      $('.carte-meilleur', li).hidden = false;
      $('.carte-meilleur-valeur', li).textContent = nombre.format(meilleurs[id]);
    }
    bouton.addEventListener('click', () => commencer(id));
    liste.append(li);
  }
  const ind = $('#profils-indisponibles');
  ind.hidden = app.indisponibles === 0;
  if (app.indisponibles) {
    const modele = app.indisponibles === 1 ? ind.dataset.singulier : ind.dataset.pluriel;
    ind.textContent = modele.replace('{n}', String(app.indisponibles));
  }
  $('#aucun-profil').hidden = app.profils.length > 0 || app.indisponibles > 0;
  afficherEcran('ecran-choix');
  focaliser($('#titre-choix'));
}

function commencer(id) {
  app.courant = app.profils.find((p) => p.id === id);
  app.etat = nouvellePartie(app.courant.scenario);
  $('#partie-profil').textContent = [app.courant.scenario.profil.nom, app.courant.scenario.profil.entreprise].filter(Boolean).join(' · ');
  afficherEcran('ecran-partie');
  if (estTerminee(app.etat)) {
    ecranFin();
    return;
  }
  afficherScene();
}

// ------------------------------------------------------------------ animations (EX-113)

const mouvementReduit = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Retire toute classe d'animation, puis applique celle de `nom` (sauf mouvement réduit). */
function animer(el, nom) {
  el.classList.remove(...CLASSES_ANIMATIONS);
  const a = nom ? ANIMATIONS[nom] : undefined;
  if (!a || mouvementReduit()) return;
  void el.offsetWidth; // relance l'animation si la même classe vient d'être retirée
  el.classList.add(a.classe);
}

// ------------------------------------------------------------------ scène

/** Dossier de la scène pour les chemins relatifs de ses paramètres (portraits des pièces, etc.). */
function dossierScene() {
  const ch = app.courant.scenario.chapitres[app.etat.chapitre];
  return ch.origine === 'profil' ? `profils/${app.courant.id}` : '';
}

function afficherScene() {
  const scenario = app.courant.scenario;
  const scene = sceneCourante(app.etat);
  $('#partie-chapitre').textContent = scenario.chapitres[app.etat.chapitre].titre ?? '';
  majJauges(app.etat.jauges);
  const art = $('#scene');
  art.dataset.scene = scene.id;
  art.dataset.type = typeDe(scene);
  const narrateur = remplirOrateur($('#scene-orateur'), scene.personnage);
  const bulle = $('#scene-texte');
  bulle.textContent = scene.texte;
  bulle.classList.toggle('bulle-narrateur', narrateur);
  const jeu = $('#scene-jeu');
  jeu.replaceChildren();
  const dossier = dossierScene();
  // Rendu délégué au type de la scène (EX-111) ; terminer(resultat) n'est pris en compte qu'une fois.
  let termine = false;
  TYPES.get(typeDe(scene)).rendre(scene, jeu, (resultat) => {
    if (termine) return;
    termine = true;
    jouer(resultat);
  }, { url: (rel) => cheminDonnee(dossier ? `${dossier}/${rel}` : rel) });
  art.hidden = false;
  $('#encadre').hidden = true;
  animer($('#encadre'), null);
  animer(art, scene.animation);
  window.scrollTo(0, 0);
  focaliser(bulle);
}

function jouer(resultat) {
  if (!$('#encadre').hidden) return;
  const scene = sceneCourante(app.etat);
  app.etat = resoudre(app.etat, resultat);
  const choix = trouverChoix(app.etat, app.etat.dernierChoix);
  majJauges(app.etat.jauges);

  const encadre = $('#encadre');
  encadre.dataset.choix = choix.id;
  encadre.dataset.juste = String(choix.juste === true);
  const type = TYPES.get(typeDe(scene));
  const estChoix = typeDe(scene) === 'choix';
  // Scène à choix : texte du choix ; autre type : description du résultat par le type, ou texte de l'issue.
  $('#encadre-choix-texte').textContent = estChoix ? choix.texte : (type.decrire?.(scene, resultat) ?? choix.texte ?? '');
  $('#encadre-libelle-choix').hidden = !estChoix;
  $('#encadre-libelle-resultat').hidden = estChoix;
  remplirOrateur($('#encadre-orateur'), scene.personnage);
  const reaction = $('#encadre-reaction');
  reaction.textContent = choix.reaction ?? '';
  reaction.classList.toggle('bulle-narrateur', scene.personnage.role === 'narrateur');
  $('#loi-explication').textContent = choix.explication ?? '';
  const refs = $('#loi-references');
  refs.replaceChildren();
  for (const idRef of choix.references ?? []) {
    const r = app.references.get(idRef);
    const li = $('#gabarit-reference').content.firstElementChild.cloneNode(true);
    li.dataset.reference = idRef;
    $('.loi-article', li).textContent = r?.article ?? idRef;
    $('.loi-resume', li).textContent = r?.resume ?? '';
    refs.append(li);
  }
  $('#scene').hidden = true;
  encadre.hidden = false;
  animer(encadre, choix.animation);
  window.scrollTo(0, 0);
  focaliser($('#encadre-titre'));
}

function suivant() {
  if (estTerminee(app.etat)) ecranFin();
  else afficherScene();
}

function ecranFin() {
  const resultat = fin(app.etat, app.courant.scenario);
  const ecran = $('#ecran-fin');
  ecran.dataset.fin = resultat.id;
  ecran.dataset.anticipee = String(resultat.anticipee);
  $('#fin-profil').textContent = app.courant.scenario.profil.nom ?? app.courant.id;
  $('#fin-titre').textContent = resultat.titre ?? '';
  $('#fin-texte').textContent = resultat.texte ?? '';
  $('#fin-anticipee').hidden = !resultat.anticipee;
  $('[data-score="redressement"]').textContent = nombre.format(resultat.redressement);
  $('[data-score="bons"]').textContent = String(resultat.bonsReflexes);
  $('[data-score="scenes"]').textContent = String(resultat.scenesJouees);
  // Seule une partie terminée normalement compte pour le meilleur score (EX-036).
  const meilleur = resultat.anticipee ? lireMeilleurs()[app.courant.id] : enregistrerMeilleur(app.courant.id, resultat.redressement);
  $('#fin-meilleur').hidden = !Number.isFinite(meilleur);
  if (Number.isFinite(meilleur)) $('[data-score="meilleur"]').textContent = nombre.format(meilleur);
  afficherEcran('ecran-fin');
  focaliser($('#fin-titre'));
}

// ------------------------------------------------------------------ démarrage

function remplirTextesCommuns() {
  document.title = app.titre ?? document.title;
  $('#titre-jeu').textContent = app.titre ?? '';
  const avert = $('#gabarit-avertissement').content.textContent.trim().replace('{date}', dateFr(app.dateVerification));
  for (const p of $$('[data-avertissement]')) p.textContent = avert;
}

async function demarrer() {
  $('#bouton-commencer').addEventListener('click', ecranChoix);
  $('#bouton-retour-titre').addEventListener('click', ecranTitre);
  $('#bouton-suivant').addEventListener('click', suivant);
  $('#bouton-rejouer').addEventListener('click', () => commencer(app.courant.id));
  $('#bouton-changer').addEventListener('click', ecranChoix);
  try {
    await charger();
  } catch (e) {
    console.warn(`chargement des donnees impossible : ${e.message}`);
    afficherEcran('ecran-erreur');
    document.body.dataset.pret = 'erreur';
    return;
  }
  remplirTextesCommuns();
  ecranTitre();
  document.body.dataset.pret = 'oui';
}

demarrer();
