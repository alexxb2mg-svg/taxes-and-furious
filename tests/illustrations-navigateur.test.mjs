// Personnages illustres a l'ecran (EX-156, EX-157) dans le navigateur, servis avec la politique de
// securite du contenu du site (outils/construire.mjs) : une violation CSP est une erreur console.
// Donnees : copies de tests/donnees avec des images d'essai (tests/donnees/art/situation-essai*.webp) ;
// les profil.json de data/ ne sont pas touches. Le navigateur est obligatoire (tests jamais sautes).
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOT, DONNEES_DEMO, chargerScenario, copieTemporaire, appliquerModifs } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { ENTETES } from '../outils/construire.mjs';
import { tolerance404Variantes, ecran, allerAuChoix, cartes, jouerPartie, suiteDe, etatFiche, imageCarte } from './partie.mjs';

const montages = {};
let nav;
let srv;
const pages = [];
const nettoyages = [];

before(async () => {
  trouverChrome();
  srv = await servir(DEPOT, montages, { entetes: ENTETES });
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  await srv?.fermer();
});

// Apres chaque test : 0 erreur console (CSP comprise) hors tolerances declarees, 0 requete hors origine.
const tolerances = [];
afterEach(async () => {
  const bilan = [];
  for (const p of pages.splice(0)) {
    bilan.push({ erreurs: p.erreurs.filter((e) => !tolerance404Variantes.test(e) && !tolerances.some((t) => t.test(e))), externes: p.requetesExternes(srv.origine) });
    await p.fermer();
  }
  tolerances.length = 0;
  for (const n of nettoyages.splice(0)) n();
  for (const { erreurs, externes } of bilan) {
    assert.deepEqual(erreurs, [], 'erreurs console (dont CSP)');
    assert.deepEqual(externes, [], 'requetes hors origine locale (EX-030)');
  }
});

async function page(options) {
  const p = await nav.nouvellePage(options);
  pages.push(p);
  return p;
}

const FLEURISTE = 'profils/demo-fleuriste';

/**
 * Fleuriste illustree : la verificatrice (pistil) a son illustration, et le profil declare son propre
 * personnage `joueur` (rose) avec portrait et illustration. Le glacier reste sans illustration.
 */
const ILLUSTREE = [
  { fichier: `${FLEURISTE}/img/pistil-situation.webp`, copier: 'tests/donnees/art/situation-essai.webp' },
  { fichier: `${FLEURISTE}/img/rose-situation.webp`, copier: 'tests/donnees/art/situation-essai-2.webp' },
  { fichier: `${FLEURISTE}/img/rose.webp`, copier: `tests/donnees/${FLEURISTE}/img/pistil.webp` },
  { fichier: `${FLEURISTE}/profil.json`, chemin: ['personnages', 0, 'illustration'], valeur: 'img/pistil-situation.webp' },
  {
    fichier: `${FLEURISTE}/profil.json`,
    chemin: ['personnages', 2],
    valeur: {
      id: 'rose',
      role: 'joueur',
      nom: 'Rose Démo',
      description: 'Fleuriste de démonstration, sécateur dans une main, ticket de caisse dans l’autre.',
      portrait: 'img/rose.webp',
      illustration: 'img/rose-situation.webp',
    },
  },
];

let compteur = 0;
/** Copie de tests/donnees modifiee, servie sous /illustrations-<n>/ ; renvoie { donnees, racine }. */
function copie(modifs) {
  const c = copieTemporaire(DONNEES_DEMO);
  nettoyages.push(c.nettoyer);
  appliquerModifs(c.racine, modifs);
  compteur += 1;
  const prefixe = `/illustrations-${compteur}/`;
  montages[prefixe] = c.racine;
  nettoyages.push(() => delete montages[prefixe]);
  return { donnees: prefixe.slice(1, -1), racine: c.racine };
}

