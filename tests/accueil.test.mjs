// EX-130 : bouton « Accueil » pendant la partie, avec confirmation dans un <dialog> natif.
// Le site est servi avec la CSP de production (EX-105) : aucune erreur console tolérée,
// donc aucun style ni script en ligne. Données de démonstration (tests/donnees).
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { nouvellePartie, resoudre } from '../js/moteur.js';
import { CSP } from '../outils/construire.mjs';
import { DEPOT, DONNEES_DEMO, chargerScenario } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { tolerance404Variantes, ecran, texte, visible, avertissementAttendu, allerAuChoix, verifierJauges, suiteDe, jouerPartie } from './partie.mjs';

const CLE = 'fiscfiction.meilleur';
const PROFIL = 'demo-fleuriste';
const MESSAGE = 'Quitter la partie ? Elle ne sera pas enregistrée.';
let nav;
let srv;
const pages = [];

before(async () => {
  trouverChrome(); // échec explicite si le navigateur manque
  srv = await servir(DEPOT, {}, { entetes: { 'Content-Security-Policy': CSP } });
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  await srv?.fermer();
});

// Après chaque test : 0 erreur console (dont les violations de CSP), 0 requête hors origine.
afterEach(async () => {
  const bilan = [];
  for (const p of pages.splice(0)) {
    bilan.push({ erreurs: p.erreurs.filter((e) => !tolerance404Variantes.test(e)), externes: p.requetesExternes(srv.origine) });
    await p.fermer();
  }
  for (const { erreurs, externes } of bilan) {
    assert.deepEqual(erreurs, [], 'erreurs console (CSP comprise)');
    assert.deepEqual(externes, [], 'requetes hors origine locale');
  }
});

async function page(options) {
  const p = await nav.nouvellePage(options);
  pages.push(p);
  await p.aller(`${srv.origine}/?donnees=tests/donnees`);
  await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
  const csp = await p.eval(`fetch(location.href).then((r) => r.headers.get('content-security-policy'))`);
  assert.equal(csp, CSP, 'page servie avec la CSP de production');
  return p;
}

const boiteOuverte = (p) => p.eval(`document.querySelector('#confirmer-accueil').open`);
// L'évènement `close` du <dialog> est traité après la fermeture : on attend que le focus soit
// revenu sur le bouton Accueil (fin du traitement), sinon l'état comparé serait celui d'avant.
const attendreRetourPartie = (p, quoi) => p.attendre(
  `!document.querySelector('#confirmer-accueil').open && document.activeElement?.id === 'bouton-accueil'`, quoi);
const scrollLargeur = (p) => p.eval('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)');
const focusDansBoite = (p) => p.eval(`document.querySelector('#confirmer-accueil').contains(document.activeElement)`);
const etatEcran = (p) => p.eval(`({ ecran: document.body.dataset.ecran, scene: document.querySelector('#scene').dataset.scene,
  sceneVisible: !document.querySelector('#scene').hidden, encadreVisible: !document.querySelector('#encadre').hidden,
  choix: document.querySelector('#encadre').dataset.choix ?? null, texte: document.querySelector('#scene-texte').textContent,
  chapitre: document.querySelector('#partie-chapitre').textContent })`);

/**
 * Démarre une partie et joue `n` étapes (premier choix) pour quitter l'état initial des jauges.
 * Renvoie l'état moteur attendu après ces étapes.
 */
async function partieEntamee(p, n = 1) {
  await allerAuChoix(p);
  await p.cliquer(`.carte-profil[data-profil="${PROFIL}"]`);
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie');
  const { scenario } = chargerScenario(DONNEES_DEMO, PROFIL);
  const suite = suiteDe(DONNEES_DEMO, PROFIL, 0);
  let etat = nouvellePartie(scenario);
  for (const idChoix of suite.slice(0, n)) {
    await p.attendre(`!!document.querySelector('#scene-choix .choix[data-choix="${idChoix}"]')`, idChoix);
    await p.cliquer(`#scene-choix .choix[data-choix="${idChoix}"]`);
    await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
    etat = resoudre(etat, idChoix);
    await p.cliquer('#bouton-suivant');
    await p.attendre(`!document.querySelector('#scene').hidden`, 'scene suivante');
  }
  return { etat, scenario, suite };
}

