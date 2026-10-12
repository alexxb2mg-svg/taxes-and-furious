// Decors et portraits illustres dans le navigateur (EX-151, EX-152, EX-153), servis avec la politique
// de securite du contenu du site (outils/construire.mjs) : une violation CSP est une erreur console.
// Le navigateur est obligatoire : s'il est introuvable, les tests echouent (jamais sautes).
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOT, DONNEES, DONNEES_DEMO, chargerScenario, copieTemporaire, appliquerModifs } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { ENTETES } from '../outils/construire.mjs';
import { IMAGES } from '../outils/valider.mjs';
import { tolerance404Variantes, ecran, allerAuChoix, etapesPossibles, jouerEtape } from './partie.mjs';

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

let compteur = 0;
function copie(modifs) {
  const c = copieTemporaire(DONNEES_DEMO);
  nettoyages.push(c.nettoyer);
  appliquerModifs(c.racine, modifs);
  compteur += 1;
  const prefixe = `/images-${compteur}/`;
  montages[prefixe] = c.racine;
  nettoyages.push(() => delete montages[prefixe]);
  return prefixe.slice(1, -1);
}

async function ouvrir(p, donnees = 'tests/donnees') {
  await p.aller(`${srv.origine}/?donnees=${encodeURIComponent(donnees)}`);
  await p.attendre('document.body.dataset.pret', 'interface prete');
  assert.equal(await p.eval('document.body.dataset.pret'), 'oui');
}

/** Etat du decor affiche : chemin demande, image visible chargee, classe du body. */
const etatDecor = (p) => p.eval(`(() => {
  const c = document.querySelector('#decor');
  const v = c.querySelector('.decor-image.decor-visible');
  return {
    demande: c.dataset.decor ?? '',
    src: v ? v.getAttribute('src') : null,
    charge: v ? v.complete && v.naturalWidth > 0 : false,
    opacite: v ? getComputedStyle(v).opacity : null,
    avecDecor: document.body.classList.contains('avec-decor'),
  };
})()`);

async function attendreDecor(p, rel, donnees) {
  if (rel === null) {
    await p.attendre(`!document.querySelector('#decor .decor-visible') && !document.body.classList.contains('avec-decor')`, 'fond uni');
    return;
  }
  const attendu = `${donnees}/${rel}`;
  await p.attendre(`(() => { const v = document.querySelector('#decor .decor-visible');
    return !!v && v.getAttribute('src') === ${JSON.stringify(attendu)} && v.complete && v.naturalWidth > 0
      && getComputedStyle(v).opacity === '1'; })()`, `decor ${attendu}`);
}

/**
 * Contraste (WCAG 2) de chaque texte visible avec le premier fond OPAQUE de ses ancetres : le texte
 * ne doit jamais etre lu sur le decor (fond transparent jusqu'au body = echec).
 */
const contrastes = (p, selecteurs) => p.eval(`(() => {
  const rgba = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const res = [];
  for (const sel of ${JSON.stringify(selecteurs)}) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length || !el.textContent.trim()) continue;
      let n = el; let fond = null;
      // Avec un decor, le fond du body est cache par l'image : il ne compte pas comme panneau.
      const borne = document.body.classList.contains('avec-decor') ? document.body : document.documentElement;
      while (n && n !== borne) { const c = rgba(getComputedStyle(n).backgroundColor); if (c.a === 1) { fond = c; break; } n = n.parentElement; }
      if (!fond) { res.push({ sel, ratio: 0, fond: null }); continue; }
      const t = rgba(getComputedStyle(el).color);
      const [l1, l2] = [lum(t), lum(fond)].sort((a, b) => b - a);
      res.push({ sel, ratio: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100, fond: n.id || n.className });
    }
  }
  return res;
})()`);

// ------------------------------------------------------------------ EX-151