async function ouvrir(p, donnees) {
  await p.aller(`${srv.origine}/?donnees=${encodeURIComponent(donnees)}`);
  await p.attendre('document.body.dataset.pret', 'interface prete');
  assert.equal(await p.eval('document.body.dataset.pret'), 'oui');
}

/** Toutes les images visibles chargees (decor compris), puis fin des transitions (fondu 250 ms). */
async function imagesChargees(p) {
  await p.attendre(`[...document.images].filter((i) => i.getClientRects().length).every((i) => i.complete)`, 'images chargees');
  await new Promise((r) => setTimeout(r, 350));
}

/** Pas de defilement : document a la taille de la fenetre, et les elements cites entierement visibles. */
async function sansDefilement(p, selecteurs, quoi) {
  const m = await p.eval(`(() => ({
    hauteur: document.documentElement.scrollHeight, largeur: document.documentElement.scrollWidth,
    fenetre: [innerWidth, innerHeight], y: scrollY,
    bas: ${JSON.stringify(selecteurs)}.map((s) => [s, Math.ceil(document.querySelector(s).getBoundingClientRect().bottom)]),
  }))()`);
  assert.equal(m.y, 0, `${quoi} : affiche en haut de page`);
  assert.ok(m.largeur <= m.fenetre[0], `${quoi} : defilement horizontal (${m.largeur} > ${m.fenetre[0]})`);
  assert.ok(m.hauteur <= m.fenetre[1], `${quoi} : defilement vertical (${m.hauteur} > ${m.fenetre[1]})`);
  for (const [s, bas] of m.bas) assert.ok(bas <= m.fenetre[1], `${quoi} : ${s} sort de la fenetre (bas ${bas})`);
}

const ficheVisible = (p) => p.eval(`!document.querySelector('#fiche').hidden`);
const sceneVisible = (p, id) => p.eval(`document.querySelector('#scene').dataset.scene === ${JSON.stringify(id)} && !document.querySelector('#scene').hidden`);

/** Clique le choix `idChoix` de la scene affichee puis « Suivant » de l'encadre. */
async function jouerChoix(p, idChoix) {
  await p.attendre(`!!document.querySelector('#scene-choix .choix[data-choix="${idChoix}"]') && !document.querySelector('#scene').hidden`, idChoix);
  await p.cliquer(`#scene-choix .choix[data-choix="${idChoix}"]`);
  await p.attendre(`!document.querySelector('#encadre').hidden`, `encadre ${idChoix}`);
  await p.cliquer('#bouton-suivant');
}

// ------------------------------------------------------------------ EX-156 a : carte de profil

for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
  test(`EX-156 a : carte = illustration du joueur du profil ; sans illustration, portrait du verificateur (${largeur}x${hauteur})`, async () => {
    const { donnees, racine } = copie(ILLUSTREE);
    const p = await page({ largeur, hauteur });
    await ouvrir(p, donnees);
    await allerAuChoix(p);
    await imagesChargees(p);
    const vues = await cartes(p);
    const classes = await p.eval(`[...document.querySelectorAll('#liste-profils .carte-profil')].map((b) => b.querySelector('[role="img"]').className)`);
    for (const [i, c] of vues.entries()) {
      const { scenario } = chargerScenario(racine, c.id);
      const attendu = imageCarte(scenario);
      assert.equal(c.portrait, `${donnees}/${attendu.src}`, `${c.id} : image de la carte`);
      assert.equal(c.role, 'img');
      assert.equal(c.label, attendu.label, `${c.id} : aria-label = nom du personnage montre`);
      assert.equal(c.charge, true, `${c.id} : image chargee`);
      assert.ok(classes[i].split(' ').includes(attendu.classe), `${c.id} : classe ${classes[i]}`);
    }
    // Le cas illustre et le cas sans illustration sont bien couverts.
    assert.deepEqual(vues.map((c) => c.portrait), [`${donnees}/${FLEURISTE}/img/rose-situation.webp`, `${donnees}/profils/demo-glacier/img/sorbet.svg`]);
    assert.deepEqual(vues.map((c) => c.label), ['Rose Démo', chargerScenario(racine, 'demo-glacier').scenario.personnages.roles.verificateur.nom]);
    // Format 3:4 de l'illustration sur la carte, sans deformation.
    const dims = await p.eval(`(() => { const r = document.querySelector('.carte-illustration').getBoundingClientRect(); return [r.width, r.height, getComputedStyle(document.querySelector('.carte-illustration')).objectFit]; })()`);
    assert.equal(Math.round((dims[0] / dims[1]) * 100) / 100, 0.75, `carte : rapport 3:4 (${dims})`);
    assert.equal(dims[2], 'cover');
    assert.ok(await p.eval('document.documentElement.scrollWidth') <= largeur, 'pas de defilement horizontal');
  });
}

