// Interface du jeu : écrans, jauges, encadré « loi », animations. Le rendu propre à chaque type de
// scène est délégué aux modules de js/types/ (EX-111) ; aucun texte de contenu ici : les libellés
// sont dans index.html, le contenu dans les JSON de données.
// Dossier de données : `data/` par défaut, ou `?donnees=<chemin relatif>` (tests, copies).
import { assembler, nouvellePartie, resoudre, estTerminee, fin, sceneCourante, trouverChoix, typeDe, sorties, decorTitre, embleme } from './moteur.js';
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
  embleme: null, // contrôleur emblématique de l'écran titre (EX-157), ou null
  presentes: new Set(), // personnages déjà présentés par leur fiche dans la partie en cours (EX-156)
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

/** communs/decors.json est facultatif (EX-150) : absent = aucun décor par défaut. */
async function lireDecors() {
  try {
    return await lireJson('communs/decors.json');
  } catch (e) {
    if (e.status === 404) return { chapitres: {}, titre: null };
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

async function chargerProfil(id, tronc, communs, decors) {
  const profil = await lireJson(`profils/${id}/profil.json`);
  if (profil?.id !== id) throw new Error(`profils/${id}/profil.json : id "${profil?.id}" different du dossier`);
  if (profil.actif !== true) return null;
  const variantes = await lireVariantes(id);
  const scenario = assembler(tronc, profil, variantes, communs, decors);
  verifierScenario(scenario);
  return { id, scenario };
}

async function charger() {
  app.donnees = dossierDonnees();
  const [references, tronc, communs, index, decors] = await Promise.all([
    lireJson('references.json'),
    lireJson('tronc.json'),
    lireJson('communs/personnages.json'),
    lireJson('profils/index.json'),
    lireDecors(),
  ]);
  if (!Array.isArray(index)) throw new Error('profils/index.json : tableau attendu');
  app.references = new Map((references.references ?? []).map((r) => [r.id, r]));
  app.dateVerification = references.date_verification;
  app.titre = tronc.titre;
  app.decorTitre = decorTitre(decors);
  app.embleme = embleme(communs);

  const resultats = await Promise.all(index.map((id) => chargerProfil(id, tronc, communs, decors).then(
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

const CIVILITES = new Set(['m', 'mme', 'mlle', 'me', 'dr', 'pr']);

/** Initiales d'un nom pour le disque de repli (EX-152) : « Mme Démo Pistil » -> « DP ». */
function initiales(nom) {
  const mots = String(nom ?? '').split(/[\s-]+/).filter((m) => m && !CIVILITES.has(m.replace(/\.$/, '').toLowerCase()));
  const lettres = mots.length > 1 ? [mots[0], mots[mots.length - 1]] : mots;
  return lettres.map((m) => m[0].toLocaleUpperCase('fr-FR')).join('') || '?';
}

/** Dernier repli d'un portrait (EX-152) : les initiales dans un disque, même rôle et même nom accessible. */
function remplacerParInitiales(img, personnage) {
  const disque = document.createElement('span');
  disque.className = `${img.className} portrait-initiales`;
  disque.setAttribute('role', 'img');
  disque.setAttribute('aria-label', personnage.nom ?? '');
  disque.dataset.repli = 'initiales';
  disque.textContent = initiales(personnage.nom);
  img.replaceWith(disque);
}

/**
 * Portrait d'un personnage (EX-034, EX-152) : image illustrée `.webp`, puis le SVG de même nom si elle
 * manque ou échoue, puis les initiales dans un disque. role="img" et aria-label = nom dans tous les cas.
 */
function portrait(img, personnage) {
  img.alt = personnage.nom ?? '';
  img.setAttribute('role', 'img');
  img.setAttribute('aria-label', personnage.nom ?? '');
  img.onerror = () => {
    if (personnage.repli && img.dataset.repli !== 'svg') {
      img.dataset.repli = 'svg';
      img.src = cheminDonnee(personnage.repli);
    } else {
      img.onerror = null;
      remplacerParInitiales(img, personnage);
    }
  };
  img.src = cheminDonnee(personnage.portrait);
}

/** Image neuve d'un emplacement de portrait ou d'illustration (le repli par initiales remplace l'élément). */
function nouvelleImage(classe) {
  const img = $('#gabarit-portrait').content.firstElementChild.cloneNode(true);
  img.className = classe;
  return img;
}

/**
 * Illustration en pied d'un personnage (EX-156), sinon portrait : sans illustration, ou si elle ne se
 * charge pas, l'interface ne montre que le portrait de `repli` (le personnage lui-même par défaut).
 * role="img" et aria-label = nom du personnage affiché dans les deux cas. Renvoie true si l'illustration est demandée.
 */
function illustrationOuPortrait(img, personnage, { classeIllustration, classePortrait, repli = personnage }) {
  const [largeur, hauteur] = [img.width, img.height];
  const versPortrait = () => {
    img.onerror = null;
    delete img.dataset.illustration;
    img.className = classePortrait;
    img.width = largeur;
    img.height = hauteur;
    portrait(img, repli);
  };
  if (!personnage?.illustration) {
    versPortrait();
    return false;
  }
  img.className = classeIllustration;
  img.dataset.illustration = 'oui';
  img.alt = personnage.nom ?? '';
  img.setAttribute('role', 'img');
  img.setAttribute('aria-label', personnage.nom ?? '');
  img.width = 768;
  img.height = 1024;
  img.decoding = 'async';
  img.onerror = versPortrait;
  img.src = cheminDonnee(personnage.illustration);
  return true;
}

// ------------------------------------------------------------------ décor (EX-150, EX-151)

const decor = { courant: null, precharges: new Set() };

/**
 * Décor de fond (chemin relatif aux données, ou null = fond uni). Deux images superposées : la nouvelle
 * apparaît en fondu (CSS, <= 300 ms, coupé sous prefers-reduced-motion) une fois chargée.
 */
function afficherDecor(rel) {
  const src = rel ? url(rel) : null;
  if (src === decor.courant) return;
  decor.courant = src;
  const conteneur = $('#decor');
  conteneur.dataset.decor = rel ?? '';
  document.body.classList.toggle('avec-decor', src !== null);
  const images = $$('.decor-image', conteneur);
  const visible = images.find((i) => i.classList.contains('decor-visible')) ?? null;
  if (src === null) {
    for (const i of images) i.classList.remove('decor-visible');
    return;
  }
  const suivante = images.find((i) => i !== visible);
  const montrer = () => {
    if (decor.courant !== src) return;
    suivante.classList.add('decor-visible');
    visible?.classList.remove('decor-visible');
  };
  suivante.onload = montrer;
  suivante.onerror = () => {
    if (decor.courant === src) visible?.classList.remove('decor-visible'); // fond uni plutôt qu'un décor périmé
  };
  if (suivante.getAttribute('src') === src && suivante.complete && suivante.naturalWidth > 0) montrer();
  else suivante.src = src;
}

/** Précharge une image (décor de la scène suivante) sans l'afficher. */
function precharger(rel) {
  const src = rel ? url(rel) : null;
  if (!src || src === decor.courant || decor.precharges.has(src)) return;
  decor.precharges.add(src);
  const i = new Image();
  i.decoding = 'async';
  i.src = src;
}

/** Décors des scènes qui peuvent suivre la scène courante (EX-151 : décor suivant préchargé). */
function prechargerSuivants(scene) {
  const scenario = app.courant.scenario;
  const chapitre = scenario.chapitres[app.etat.chapitre];
  for (const s of sorties(scene)) {
    const cible = s.suivant
      ? chapitre.scenes.find((x) => x.id === s.suivant)
      : scenario.chapitres[app.etat.chapitre + 1]?.scenes[0];
    if (cible?.decor && cible.decor !== scene.decor) precharger(cible.decor);
  }
}

function afficherEcran(id) {
  for (const s of $$('.ecran')) s.hidden = s.id !== id;
  $('#chargement').hidden = true;
  document.body.dataset.ecran = id;
  // Titre et choix du profil : couverture (EX-153 : seule image de décor chargée avant la partie).
  // Partie : décor de la scène (afficherScene) ; fin : le dernier décor reste ; erreur : fond uni.
  if (id === 'ecran-titre' || id === 'ecran-choix') afficherDecor(app.decorTitre);
  else if (id === 'ecran-erreur') afficherDecor(null);
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
    // Carte (EX-156) : illustration du personnage `joueur` du profil ; sans elle, portrait du vérificateur.
    const verif = scenario.personnages.roles.verificateur;
    illustrationOuPortrait($('.carte-portrait', li), scenario.personnages.roles.joueur, {
      classeIllustration: 'carte-illustration', classePortrait: 'carte-portrait portrait', repli: verif,
    });
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
  app.presentes = new Set();
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

/** Clé d'un personnage pour la fiche de présentation : un même personnage n'est présenté qu'une fois par partie. */
const clePersonnage = (p) => `${p.id}|${p.portrait ?? ''}`;

/**
 * Fiche de présentation (EX-156) : illustration + portrait + nom + une ligne de description, avant la
 * première réplique d'un personnage illustré. Fermée par « Suivant » ou Échap ; la scène s'affiche ensuite.
 */
function presenter(personnage, idScene) {
  app.presentes.add(clePersonnage(personnage));
  const fiche = $('#fiche');
  fiche.dataset.personnage = personnage.id;
  fiche.dataset.scene = idScene;
  const images = $('#fiche-images');
  const illu = nouvelleImage('fiche-illustration');
  illu.alt = '';
  illu.removeAttribute('role');
  illu.setAttribute('aria-hidden', 'true'); // décrite par le portrait et le nom de la fiche
  illu.width = 768;
  illu.height = 1024;
  illu.decoding = 'async';
  illu.onerror = () => illu.remove(); // illustration introuvable : la fiche garde le portrait
  illu.src = cheminDonnee(personnage.illustration);
  const cadre = document.createElement('span');
  cadre.className = 'fiche-portrait-cadre';
  if (personnage.portrait) {
    const img = nouvelleImage('fiche-portrait portrait');
    cadre.append(img);
    portrait(img, personnage);
  }
  images.replaceChildren(illu, cadre);
  $('#fiche-nom').textContent = personnage.nom ?? '';
  const desc = $('#fiche-description');
  desc.textContent = personnage.description ?? '';
  desc.hidden = !personnage.description;
  $('#scene').hidden = true;
  $('#encadre').hidden = true;
  fiche.hidden = false;
  window.scrollTo(0, 0);
  focaliser($('#fiche-nom'));
}

function fermerFiche() {
  if ($('#fiche').hidden) return;
  $('#fiche').hidden = true;
  afficherScene();
}

function afficherScene() {
  const scenario = app.courant.scenario;
  const scene = sceneCourante(app.etat);
  $('#partie-chapitre').textContent = scenario.chapitres[app.etat.chapitre].titre ?? '';
  afficherDecor(scene.decor ?? null);
  prechargerSuivants(scene);
  majJauges(app.etat.jauges);
  const orateur = scene.personnage;
  if (orateur.role !== 'narrateur' && orateur.illustration && !app.presentes.has(clePersonnage(orateur))) {
    presenter(orateur, scene.id);
    return;
  }
  $('#fiche').hidden = true;
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
  if (!$('#encadre').hidden || !$('#fiche').hidden) return;
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
  // Vérificateur du profil (EX-156) : son illustration en pied, sinon son portrait.
  const img = nouvelleImage('fin-portrait portrait');
  $('#fin-verificateur').replaceChildren(img);
  illustrationOuPortrait(img, app.courant.scenario.personnages.roles.verificateur, {
    classeIllustration: 'fin-illustration', classePortrait: 'fin-portrait portrait',
  });
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

// ------------------------------------------------------------------ retour à l'accueil (EX-130)

/** Accueil pendant une partie : confirmation dans un <dialog> modal natif (focus dans la boîte, Échap = annuler). */
function demanderAccueil() {
  const boite = $('#confirmer-accueil');
  if (!boite.open) boite.showModal();
}

/** « Quitter » : écran titre ; la partie en cours est abandonnée, le meilleur score n'est pas touché. */
function quitterPartie() {
  $('#confirmer-accueil').close('quitter');
}

/** « Continuer la partie » : referme la boîte sans rien changer. */
function continuerPartie() {
  $('#confirmer-accueil').close('continuer');
}

/** Fermeture de la boîte (boutons ou Échap) : titre si « Quitter », sinon retour au bouton Accueil. */
function boiteFermee() {
  const boite = $('#confirmer-accueil');
  const choix = boite.returnValue;
  boite.returnValue = '';
  if (choix === 'quitter') {
    app.etat = null;
    ecranTitre();
  } else {
    focaliser($('#bouton-accueil'));
  }
}

// ------------------------------------------------------------------ démarrage

function remplirTextesCommuns() {
  document.title = app.titre ?? document.title;
  $('#titre-jeu').textContent = app.titre ?? '';
  const avert = $('#gabarit-avertissement').content.textContent.trim().replace('{date}', dateFr(app.dateVerification));
  for (const p of $$('[data-avertissement]')) p.textContent = avert;
  // Contrôleur emblématique (EX-157) : illustration en pied héroïque, sinon portrait ; rien s'il n'est pas déclaré.
  const fig = $('#titre-embleme');
  fig.hidden = app.embleme === null;
  if (app.embleme) {
    const img = nouvelleImage('embleme-portrait portrait');
    fig.replaceChildren(img);
    illustrationOuPortrait(img, app.embleme, { classeIllustration: 'embleme-illustration', classePortrait: 'embleme-portrait portrait' });
  }
}

async function demarrer() {
  $('#bouton-commencer').addEventListener('click', ecranChoix);
  $('#bouton-retour-titre').addEventListener('click', ecranTitre);
  $('#bouton-suivant').addEventListener('click', suivant);
  $('#bouton-fiche-suivant').addEventListener('click', fermerFiche);
  // Échap ferme la fiche de présentation (sauf si la boîte de confirmation, modale, est ouverte).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#fiche').hidden && !$('#confirmer-accueil').open) {
      e.preventDefault();
      fermerFiche();
    }
  });
  $('#bouton-rejouer').addEventListener('click', () => commencer(app.courant.id));
  $('#bouton-changer').addEventListener('click', ecranChoix);
  $('#bouton-accueil').addEventListener('click', demanderAccueil);
  $('#bouton-accueil-fin').addEventListener('click', ecranTitre); // fin de partie : rien à perdre
  $('#bouton-quitter').addEventListener('click', quitterPartie);
  $('#bouton-continuer').addEventListener('click', continuerPartie);
  $('#confirmer-accueil').addEventListener('close', boiteFermee);
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