async function ouvrirBoite(p) {
  assert.equal(await visible(p, '#bouton-accueil'), true, 'bouton Accueil visible dans l\'en-tete');
  await p.cliquer('#bouton-accueil');
  await p.attendre(() => boiteOuverte(p), 'boite ouverte');
  assert.equal(await p.eval(`document.querySelector('#confirmer-accueil').matches(':modal')`), true, 'dialog modal natif');
  assert.equal(await texte(p, '#confirmer-accueil-texte'), MESSAGE);
  assert.equal(await texte(p, '#bouton-quitter'), 'Quitter');
  assert.equal(await texte(p, '#bouton-continuer'), 'Continuer la partie');
  assert.equal(await focusDansBoite(p), true, 'focus place dans la boite');
}

test('EX-130 : bouton Accueil dans l\'en-tete de la scene et de l\'encadre, atteignable', async () => {
  const p = await page();
  await partieEntamee(p, 0);
  assert.equal(await p.eval(`!!document.querySelector('#ecran-partie > header #bouton-accueil')`), true, 'dans l\'en-tete');
  assert.equal(await visible(p, '#bouton-accueil'), true, 'sur la scene');
  assert.equal(await p.eval(`document.querySelector('#bouton-accueil').tagName`), 'BUTTON');
  // Après un choix, l'encadré est affiché : le bouton reste visible.
  const idChoix = suiteDe(DONNEES_DEMO, PROFIL, 0)[0];
  await p.cliquer(`#scene-choix .choix[data-choix="${idChoix}"]`);
  await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
  assert.equal(await visible(p, '#bouton-accueil'), true, 'sur l\'encadre');
  assert.equal(await boiteOuverte(p), false, 'boite fermee par defaut');
});

test('EX-130 : Accueil puis Continuer -> meme scene, memes jauges (scene puis encadre)', async () => {
  const p = await page();
  const { etat, suite } = await partieEntamee(p, 2);
  const avant = await etatEcran(p);
  assert.equal(avant.ecran, 'ecran-partie');
  await ouvrirBoite(p);
  await p.cliquer('#bouton-continuer');
  await attendreRetourPartie(p, 'boite fermee');
  assert.deepEqual(await etatEcran(p), avant, 'meme scene');
  await verifierJauges(p, etat, 'apres Continuer (scene)');
  assert.equal(await p.eval(`document.activeElement.id`), 'bouton-accueil', 'focus rendu au bouton Accueil');

  // La partie se poursuit normalement : choix suivant, puis Accueil/Continuer sur l'encadré.
  const idChoix = suite[2];
  await p.cliquer(`#scene-choix .choix[data-choix="${idChoix}"]`);
  await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
  const etat2 = resoudre(etat, idChoix);
  const avantEncadre = await etatEcran(p);
  await ouvrirBoite(p);
  await p.cliquer('#bouton-continuer');
  await attendreRetourPartie(p, 'boite fermee');
  assert.deepEqual(await etatEcran(p), avantEncadre, 'meme encadre');
  await verifierJauges(p, etat2, 'apres Continuer (encadre)');
});