// ------------------------------------------------------------------ EX-156 b : fiche de presentation

for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
  test(`EX-156 b/c : partie complete, fiche a la premiere replique de chaque personnage illustre, fin illustree (${largeur}x${hauteur})`, async () => {
    const { donnees, racine } = copie(ILLUSTREE);
    const p = await page({ largeur, hauteur });
    await ouvrir(p, donnees);
    await allerAuChoix(p);
    // jouerPartie verifie chaque fiche (illustration, portrait, nom, description, focus) et l'ecran de fin.
    const { vus, scenario } = await jouerPartie(p, racine, 'demo-fleuriste', suiteDe(racine, 'demo-fleuriste', 0), { largeurMax: largeur });
    assert.deepEqual(vus.fiches, ['pistil', 'rose'], 'une fiche par personnage illustre, une seule fois chacun');
    assert.equal(scenario.personnages.roles.comptable.illustration, null, 'le comptable sans illustration n\'a pas de fiche');
    // EX-156 c : ecran de fin = illustration de la verificatrice.
    const fin = await p.eval(`(() => { const i = document.querySelector('#fin-verificateur img'); return { src: i.getAttribute('src'), classe: i.className, label: i.getAttribute('aria-label'), charge: i.complete && i.naturalWidth > 0 }; })()`);
    assert.deepEqual(fin, { src: `${donnees}/${FLEURISTE}/img/pistil-situation.webp`, classe: 'fin-illustration', label: 'Mme Démo Pistil', charge: true });
    await imagesChargees(p);
    await sansDefilement(p, ['#fin-verificateur', '#bouton-rejouer', '#bouton-changer'], 'ecran de fin illustre');
  });
}