for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
  test(`EX-151 : decor attendu dans les 4 cas d'EX-150, panneau opaque lisible, prechargement (${largeur}x${hauteur})`, async () => {
    const donnees = 'tests/donnees';
    const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
    const scenes = new Map(scenario.chapitres.flatMap((c) => c.scenes).map((s) => [s.id, s]));
    const p = await page({ largeur, hauteur });
    await ouvrir(p, donnees);
    // Ecran titre et choix : la couverture.
    await attendreDecor(p, 'communs/decors/couverture.webp', donnees);
    const attrs = await p.eval(`[...document.querySelectorAll('#decor img')].map((i) => [i.getAttribute('alt'), i.getAttribute('decoding')])`);
    assert.deepEqual(attrs, [['', 'async'], ['', 'async']], 'decor decoratif, decodage asynchrone');
    assert.equal(await p.eval(`document.querySelector('#decor').getAttribute('aria-hidden')`), 'true');
    assert.equal(await p.eval(`getComputedStyle(document.querySelector('#decor img')).objectFit`), 'cover');
    for (const c of await contrastes(p, ['#titre-jeu', '.sous-titre', '[data-avertissement]'])) assert.ok(c.ratio >= 4.5, JSON.stringify(c));
    await allerAuChoix(p);
    await attendreDecor(p, 'communs/decors/couverture.webp', donnees);
    for (const c of await contrastes(p, ['#titre-choix', '.consigne', '.carte-nom'])) assert.ok(c.ratio >= 4.5, JSON.stringify(c));

    await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
    await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie');
    const cas = new Set();
    let precharges = 0;
    while (await ecran(p) === 'ecran-partie') {
      await p.attendre(`!document.querySelector('#scene').hidden`, 'scene');
      const id = await p.eval(`document.querySelector('#scene').dataset.scene`);
      const scene = scenes.get(id);
      await attendreDecor(p, scene.decor, donnees);
      const e = await etatDecor(p);
      assert.equal(e.demande, scene.decor ?? '', id);
      assert.equal(e.avecDecor, scene.decor !== null, id);
      if (scene.decor === null) cas.add('aucun');
      else if (scene.decor.startsWith('communs/')) cas.add('tronc');
      else if (id === 'caisse-s2') cas.add('scene');
      else cas.add('profil');
      // Panneau : fond opaque, textes du jeu lisibles (>= 4,5:1 sur la couleur du panneau).
      if (scene.decor) assert.equal(await p.eval(`getComputedStyle(document.querySelector('main')).backgroundColor`), 'rgb(255, 250, 240)');
      for (const c of await contrastes(p, ['#partie-chapitre', '#partie-profil', '#scene-texte', '#scene-jeu .choix', '.orateur-nom', '.jauge-libelle'])) {
        assert.ok(c.ratio >= 4.5, `${id} : ${JSON.stringify(c)}`);
      }
      assert.ok(await p.eval('document.documentElement.scrollWidth <= window.innerWidth'), `${id} : pas de defilement horizontal`);
      // Prechargement : le decor de chaque scene suivante possible est deja demande.
      for (const s of scene.choix ?? []) {
        const chapitre = scenario.chapitres.find((c) => c.scenes.includes(scene));
        const suite = s.suivant ? scenes.get(s.suivant) : scenario.chapitres[scenario.chapitres.indexOf(chapitre) + 1]?.scenes[0];
        if (suite?.decor && suite.decor !== scene.decor) {
          assert.ok(p.requetes.includes(`${srv.origine}/${donnees}/${suite.decor}`), `${id} : ${suite.decor} precharge`);
          precharges += 1;
        }
      }
      await jouerEtape(p, scene, etapesPossibles(scene)[0]);
      await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
      if (scene.decor) {
        for (const c of await contrastes(p, ['#encadre-choix-texte', '#loi-explication', '.loi-article', '.loi-resume'])) assert.ok(c.ratio >= 4.5, `${id} encadre : ${JSON.stringify(c)}`);
      }
      await p.cliquer('#bouton-suivant');
      await p.attendre(`document.body.dataset.ecran === 'ecran-fin' || document.querySelector('#scene').dataset.scene !== ${JSON.stringify(id)}`, 'scene suivante');
    }
    assert.deepEqual([...cas].sort(), ['aucun', 'profil', 'scene', 'tronc'], 'les 4 cas d\'EX-150 rencontres');
    assert.ok(precharges >= 2, `${precharges} prechargements verifies`);
  });
}

test('EX-151 : fondu de 300 ms au plus, coupe sous prefers-reduced-motion', async () => {
  const p = await page();
  await ouvrir(p);
  const duree = () => p.eval(`getComputedStyle(document.querySelector('#decor img')).transitionDuration`);
  const ms = (d) => Math.max(...d.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)));
  const normal = ms(await duree());
  assert.ok(normal > 0 && normal <= 300, `fondu de ${normal} ms`);
  await p.mouvementReduit(true);
  assert.equal(ms(await duree()), 0, 'aucun fondu sous prefers-reduced-motion');
  await p.mouvementReduit(false);
});

test('EX-151 : sans decors.json ni decors, fond uni actuel (aucune image de decor demandee)', async () => {
  const donnees = copie([
    { fichier: 'communs/decors.json', effacer: true },
    { fichier: 'profils/demo-fleuriste/profil.json', chemin: ['decors'], supprimer: true },
    { fichier: 'profils/demo-fleuriste/profil.json', chemin: ['chapitres', 0, 'scenes', 1, 'decor'], supprimer: true },
  ]);
  tolerances.push(/404 \(Not Found\) \S+\/communs\/decors\.json$/);
  const p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  await p.cliquer('.carte-profil[data-profil="demo-fleuriste"]');
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie');
  await attendreDecor(p, null, donnees);
  assert.equal(p.requetes.filter((u) => u.includes('/decors/')).length, 0);
  assert.equal(await p.eval(`getComputedStyle(document.querySelector('main')).backgroundColor`), 'rgba(0, 0, 0, 0)', 'pas de panneau sans decor');
});