test('EX-130 : Accueil puis Quitter -> ecran titre avec avertissement, cle fiscfiction.meilleur inchangee', async () => {
  const p = await page();
  const stock = JSON.stringify({ [PROFIL]: 123456, 'demo-glacier': 7890 });
  await p.eval(`localStorage.setItem(${JSON.stringify(CLE)}, ${JSON.stringify(stock)})`);
  await partieEntamee(p, 1);
  await ouvrirBoite(p);
  await p.cliquer('#bouton-quitter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-titre'`, 'ecran titre');
  assert.equal(await boiteOuverte(p), false);
  assert.equal(await visible(p, '#ecran-titre [data-avertissement]'), true, 'avertissement EX-004 visible');
  assert.equal(await texte(p, '#ecran-titre [data-avertissement]'), avertissementAttendu(DONNEES_DEMO));
  assert.equal(await visible(p, '#ecran-partie'), false);
  assert.deepEqual(await p.eval(`Object.keys(localStorage)`), [CLE]);
  assert.equal(await p.eval(`localStorage.getItem(${JSON.stringify(CLE)})`), stock, 'meilleur score inchange');
  // Une nouvelle partie repart du début.
  await allerAuChoix(p);
  await p.cliquer(`.carte-profil[data-profil="${PROFIL}"]`);
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'nouvelle partie');
  const { scenario } = chargerScenario(DONNEES_DEMO, PROFIL);
  assert.equal(await p.eval(`document.querySelector('#scene').dataset.scene`), scenario.chapitres[0].scenes[0].id);
  await verifierJauges(p, nouvellePartie(scenario), 'nouvelle partie');
});

test('EX-130 : Echap ferme la boite sans rien changer', async () => {
  const p = await page();
  const { etat } = await partieEntamee(p, 1);
  const avant = await etatEcran(p);
  await ouvrirBoite(p);
  await p.touche('Escape');
  await attendreRetourPartie(p, 'boite fermee par Echap');
  // Laisse passer un éventuel traitement tardif avant de comparer.
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await etatEcran(p), avant);
  await verifierJauges(p, etat, 'apres Echap');
  // La boîte se rouvre ensuite normalement (pas d'état résiduel).
  await ouvrirBoite(p);
  await p.cliquer('#bouton-continuer');
  await attendreRetourPartie(p, 'boite refermee');
});

test('EX-130 : parcours au clavier (Tab, Entree), focus visible', async () => {
  const p = await page();
  await partieEntamee(p, 1);
  await p.eval(`document.activeElement?.blur(); window.scrollTo(0, 0)`);
  const actif = () => p.eval(`(() => { const e = document.activeElement; const s = getComputedStyle(e);
    return { id: e.id, contour: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, focusVisible: e.matches(':focus-visible') }; })()`);
  const tabJusqua = async (id) => {
    for (let i = 0; i < 30; i += 1) {
      await p.touche('Tab');
      const a = await actif();
      if (a.id === id) return a;
    }
    throw new Error(`clavier : #${id} jamais atteint par Tab`);
  };
  let a = await tabJusqua('bouton-accueil');
  assert.ok(a.focusVisible && a.contour, 'focus visible sur Accueil');
  await p.touche('Enter');
  await p.attendre(() => boiteOuverte(p), 'boite ouverte au clavier');
  assert.equal(await focusDansBoite(p), true, 'focus dans la boite');
  // Tab reste dans la boîte modale et atteint « Quitter ».
  a = await tabJusqua('bouton-quitter');
  assert.ok(a.focusVisible && a.contour, 'focus visible sur Quitter');
  assert.equal(await focusDansBoite(p), true);
  await p.touche('Enter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-titre'`, 'titre au clavier');
});

test('EX-130 : ecran de fin : Accueil ramene directement a l\'ecran titre', async () => {
  const p = await page();
  await allerAuChoix(p);
  await jouerPartie(p, DONNEES_DEMO, PROFIL, suiteDe(DONNEES_DEMO, PROFIL, 0));
  assert.equal(await ecran(p), 'ecran-fin');
  assert.equal(await visible(p, '#bouton-accueil-fin'), true);
  const stock = await p.eval(`localStorage.getItem(${JSON.stringify(CLE)})`);
  await p.cliquer('#bouton-accueil-fin');
  await p.attendre(`document.body.dataset.ecran === 'ecran-titre'`, 'ecran titre');
  assert.equal(await boiteOuverte(p), false, 'aucune confirmation sur l\'ecran de fin');
  assert.equal(await visible(p, '#ecran-titre [data-avertissement]'), true);
  assert.equal(await p.eval(`localStorage.getItem(${JSON.stringify(CLE)})`), stock);
});

test('EX-130 : 375x740 : boite entierement visible, sans defilement horizontal', async () => {
  const p = await page({ largeur: 375, hauteur: 740 });
  await partieEntamee(p, 1);
  assert.ok(await scrollLargeur(p) <= 375, 'scene');
  await ouvrirBoite(p);
  assert.ok(await scrollLargeur(p) <= 375, 'boite ouverte');
  const cadres = await p.eval(`['#confirmer-accueil', '#bouton-quitter', '#bouton-continuer'].map((s) => {
    const r = document.querySelector(s).getBoundingClientRect(); return { s, gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom }; })`);
  for (const c of cadres) {
    assert.ok(c.gauche >= 0 && c.droite <= 375 && c.haut >= 0 && c.bas <= 740, `${c.s} hors ecran : ${JSON.stringify(c)}`);
  }
  await p.cliquer('#bouton-quitter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-titre'`, 'titre');
  assert.ok(await scrollLargeur(p) <= 375, 'titre');
});