for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
  test(`EX-156 b : fiche lisible sans defilement, fermee par Suivant (souris et clavier) ou Echap (${largeur}x${hauteur})`, async () => {
    const { donnees, racine } = copie(ILLUSTREE);
    const { scenario } = chargerScenario(racine, 'demo-fleuriste');
    const pistil = scenario.personnages.profil.pistil;
    const p = await page({ largeur, hauteur });
    await ouvrir(p, donnees);
    await allerAuChoix(p);
    await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
    // avis-s1 : narrateur, pas de fiche.
    await p.attendre(`document.querySelector('#scene').dataset.scene === 'avis-s1' && !document.querySelector('#scene').hidden`, 'avis-s1');
    assert.equal(await ficheVisible(p), false, 'narrateur : pas de fiche');
    await jouerChoix(p, 'avis-s1-a');

    // avis-s2 : premiere replique de la verificatrice -> fiche avant la scene.
    await p.attendre(`!document.querySelector('#fiche').hidden`, 'fiche de pistil');
    assert.equal(await p.eval(`document.querySelector('#scene').hidden`), true, 'la replique attend la fermeture de la fiche');
    await imagesChargees(p);
    const f = await etatFiche(p);
    assert.equal(f.scene, 'avis-s2');
    assert.equal(f.nom, pistil.nom);
    assert.equal(f.description, pistil.description);
    assert.deepEqual(f.illustration, { src: `${donnees}/${pistil.illustration}`, charge: true, cache: 'true' });
    assert.deepEqual(f.portrait, { src: `${donnees}/${pistil.portrait}`, role: 'img', label: pistil.nom, charge: true });
    assert.equal(f.focus, 'fiche-nom', 'focus sur le nom (lecteurs d\'ecran)');
    assert.equal(await p.eval(`document.querySelector('#fiche').getAttribute('aria-labelledby')`), 'fiche-nom');
    await sansDefilement(p, ['#fiche', '#bouton-fiche-suivant'], 'fiche');
    // Un clic sur un choix est impossible pendant la fiche (scene masquee) ; « Suivant » au clavier : Tab puis Entree.
    await p.touche('Tab');
    assert.equal(await p.eval('document.activeElement.id'), 'bouton-fiche-suivant', 'Tab : bouton Suivant');
    await p.touche('Enter');
    await p.attendre(`document.querySelector('#scene').dataset.scene === 'avis-s2' && !document.querySelector('#scene').hidden`, 'scene apres Entree');
    assert.equal(await ficheVisible(p), false);
    assert.equal(await p.eval('document.activeElement.id'), 'scene-texte', 'focus sur la replique');
    await jouerChoix(p, 'avis-s2-a');

    // avis-s3 (comptable sans illustration) puis caisse-s1 (pistil deja presentee) : pas de fiche.
    await p.attendre(`document.querySelector('#scene').dataset.scene === 'avis-s3' && !document.querySelector('#scene').hidden`, 'avis-s3');
    assert.equal(await ficheVisible(p), false, 'comptable sans illustration : pas de fiche');
    await jouerChoix(p, 'avis-s3-a');
    await p.attendre(`document.querySelector('#scene').dataset.scene === 'caisse-s1' && !document.querySelector('#scene').hidden`, 'caisse-s1');
    assert.equal(await ficheVisible(p), false, 'pistil deja presentee : pas de seconde fiche');
    for (const x of ['caisse-s1-a', 'caisse-s2-a', 'fec-s1-a']) await jouerChoix(p, x);

    // fec-s2 : le joueur du profil (rose) -> fiche, fermee par Echap.
    await p.attendre(`!document.querySelector('#fiche').hidden && document.querySelector('#fiche').dataset.scene === 'fec-s2'`, 'fiche de rose');
    assert.equal((await etatFiche(p)).nom, 'Rose Démo');
    await imagesChargees(p);
    await sansDefilement(p, ['#fiche', '#bouton-fiche-suivant'], 'fiche du joueur');
    await p.touche('Escape');
    await p.attendre(`document.querySelector('#scene').dataset.scene === 'fec-s2' && !document.querySelector('#scene').hidden`, 'scene apres Echap');
    assert.equal(await ficheVisible(p), false);
    assert.equal(await p.eval(`document.querySelector('#scene-orateur .orateur-nom').textContent`), 'Rose Démo', 'le joueur du profil parle');

    // Echap ne fait rien hors fiche (la scene reste affichee).
    await p.touche('Escape');
    assert.equal(await sceneVisible(p, 'fec-s2'), true);
  });
}

