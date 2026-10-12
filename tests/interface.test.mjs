// Tests d'interface (EX-032) : chrome-headless-shell piloté en CDP, aucune dépendance npm.
// Le navigateur est obligatoire : s'il est introuvable, les tests échouent (jamais sautés).
// Données : tests/donnees (démonstration) servies avec ?donnees=, copies temporaires pour les cas modifiés.
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { nouvellePartie, choisir } from '../js/moteur.js';
import { valider } from '../outils/valider.mjs';
import { DEPOT, DONNEES, DONNEES_DEMO, chargerScenario, copieTemporaire, appliquerModifs, lireJson } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { tolerance404Variantes, ecran, texte, visible, avertissementAttendu, allerAuChoix, cartes, verifierJauges, jouerPartie, suiteDe } from './partie.mjs';

const CLE = 'fiscfiction.meilleur';
const montages = {}; // préfixe -> dossier, modifiable d'un test à l'autre
let nav;
let srv;
const pages = [];
const nettoyages = [];

before(async () => {
  trouverChrome(); // échec explicite si le navigateur manque
  srv = await servir(DEPOT, montages);
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  await srv?.fermer();
});

// Après chaque test : 0 erreur console, 0 requête hors origine, nettoyage des copies.
afterEach(async () => {
  const bilan = [];
  for (const p of pages.splice(0)) {
    bilan.push({ erreurs: p.erreurs.filter((e) => !tolerance404Variantes.test(e)), externes: p.requetesExternes(srv.origine) });
    await p.fermer();
  }
  for (const n of nettoyages.splice(0)) n();
  for (const { erreurs, externes } of bilan) {
    assert.deepEqual(erreurs, [], 'erreurs console');
    assert.deepEqual(externes, [], 'requetes hors origine locale (EX-030)');
  }
});

async function page(options) {
  const p = await nav.nouvellePage(options);
  pages.push(p);
  return p;
}

/** Copie de données de démonstration montée sous /copie-<n>/ ; renvoie { racine, donnees }. */
let compteurCopies = 0;
function copie(modifs = []) {
  const c = copieTemporaire(DONNEES_DEMO);
  nettoyages.push(c.nettoyer);
  appliquerModifs(c.racine, modifs);
  compteurCopies += 1;
  const prefixe = `/copie-${compteurCopies}/`;
  montages[prefixe] = c.racine;
  nettoyages.push(() => delete montages[prefixe]);
  return { racine: c.racine, donnees: prefixe.slice(1, -1) };
}

async function ouvrir(p, donnees = 'tests/donnees') {
  await p.aller(`${srv.origine}/?donnees=${encodeURIComponent(donnees)}`);
  await p.attendre('document.body.dataset.pret', 'interface prete');
  assert.equal(await p.eval('document.body.dataset.pret'), 'oui');
}

// ------------------------------------------------------------------ statique

// Fichiers d'un dossier du depot, sous-dossiers compris (ex. js/types/), chemins avec des /.
const fichiersDe = (d) => readdirSync(join(DEPOT, d), { recursive: true })
  .map((f) => `${d}/${String(f).replaceAll('\\', '/')}`)
  .filter((f) => statSync(join(DEPOT, f)).isFile());

