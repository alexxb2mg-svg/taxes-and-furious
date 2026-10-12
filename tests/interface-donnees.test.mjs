// Tests d'interface sur le contenu réel de data/ (C4, EX-032 / EX-033 / EX-035 / EX-050 / EX-004) :
// chaque fin de chaque profil jouée dans le navigateur headless avec les suites de tests/suites-fins.mjs,
// vérification scène par scène contre le moteur (orateur, jauges, encadré loi, fin).
// Une partie par profil est aussi jouée en 375x740 sans défilement horizontal.
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOT, DONNEES, chargerScenario, lireJson } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { tolerance404Variantes, ecran, texte, visible, avertissementAttendu, allerAuChoix, cartes, jouerPartie, suitesParFin, imageCarte } from './partie.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

const INDEX = lireJson(DONNEES, 'profils/index.json');
// Seuls les profils actifs sont proposés et joués (EX-050 / EX-052) ; un profil désactivé
// (guide, « Modifier ou désactiver ») ne doit pas faire échouer la suite.
const actif = (id) => lireJson(DONNEES, `profils/${id}/profil.json`).actif === true;
const IDS = INDEX.filter(actif);
const INACTIFS = INDEX.filter((id) => !actif(id));
// Suites figees pour les 6 profils initiaux ; un profil ajoute (guide) est explore automatiquement.
const suitesDe = (id) => SUITES_FINS[id] ?? suitesParFin(DONNEES, id);
let nav;
let srv;
const pages = [];

before(async () => {
  trouverChrome(); // échec explicite si le navigateur manque
  srv = await servir(DEPOT);
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  await srv?.fermer();
});

// Sur data/ réel, chaque profil a son variantes.json : aucune tolérance console n'est nécessaire,
// on vérifie quand même qu'aucune 404 de variantes n'apparaît.
afterEach(async () => {
  const bilan = [];
  for (const p of pages.splice(0)) {
    bilan.push({ erreurs: p.erreurs, externes: p.requetesExternes(srv.origine) });
    await p.fermer();
  }
  for (const { erreurs, externes } of bilan) {
    assert.deepEqual(erreurs, [], 'erreurs console (aucune tolerance sur data/)');
    assert.equal(erreurs.some((e) => tolerance404Variantes.test(e)), false);
    assert.deepEqual(externes, [], 'requetes hors origine locale (EX-030)');
  }
});

async function page(options) {
  const p = await nav.nouvellePage(options);
  pages.push(p);
  await p.aller(`${srv.origine}/`); // sans ?donnees= : data/ par défaut
  await p.attendre('document.body.dataset.pret', 'interface prete');
  assert.equal(await p.eval('document.body.dataset.pret'), 'oui');
  return p;
}

test('data/ EX-004 / EX-050 : titre, avertissement date, une carte par profil l\'ordre de index.json avec portrait du verificateur', async () => {
  const p = await page();
  await p.eval('localStorage.clear()');
  assert.equal(await ecran(p), 'ecran-titre');
  assert.equal(await texte(p, '#titre-jeu'), lireJson(DONNEES, 'tronc.json').titre);
  // EX-122 : titre du jeu, a l'ecran et dans l'onglet.
  assert.equal(await texte(p, '#titre-jeu'), 'Taxes & Furious');
  assert.equal(await p.eval('document.title'), 'Taxes & Furious');
  assert.equal(await texte(p, '#ecran-titre [data-avertissement]'), avertissementAttendu(DONNEES));
  await allerAuChoix(p);
  await p.attendre(`[...document.querySelectorAll('#liste-profils img')].every((i) => i.complete)`, 'portraits des cartes');
  const vues = await cartes(p);
  assert.deepEqual(vues.map((c) => c.id), IDS);
  for (const id of INACTIFS) assert.equal(vues.some((c) => c.id === id), false, `${id} inactif : aucune carte`);
  for (const c of vues) {
    const { scenario, profil } = chargerScenario(DONNEES, c.id);
    assert.equal(c.nom, profil.nom);
    assert.equal(c.entreprise, profil.entreprise);
    assert.equal(c.accroche, profil.accroche);
    // EX-156 a : illustration du joueur du profil, sinon portrait du verificateur.
    const attendu = imageCarte(scenario);
    assert.equal(c.portrait, `data/${attendu.src}`);
    assert.equal(c.role, 'img');
    assert.equal(c.label, attendu.label, `${c.id} : aria-label = nom du personnage montre (EX-034)`);
    assert.equal(c.charge, true, `portrait de ${c.id} charge`);
    assert.equal(c.meilleur, null, `${c.id} : aucun meilleur score apres localStorage.clear()`);
  }
  assert.equal(await visible(p, '#profils-indisponibles'), false);
});

for (const id of IDS) {
  test(`data/ ${id} : chaque fin atteinte dans le navigateur (suites de tests/suites-fins.mjs ou exploration), ecran de fin complet`, async () => {
    const suites = suitesDe(id);
    assert.ok(Object.keys(suites).length >= 3, `${id} : au moins 2 fins propres + fins communes`);
    const p = await page();
    await p.eval('localStorage.clear()');
    await allerAuChoix(p);
    const atteintes = [];
    let meilleur = Infinity;
    for (const [idFin, suite] of Object.entries(suites)) {
      const { resultat, vus } = await jouerPartie(p, DONNEES, id, suite);
      assert.equal(resultat.id, idFin, `${id} : fin attendue ${idFin}`);
      assert.equal(resultat.anticipee, idFin === 'fin-patience');
      assert.ok(vus.roles.verificateur?.size > 0, `${id} : le verificateur a parle`);
      atteintes.push(resultat.id);
      if (!resultat.anticipee) meilleur = Math.min(meilleur, resultat.redressement);
      // Écran de fin (EX-033 / EX-004) : avertissement daté, Rejouer et Changer de profil.
      assert.equal(await texte(p, '#ecran-fin [data-avertissement]'), avertissementAttendu(DONNEES));
      assert.equal(await visible(p, '#bouton-rejouer'), true);
      assert.equal(await visible(p, '#bouton-changer'), true);
      await p.cliquer('#bouton-changer');
      await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'retour au choix');
    }
    assert.deepEqual(atteintes.sort(), Object.keys(suites).sort());
    // EX-036 sur données réelles : la carte affiche le plus petit redressement hors fin anticipée.
    const carte = (await cartes(p)).find((c) => c.id === id);
    assert.equal(Number(carte.meilleur.replace(/\D/g, '')), meilleur);
  });
}

test('data/ EX-035 : une partie complete par profil en 375x740 sans defilement horizontal', async () => {
  const p = await page({ largeur: 375, hauteur: 740 });
  const largeur = async (quoi) => {
    const w = await p.eval('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)');
    assert.ok(w <= 375, `${quoi} : scrollWidth ${w} > 375`);
  };
  await largeur('titre');
  await allerAuChoix(p);
  await largeur('choix');
  for (const id of IDS) {
    const suites = suitesDe(id);
    const idFin = Object.keys(suites).find((f) => f !== 'fin-patience'); // partie complète, pas anticipée
    const { resultat } = await jouerPartie(p, DONNEES, id, suites[idFin], { largeurMax: 375 });
    assert.equal(resultat.id, idFin);
    await p.cliquer('#bouton-changer');
    await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'retour au choix');
  }
});