test('EX-156 b : Echap avec la boite « Accueil » ouverte annule la boite sans fermer la fiche ; une nouvelle partie represente les personnages', async () => {
  const { donnees } = copie(ILLUSTREE);
  const p = await page({ largeur: 1280, hauteur: 800 });
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
  await jouerChoix(p, 'avis-s1-a');
  await p.attendre(`!document.querySelector('#fiche').hidden`, 'fiche');
  await p.cliquer('#bouton-accueil');
  await p.attendre(`document.querySelector('#confirmer-accueil').open`, 'boite ouverte');
  await p.touche('Escape');
  await p.attendre(`!document.querySelector('#confirmer-accueil').open`, 'boite fermee');
  assert.equal(await ficheVisible(p), true, 'la fiche reste ouverte : Echap a seulement annule la boite');
  // Quitter puis rejouer : la fiche revient (une fois par partie).
  await p.cliquer('#bouton-accueil');
  await p.attendre(`document.querySelector('#confirmer-accueil').open`, 'boite ouverte');
  await p.cliquer('#bouton-quitter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-titre'`, 'titre');
  await allerAuChoix(p);
  await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
  assert.equal(await ficheVisible(p), false, 'nouvelle partie : fiche refermee');
  await jouerChoix(p, 'avis-s1-a');
  await p.attendre(`!document.querySelector('#fiche').hidden && document.querySelector('#fiche').dataset.scene === 'avis-s2'`, 'fiche a nouveau');
});

// ------------------------------------------------------------------ sans illustration

test('EX-156 : sans illustration, aucune fiche, carte et fin montrent le portrait (donnees de demonstration brutes)', async () => {
  for (const id of ['demo-fleuriste', 'demo-glacier']) {
    const p = await page({ largeur: 375, hauteur: 740 });
    await ouvrir(p, 'tests/donnees');
    await allerAuChoix(p);
    const { vus, scenario } = await jouerPartie(p, DONNEES_DEMO, id, suiteDe(DONNEES_DEMO, id, 0), { largeurMax: 375 });
    assert.deepEqual(vus.fiches, [], `${id} : aucune fiche sans illustration`);
    const verif = scenario.personnages.roles.verificateur;
    const fin = await p.eval(`(() => { const i = document.querySelector('#fin-verificateur [role="img"]'); return { src: i.getAttribute('src'), classe: i.className, label: i.getAttribute('aria-label') }; })()`);
    assert.deepEqual(fin, { src: `tests/donnees/${verif.portrait}`, classe: 'fin-portrait portrait', label: verif.nom }, `${id} : portrait a la fin`);
    assert.equal(await p.eval(`document.querySelectorAll('.carte-illustration, .fin-illustration, .fiche-illustration').length`), 0);
  }
});

test('EX-156 : illustration declaree mais introuvable (404) -> portrait sur la carte et a la fin, fiche avec le seul portrait', async () => {
  const { donnees, racine } = copie([
    ...ILLUSTREE,
    { fichier: `${FLEURISTE}/img/pistil-situation.webp`, effacer: true },
    { fichier: `${FLEURISTE}/img/rose-situation.webp`, effacer: true },
  ]);
  tolerances.push(/404 \(Not Found\) \S+\/profils\/demo-fleuriste\/img\/(pistil|rose)-situation\.webp$/);
  const p = await page({ largeur: 375, hauteur: 740 });
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  await p.attendre(`(() => { const i = document.querySelector('.carte-profil[data-profil="demo-fleuriste"] [role="img"]'); return i.classList.contains('carte-portrait') && i.complete && i.naturalWidth > 0; })()`, 'repli portrait sur la carte');
  const carte = (await cartes(p))[0];
  const verif = chargerScenario(racine, 'demo-fleuriste').scenario.personnages.roles.verificateur;
  assert.deepEqual([carte.portrait, carte.label], [`${donnees}/${verif.portrait}`, verif.nom], 'carte : portrait du verificateur');
  await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
  await jouerChoix(p, 'avis-s1-a');
  await p.attendre(`!document.querySelector('#fiche').hidden`, 'fiche');
  await p.attendre(`!document.querySelector('#fiche .fiche-illustration')`, 'illustration retiree');
  const f = await etatFiche(p);
  assert.equal(f.illustration, null);
  assert.equal(f.portrait.label, verif.nom);
  await sansDefilement(p, ['#fiche', '#bouton-fiche-suivant'], 'fiche sans illustration');
  await p.cliquer('#bouton-fiche-suivant');
  for (const x of ['avis-s2-a', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a']) await jouerChoix(p, x);
  await p.attendre(`!document.querySelector('#fiche').hidden && document.querySelector('#fiche').dataset.scene === 'fec-s2'`, 'fiche du joueur');
  // Attendre le 404 de l'illustration du joueur AVANT de cliquer : son retrait remonte « Suivant »
  // (~120 px en 375x740) ; un clic calcule avant le retrait tombe a cote et la fiche reste ouverte.
  await p.attendre(`!document.querySelector('#fiche .fiche-illustration')`, 'illustration du joueur retiree');
  await p.cliquer('#bouton-fiche-suivant');
  await p.attendre(`document.querySelector('#scene').dataset.scene === 'fec-s2' && !document.querySelector('#scene').hidden && document.querySelector('#fiche').hidden`, 'scene fec-s2 apres la fiche du joueur');
  for (const x of ['fec-s2-a', 'fec-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a']) await jouerChoix(p, x);
  await p.attendre(`document.body.dataset.ecran === 'ecran-fin'`, 'fin');
  await p.attendre(`(() => { const i = document.querySelector('#fin-verificateur [role="img"]'); return i.classList.contains('fin-portrait') && i.complete && i.naturalWidth > 0; })()`, 'repli portrait a la fin');
  assert.equal(await p.eval(`document.querySelector('#fin-verificateur [role="img"]').getAttribute('src')`), `${donnees}/${verif.portrait}`);
});

// ------------------------------------------------------------------ EX-157 : embleme

for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
  test(`EX-157 : embleme sur l'ecran titre (illustration en pied), titre sans defilement (${largeur}x${hauteur})`, async () => {
    const p = await page({ largeur, hauteur });
    await ouvrir(p, 'tests/donnees');
    assert.equal(await ecran(p), 'ecran-titre');
    await imagesChargees(p);
    const e = await p.eval(`(() => { const f = document.querySelector('#titre-embleme'); const i = f.querySelector('img');
      return { visible: !f.hidden && f.getClientRects().length > 0, src: i.getAttribute('src'), classe: i.className, role: i.getAttribute('role'),
        label: i.getAttribute('aria-label'), charge: i.complete && i.naturalWidth > 0, rapport: Math.round(i.getBoundingClientRect().width / i.getBoundingClientRect().height * 100) / 100 }; })()`);
    assert.deepEqual(e, { visible: true, src: 'tests/donnees/communs/img/embleme-situation.webp', classe: 'embleme-illustration', role: 'img', label: 'Inspecteur Démo Furieux', charge: true, rapport: 0.75 });
    await sansDefilement(p, ['#titre-embleme', '#titre-jeu', '#bouton-commencer', '#ecran-titre [data-avertissement]'], 'ecran titre');
    // L'embleme n'apparait dans aucune scene : il n'est pas un role du tronc.
    const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
    assert.equal(Object.values(scenario.personnages.roles).some((x) => x.role === 'embleme'), false);
  });
}