test('EX-030 : aucune URL externe dans index.html, css/ et js/', () => {
  const fichiers = ['index.html', ...['css', 'js'].flatMap(fichiersDe)];
  const fautes = [];
  for (const f of fichiers) {
    // Même règle que la vérification de la spec : seuls les espaces de noms SVG/XLink sont admis.
    readFileSync(join(DEPOT, f), 'utf8').split('\n').forEach((l, i) => {
      if (/https?:\/\//.test(l.replace(/http:\/\/www\.w3\.org\/(2000\/svg|1999\/xlink)/g, ''))) fautes.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(fautes, []);
});

test('EX-021 : aucun nom de personnage dans js/ ; seul js/interface.js touche au DOM global', () => {
  const fichiers = fichiersDe('js');
  assert.ok(fichiers.includes('js/types/tri.js'), 'sous-dossiers parcourus');
  for (const f of fichiers) {
    const src = readFileSync(join(DEPOT, f), 'utf8');
    assert.deepEqual(src.split('\n').filter((l) => /rectif|addition|tableur|frange|poney|story|cindy/i.test(l)), [], f);
    // Les types (EX-111) rendent dans le conteneur recu (conteneur.ownerDocument), jamais via document/window.
    if (f !== 'js/interface.js') assert.equal(/\bdocument\b|\bwindow\b/.test(src), false, `${f} touche au DOM global`);
  }
});

// ------------------------------------------------------------------ titre, choix du profil

test('EX-004 : ecran titre avec titre du tronc et avertissement date JJ/MM/AAAA', async () => {
  const p = await page();
  await ouvrir(p);
  assert.equal(await ecran(p), 'ecran-titre');
  assert.equal(await texte(p, '#titre-jeu'), lireJson(DONNEES_DEMO, 'tronc.json').titre);
  assert.equal(await texte(p, '#ecran-titre [data-avertissement]'), avertissementAttendu(DONNEES_DEMO));
  assert.equal(await visible(p, '#ecran-titre [data-avertissement]'), true);
  assert.match(await texte(p, '#ecran-titre [data-avertissement]'), /au \d{2}\/\d{2}\/\d{4}\.$/);
});

test('EX-050 : cartes des profils actifs dans l\'ordre de index.json (portrait, nom, entreprise, accroche)', async () => {
  const p = await page();
  await ouvrir(p);
  await allerAuChoix(p);
  await p.attendre(`[...document.querySelectorAll('#liste-profils img')].every((i) => i.complete)`, 'portraits des cartes');
  const index = lireJson(DONNEES_DEMO, 'profils/index.json');
  const vues = await cartes(p);
  assert.deepEqual(vues.map((c) => c.id), index);
  for (const c of vues) {
    const { scenario, profil } = chargerScenario(DONNEES_DEMO, c.id);
    const verif = scenario.personnages.roles.verificateur;
    assert.equal(c.nom, profil.nom);
    assert.equal(c.entreprise, profil.entreprise);
    assert.equal(c.accroche, profil.accroche);
    assert.equal(c.portrait, `tests/donnees/${verif.portrait}`);
    assert.equal(c.role, 'img');
    assert.equal(c.label, verif.nom);
    assert.equal(c.charge, true, `portrait de ${c.id} charge`);
  }
  assert.equal(await visible(p, '#profils-indisponibles'), false);

  // Ordre inverse dans une copie : l'écran suit l'index, pas l'ordre des dossiers.
  const { donnees } = copie([{ fichier: 'profils/index.json', valeur_fichier: [...index].reverse() }]);
  const p2 = await page();
  await ouvrir(p2, donnees);
  await allerAuChoix(p2);
  assert.deepEqual((await cartes(p2)).map((c) => c.id), [...index].reverse());
});

test('EX-050 / EX-052 : un profil passe a actif: false disparait, sans message d\'indisponibilite', async () => {
  const { donnees } = copie([{ fichier: 'profils/demo-glacier/profil.json', chemin: ['actif'], valeur: false }]);
  const p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  assert.deepEqual((await cartes(p)).map((c) => c.id), ['demo-fleuriste']);
  assert.equal(await visible(p, '#profils-indisponibles'), false);
});

test('EX-054 : profil.json corrompu isole, les autres restent jouables, message "1 profil indisponible"', async () => {
  const { donnees, racine } = copie([{ fichier: 'profils/demo-fleuriste/profil.json', brut: '{ "id": "demo-fleuriste", "actif": tru' }]);
  const p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  assert.deepEqual((await cartes(p)).map((c) => c.id), ['demo-glacier']);
  assert.equal(await visible(p, '#profils-indisponibles'), true);
  assert.equal(await texte(p, '#profils-indisponibles'), '1 profil indisponible');
  assert.ok(p.avertissements.some((a) => a.includes('demo-fleuriste')), 'avertissement console attendu');
  // Le profil restant se joue jusqu'au bout.
  await jouerPartie(p, racine, 'demo-glacier', suiteDe(racine, 'demo-glacier', 0));
});

test('EX-054 : profil invalide a l\'execution (suivant introuvable, variantes illisibles) isole', async () => {
  const { donnees } = copie([
    { fichier: 'profils/demo-glacier/profil.json', chemin: ['chapitres', 0, 'scenes', 0, 'choix', 0, 'suivant'], valeur: 'scene-absente' },
    { fichier: 'profils/demo-fleuriste/variantes.json', brut: '{ pas du json' },
  ]);
  const p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  assert.deepEqual(await cartes(p), []);
  assert.equal(await texte(p, '#profils-indisponibles'), '2 profils indisponibles');
});

// ------------------------------------------------------------------ partie complète

test('EX-033 / EX-007 : partie complete (fleuriste) : orateurs, narrateur sans portrait, jauges = moteur, encadre loi, fin', async () => {
  const p = await page();
  await ouvrir(p);
  await p.eval(`localStorage.clear()`);
  await allerAuChoix(p);
  const { vus, scenario } = await jouerPartie(p, DONNEES_DEMO, 'demo-fleuriste', suiteDe(DONNEES_DEMO, 'demo-fleuriste', 0));
  assert.ok(vus.narrateur > 0, 'au moins une scene de narrateur jouee');
  // Le profil porte le role comptable : c'est son personnage qui parle, pas le generique.
  const comptable = scenario.personnages.roles.comptable;
  assert.deepEqual([...vus.roles.comptable], [comptable.nom]);
  assert.notEqual(comptable.nom, lireJson(DONNEES_DEMO, 'communs/personnages.json').personnages.find((x) => x.role === 'comptable').nom);
  // Écran de fin : avertissement daté, boutons.
  assert.equal(await texte(p, '#ecran-fin [data-avertissement]'), avertissementAttendu(DONNEES_DEMO));
  assert.equal(await visible(p, '#bouton-rejouer'), true);
  assert.equal(await visible(p, '#bouton-changer'), true);
  // Rejouer repart au début du même profil.
  await p.cliquer('#bouton-rejouer');
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'rejouer');
  const premiere = scenario.chapitres[0].scenes[0].id;
  assert.equal(await p.eval(`document.querySelector('#scene').dataset.scene`), premiere);
  await verifierJauges(p, nouvellePartie(scenario), 'apres Rejouer');
});

test('Roles generiques : sans comptable dans le profil (glacier), le personnage de communs/personnages.json parle', async () => {
  const p = await page();
  await ouvrir(p);
  await allerAuChoix(p);
  const communs = lireJson(DONNEES_DEMO, 'communs/personnages.json').personnages;
  const profil = lireJson(DONNEES_DEMO, 'profils/demo-glacier/profil.json');
  assert.equal(profil.personnages.some((x) => x.role === 'comptable'), false, 'premisse : glacier sans comptable');
  const { vus, scenario } = await jouerPartie(p, DONNEES_DEMO, 'demo-glacier', suiteDe(DONNEES_DEMO, 'demo-glacier', 1));
  const generique = communs.find((x) => x.role === 'comptable');
  assert.deepEqual([...vus.roles.comptable], [generique.nom]);
  assert.equal(scenario.personnages.roles.comptable.portrait, `communs/${generique.portrait}`);
  if (vus.roles.joueur) assert.deepEqual([...vus.roles.joueur], [communs.find((x) => x.role === 'joueur').nom]);
  // Changer de profil ramène à l'écran de choix.
  await p.cliquer('#bouton-changer');
  await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'changer de profil');
});

// ------------------------------------------------------------------ meilleur score (EX-036)

test('EX-036 : cle unique fiscfiction.meilleur, plus petit redressement par profil, partie anticipee jamais retenue', async () => {
  const p = await page();
  await ouvrir(p);
  await p.eval(`localStorage.clear()`);
  await allerAuChoix(p);
  const a = await jouerPartie(p, DONNEES_DEMO, 'demo-fleuriste', suiteDe(DONNEES_DEMO, 'demo-fleuriste', 0));
  await p.cliquer('#bouton-changer');
  await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'choix');
  const b = await jouerPartie(p, DONNEES_DEMO, 'demo-glacier', suiteDe(DONNEES_DEMO, 'demo-glacier', (i) => (i === 1 ? 1 : 0)));
  assert.equal(a.resultat.anticipee, false);
  assert.equal(b.resultat.anticipee, false);
  const lire = () => p.eval(`({ cles: Object.keys(localStorage), valeur: JSON.parse(localStorage.getItem(${JSON.stringify(CLE)})) })`);
  let stock = await lire();
  assert.deepEqual(stock.cles, [CLE]);
  assert.deepEqual(stock.valeur, { 'demo-fleuriste': a.resultat.redressement, 'demo-glacier': b.resultat.redressement });

  const rejouer = async (rang) => {
    await p.cliquer('#bouton-changer');
    await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'choix');
    const r = await jouerPartie(p, DONNEES_DEMO, 'demo-glacier', suiteDe(DONNEES_DEMO, 'demo-glacier', rang));
    assert.equal(r.resultat.anticipee, false);
    return r.resultat.redressement;
  };
  // Une meilleure partie remplace le score ; une moins bonne ne le remplace pas.
  const meilleur = await rejouer(0);
  assert.ok(meilleur < b.resultat.redressement, 'premisse : partie meilleure');
  assert.equal((await lire()).valeur['demo-glacier'], meilleur);
  const moinsBon = await rejouer((i) => (i % 4 === 1 ? 1 : 0));
  assert.ok(moinsBon > meilleur, 'premisse : partie moins bonne');
  stock = await lire();
  assert.equal(stock.valeur['demo-glacier'], meilleur);
  // Le meilleur score s'affiche sur la carte.
  await p.cliquer('#bouton-changer');
  await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'choix');
  const vues = await cartes(p);
  for (const v of vues) assert.equal(Number(v.meilleur.replace(/\D/g, '')), stock.valeur[v.id], `carte ${v.id}`);

  // Partie anticipee (patience a 0 des le premier choix, redressement 0) : jamais retenue,
  // bien qu'elle ferait un "meilleur" score. Même origine, donc même localStorage.
  const avant = stock.valeur;
  const { donnees, racine } = copie([{
    fichier: 'tronc.json',
    chemin: ['chapitres', 0, 'scenes', 0, 'choix', 1, 'effets'],
    valeur: { redressement: 0, patience: -100, stress: 0 },
  }]);
  const p2 = await page();
  await ouvrir(p2, donnees);
  await allerAuChoix(p2);
  const idChoix = lireJson(racine, 'tronc.json').chapitres[0].scenes[0].choix[1].id;
  const d = await jouerPartie(p2, racine, 'demo-fleuriste', [idChoix]);
  assert.equal(d.resultat.anticipee, true);
  assert.equal(d.resultat.id, 'fin-patience');
  assert.equal(d.resultat.redressement, 0);
  const apres = await p2.eval(`({ cles: Object.keys(localStorage), valeur: JSON.parse(localStorage.getItem(${JSON.stringify(CLE)})) })`);
  assert.deepEqual(apres.cles, [CLE]);
  assert.deepEqual(apres.valeur, avant);
});