// ------------------------------------------------------------------ EX-152

test('EX-152 : portrait .webp affiche ; 404 -> SVG de repli ; sans SVG -> initiales dans un disque (role et nom inchanges)', async () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const verif = scenario.personnages.roles.verificateur;
  const carte = (p) => p.eval(`(() => { const e = document.querySelector('.carte-profil[data-profil="demo-fleuriste"] .carte-portrait');
    return { balise: e.tagName, src: e.getAttribute('src'), role: e.getAttribute('role'), label: e.getAttribute('aria-label'),
      charge: e.tagName === 'IMG' ? e.complete && e.naturalWidth > 0 : null, texte: e.textContent, repli: e.dataset.repli ?? null,
      rayon: getComputedStyle(e).borderTopLeftRadius, largeur: e.getBoundingClientRect().width }; })()`);

  // 1. Le .webp existe : affiche tel quel.
  let p = await page();
  await ouvrir(p);
  await allerAuChoix(p);
  await p.attendre(`[...document.querySelectorAll('#liste-profils img')].every((i) => i.complete)`, 'portraits');
  let c = await carte(p);
  assert.deepEqual([c.balise, c.src, c.role, c.label, c.charge], ['IMG', `tests/donnees/${verif.portrait}`, 'img', verif.nom, true]);

  // 2. Le .webp manque (404) : SVG de meme nom.
  let donnees = copie([{ fichier: 'profils/demo-fleuriste/img/pistil.webp', effacer: true }]);
  tolerances.push(/404 \(Not Found\) \S+\/profils\/demo-fleuriste\/img\/pistil\.(webp|svg)$/);
  p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  await p.attendre(`(() => { const i = document.querySelector('.carte-profil[data-profil="demo-fleuriste"] .carte-portrait'); return i.dataset.repli === 'svg' && i.complete && i.naturalWidth > 0; })()`, 'repli SVG');
  c = await carte(p);
  assert.deepEqual([c.balise, c.src, c.role, c.label, c.charge], ['IMG', `${donnees}/${verif.repli}`, 'img', verif.nom, true]);

  // 3. Ni .webp ni .svg : initiales dans un disque.
  donnees = copie([
    { fichier: 'profils/demo-fleuriste/img/pistil.webp', effacer: true },
    { fichier: 'profils/demo-fleuriste/img/pistil.svg', effacer: true },
  ]);
  p = await page();
  await ouvrir(p, donnees);
  await allerAuChoix(p);
  await p.attendre(`document.querySelector('.carte-profil[data-profil="demo-fleuriste"] .carte-portrait').dataset.repli === 'initiales'`, 'initiales');
  c = await carte(p);
  assert.deepEqual([c.balise, c.role, c.label, c.texte], ['SPAN', 'img', verif.nom, 'DP']);
  assert.equal(c.rayon, '50%', 'disque');
  assert.ok(c.largeur >= 70, `disque aux dimensions du portrait (${c.largeur} px)`);
  for (const k of await contrastes(p, ['.carte-portrait.portrait-initiales'])) assert.ok(k.ratio >= 4.5, JSON.stringify(k));
});

// ------------------------------------------------------------------ EX-153

test('EX-153 : la page d\'accueil ne charge que la couverture, l\'embleme et les images de l\'ecran de choix (< 2 Mo transferes)', async () => {
  for (const donnees of ['data', 'tests/donnees']) {
    const p = await page();
    await ouvrir(p, donnees);
    await allerAuChoix(p);
    await p.attendre(`[...document.querySelectorAll('#liste-profils .carte-portrait, #liste-profils .carte-illustration, #titre-embleme img')].every((i) => i.tagName !== 'IMG' || i.complete)`, 'images de l\'accueil');
    await p.attendre(`[...document.querySelectorAll('#decor img')].every((i) => i.complete)`, 'couverture');
    await new Promise((r) => setTimeout(r, 200));
    const images = p.requetes.filter((u) => /\.(webp|svg|png)$/.test(u));
    const decors = images.filter((u) => u.includes('/decors/'));
    assert.ok(decors.every((u) => u.endsWith('/communs/decors/couverture.webp')), `${donnees} : decors charges ${decors}`);
    // Cartes (portrait ou illustration du joueur, EX-156 a) et embleme de l'ecran titre (EX-157), repli SVG compris.
    const accueil = new Set(await p.eval(`[...document.querySelectorAll('#liste-profils .carte-portrait, #liste-profils .carte-illustration, #titre-embleme img')].map((i) => i.src)`));
    for (const u of images.filter((x) => !x.includes('/decors/'))) assert.ok(accueil.has(u), `${donnees} : image ${u} hors ecran titre et ecran de choix`);
    const octets = p.transferts.reduce((s, t) => s + t.octets, 0);
    assert.ok(octets < IMAGES.accueilMaxOctets, `${donnees} : ${octets} octets transferes`);
    assert.ok(p.transferts.length > 0);
  }
});