test('EX-157 : embleme sans illustration -> son portrait ; sans embleme declare -> rien (ecran titre inchange)', async () => {
  let { donnees } = copie([{ fichier: 'communs/personnages.json', chemin: ['personnages', 2, 'illustration'], supprimer: true }]);
  let p = await page({ largeur: 375, hauteur: 740 });
  await ouvrir(p, donnees);
  await imagesChargees(p);
  const e = await p.eval(`(() => { const i = document.querySelector('#titre-embleme [role="img"]'); return { src: i.getAttribute('src'), classe: i.className, label: i.getAttribute('aria-label') }; })()`);
  assert.deepEqual(e, { src: `${donnees}/communs/img/embleme.webp`, classe: 'embleme-portrait portrait', label: 'Inspecteur Démo Furieux' });
  await sansDefilement(p, ['#bouton-commencer'], 'titre avec portrait de l\'embleme');

  ({ donnees } = copie([{ fichier: 'communs/personnages.json', chemin: ['personnages', 2], supprimer: true }]));
  p = await page({ largeur: 375, hauteur: 740 });
  await ouvrir(p, donnees);
  assert.equal(await p.eval(`document.querySelector('#titre-embleme').hidden`), true);
  assert.equal(await p.eval(`document.querySelector('#titre-embleme').children.length`), 0);
  await sansDefilement(p, ['#bouton-commencer'], 'titre sans embleme');
});