// ------------------------------------------------------------------ mobile et clavier (EX-035)

test('EX-035 : 375x740 sans defilement horizontal sur les 5 ecrans', async () => {
  const p = await page({ largeur: 375, hauteur: 740 });
  await ouvrir(p);
  const largeur = async (nom) => {
    const w = await p.eval('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)');
    assert.ok(w <= 375, `${nom} : scrollWidth ${w} > 375`);
  };
  await largeur('titre');
  await allerAuChoix(p);
  await largeur('choix');
  await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie');
  const suite = suiteDe(DONNEES_DEMO, 'demo-fleuriste', 1);
  for (const [i, idChoix] of suite.entries()) {
    await p.attendre(`!!document.querySelector('#scene-choix .choix[data-choix="${idChoix}"]')`, idChoix);
    await largeur(`scene ${i}`);
    await p.cliquer(`#scene-choix .choix[data-choix="${idChoix}"]`);
    await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
    await largeur(`encadre ${i}`);
    await p.cliquer('#bouton-suivant');
  }
  await p.attendre(`document.body.dataset.ecran === 'ecran-fin'`, 'fin');
  await largeur('fin');
});

test('EX-035 : profil et scene joues au clavier, focus visible', async () => {
  const p = await page();
  await ouvrir(p);
  const actif = () => p.eval(`(() => { const e = document.activeElement; const s = getComputedStyle(e);
    return { id: e.id, classe: e.className, profil: e.dataset.profil ?? null, choix: e.dataset.choix ?? null,
      contour: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, focusVisible: e.matches(':focus-visible') }; })()`);
  const tabJusqua = async (pred, quoi) => {
    for (let i = 0; i < 30; i += 1) {
      await p.touche('Tab');
      const a = await actif();
      if (pred(a)) return a;
    }
    throw new Error(`clavier : ${quoi} jamais atteint par Tab`);
  };
  let a = await tabJusqua((x) => x.id === 'bouton-commencer', 'bouton commencer');
  assert.ok(a.focusVisible && a.contour, 'focus visible sur le bouton du titre');
  await p.touche('Enter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'choix au clavier');
  a = await tabJusqua((x) => x.profil === 'demo-glacier', 'carte demo-glacier');
  assert.ok(a.focusVisible && a.contour, 'focus visible sur la carte de profil');
  await p.touche('Enter');
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie au clavier');
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-glacier');
  const scene = scenario.chapitres[0].scenes[0];
  a = await tabJusqua((x) => x.choix === scene.choix[0].id, 'premier choix');
  assert.ok(a.focusVisible && a.contour, 'focus visible sur le choix');
  await p.touche('Space');
  await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre au clavier');
  assert.equal(await p.eval(`document.querySelector('#encadre').dataset.choix`), scene.choix[0].id);
  await verifierJauges(p, choisir(nouvellePartie(scenario), scene.choix[0].id), 'clavier');
  a = await tabJusqua((x) => x.id === 'bouton-suivant', 'bouton Suivant');
  assert.ok(a.focusVisible && a.contour);
  await p.touche('Enter');
  await p.attendre(`document.querySelector('#scene').dataset.scene === ${JSON.stringify(scene.choix[0].suivant ?? scenario.chapitres[1].scenes[0].id)}`, 'scene suivante au clavier');
});

// ------------------------------------------------------------------ EX-051 : ajouter un profil sans code

function hashArbre(racine, rels) {
  const h = createHash('sha256');
  const visiter = (rel) => {
    const abs = join(racine, rel);
    if (statSync(abs).isDirectory()) {
      for (const n of readdirSync(abs).sort()) visiter(`${rel}/${n}`);
    } else {
      h.update(`${rel}\0`);
      h.update(readFileSync(abs));
    }
  };
  for (const r of rels) visiter(r);
  return h.digest('hex');
}

test('EX-051 : profil essai-ajout cree depuis _modele dans une copie du site, valide, joue jusqu\'a une fin, code inchange', async () => {
  const PREFIXE = 'fiscfiction-site-';
  const tmp = mkdtempSync(join(tmpdir(), PREFIXE));
  nettoyages.push(() => {
    if (basename(tmp).startsWith(PREFIXE) && resolve(tmp).startsWith(resolve(tmpdir()))) rmSync(tmp, { recursive: true, force: true });
  });
  const site = join(tmp, 'site');
  for (const r of ['index.html', 'css', 'js', 'data']) cpSync(join(DEPOT, r), join(site, r), { recursive: true });
  const CODE = ['index.html', 'css', 'js'];
  const hashOriginal = hashArbre(DEPOT, CODE);
  assert.equal(hashArbre(site, CODE), hashOriginal, 'copie fidele');

  // Procedure "sans code" : copier le modele, renommer, l'ajouter a l'index.
  const dossier = join(site, 'data', 'profils', 'essai-ajout');
  cpSync(join(site, 'data', 'profils', '_modele'), dossier, { recursive: true });
  const fichierProfil = join(dossier, 'profil.json');
  const profil = JSON.parse(readFileSync(fichierProfil, 'utf8'));
  profil.id = 'essai-ajout';
  writeFileSync(fichierProfil, `${JSON.stringify(profil, null, 2)}\n`);
  const fichierIndex = join(site, 'data', 'profils', 'index.json');
  writeFileSync(fichierIndex, `${JSON.stringify([...JSON.parse(readFileSync(fichierIndex, 'utf8')), 'essai-ajout'], null, 2)}\n`);

  const rapport = valider({ racine: join(site, 'data') });
  assert.deepEqual(rapport.erreurs, [], 'validateur');
  assert.ok(rapport.profils.includes('essai-ajout'));

  const srvSite = await servir(site);
  try {
    const p = await nav.nouvellePage();
    try {
      await p.aller(`${srvSite.origine}/`);
      await p.attendre('document.body.dataset.pret', 'interface prete');
      await allerAuChoix(p);
      assert.ok((await cartes(p)).some((c) => c.id === 'essai-ajout'), 'carte essai-ajout affichee');
      const racine = join(site, 'data');
      const { resultat } = await jouerPartie(p, racine, 'essai-ajout', suiteDe(racine, 'essai-ajout', 0));
      assert.ok(resultat.id, 'une fin est atteinte');
      assert.deepEqual(p.erreurs.filter((e) => !tolerance404Variantes.test(e)), [], 'erreurs console');
      assert.deepEqual(p.requetesExternes(srvSite.origine), [], 'requetes externes');
    } finally {
      await p.fermer();
    }
  } finally {
    await srvSite.fermer();
  }
  assert.equal(hashArbre(site, CODE), hashOriginal, 'js/, css/, index.html identiques (hash)');
});

// ------------------------------------------------------------------ EX-031 : lanceur

function portLibre() {
  return new Promise((ok, ko) => {
    const s = createServer();
    s.once('error', ko);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

function portOccupe(port) {
  return new Promise((ok) => {
    const s = createServer();
    s.once('error', () => ok(true));
    s.listen(port, '127.0.0.1', () => s.close(() => ok(false)));
  });
}

/** Lance `python lancer.py ...args` ; attend la sortie ou la fin. */
function lancer(args, { attendre = /Ctrl\+C/ } = {}) {
  const proc = spawn('python', ['lancer.py', ...args], { cwd: DEPOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const sortie = { out: '', err: '', code: null };
  proc.stdout.on('data', (d) => { sortie.out += d; });
  proc.stderr.on('data', (d) => { sortie.err += d; });
  const fini = new Promise((ok) => proc.on('exit', (code) => { sortie.code = code; ok(); }));
  const pret = new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error(`lancer.py ${args.join(' ')} : pas de reponse en 10 s (${sortie.out}${sortie.err})`)), 10000);
    const verifier = () => { if (attendre.test(sortie.out)) { clearTimeout(t); ok(); } };
    proc.stdout.on('data', verifier);
    fini.then(() => { clearTimeout(t); ok(); });
  });
  return {
    sortie,
    pret,
    fini,
    async arreter() {
      if (sortie.code === null) {
        proc.kill();
        await fini;
      }
    },
  };
}

test('EX-031 : lancer.py --port sert /, /data/tronc.json, /data/profils/index.json ; port pris = erreur claire', async () => {
  const port = await portLibre();
  const l = lancer(['--port', String(port)]);
  try {
    await l.pret;
    assert.equal(l.sortie.code, null, `serveur arrete : ${l.sortie.err}`);
    assert.match(l.sortie.out, new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
    for (const chemin of ['/', '/data/tronc.json', '/data/profils/index.json', '/js/interface.js']) {
      const r = await fetch(`http://127.0.0.1:${port}${chemin}`);
      assert.equal(r.status, 200, chemin);
      if (chemin.endsWith('.js')) assert.match(r.headers.get('content-type'), /javascript/);
      await r.arrayBuffer();
    }
    const second = lancer(['--port', String(port)]);
    await second.fini;
    assert.notEqual(second.sortie.code, 0, 'second lancement sur un port occupe : code non nul');
    assert.match(second.sortie.err + second.sortie.out, /port/);
  } finally {
    await l.arreter();
  }
});

test('EX-031 : lancer.py sans option ecoute sur 8796 (ou signale que 8796 est pris)', async () => {
  const occupe = await portOccupe(8796);
  const l = lancer([]);
  try {
    if (occupe) {
      await l.fini;
      assert.notEqual(l.sortie.code, 0);
      assert.match(l.sortie.err, /port 8796/);
    } else {
      await l.pret;
      assert.match(l.sortie.out, /http:\/\/127\.0\.0\.1:8796\//);
      const r = await fetch('http://127.0.0.1:8796/data/profils/index.json');
      assert.equal(r.status, 200);
      await r.arrayBuffer();
    }
  } finally {
    await l.arreter();
  }
});

test('EX-031 : lancer.py --lan affiche une adresse IPv4 autre que 127.0.0.1', async () => {
  const port = await portLibre();
  const l = lancer(['--lan', '--port', String(port)], { attendre: /Ctrl\+C/ });
  try {
    await l.pret;
    assert.equal(l.sortie.code, null, l.sortie.err);
    const ips = [...l.sortie.out.matchAll(/(\d{1,3}(?:\.\d{1,3}){3})/g)].map((m) => m[1]);
    assert.ok(ips.some((ip) => !ip.startsWith('127.')), `adresse LAN attendue dans : ${l.sortie.out}`);
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.status, 200);
    await r.arrayBuffer();
  } finally {
    await l.arreter();
  }
});
