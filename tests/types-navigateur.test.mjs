// Architecture d'extensions dans le navigateur headless :
// EX-111 (test EX-051 bis : type essai-bouton ajoute dans une copie, coeur inchange),
// EX-112 (tri joue au clavier, a la souris et au toucher, issue retenue pour 3 scores, 375x740),
// EX-113 (animation appliquee, absente sous prefers-reduced-motion).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nouvellePartie, resoudre, sceneCourante } from '../js/moteur.js';
import { DEPOT, DONNEES, chargerScenario } from './aides.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { allerAuChoix, ecran, passerFiche } from './partie.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

let nav;
let srv;
const PREFIXE = 'fiscfiction-types-';
const temporaires = [];

before(async () => {
  trouverChrome(); // echec explicite si le navigateur manque
  srv = await servir(DEPOT);
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  await srv?.fermer();
  for (const tmp of temporaires) {
    if (basename(tmp).startsWith(PREFIXE) && resolve(tmp).startsWith(resolve(tmpdir()))) rmSync(tmp, { recursive: true, force: true });
  }
});

/** Page sur le jeu servi, profil `id` lance ; renvoie la page. */
async function lancer(id, { largeur, hauteur, reduit } = {}) {
  const p = await nav.nouvellePage({ largeur, hauteur });
  if (reduit !== undefined) await p.mouvementReduit(reduit);
  await p.aller(`${srv.origine}/`);
  await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
  await allerAuChoix(p);
  await p.cliquer(`.carte-profil[data-profil="${id}"]`);
  await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'debut de partie');
  return p;
}

/** Joue (clics) les choix de `suite` jusqu'a atteindre la scene `idScene` ; renvoie l'etat du moteur. */
async function allerA(p, scenario, suite, idScene) {
  let etat = nouvellePartie(scenario);
  const presentes = new Set(); // fiches de presentation (EX-156) fermees au passage
  for (const x of suite) {
    const scene = sceneCourante(etat);
    await passerFiche(p, scene, presentes);
    if (scene.id === idScene) return etat;
    await p.cliquer(`#scene-choix .choix[data-choix="${x}"]`);
    await p.attendre(`!document.querySelector('#encadre').hidden`, `encadre ${x}`);
    etat = resoudre(etat, x);
    await p.cliquer('#bouton-suivant');
  }
  throw new Error(`scene ${idScene} jamais atteinte`);
}

const largeurPage = (p) => p.eval('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)');
const encadre = (p) => p.eval(`(() => { const e = document.querySelector('#encadre');
  return { choix: e.dataset.choix, juste: e.dataset.juste, resultat: document.querySelector('#encadre-choix-texte').textContent,
    libelleResultat: !document.querySelector('#encadre-libelle-resultat').hidden, classes: [...e.classList],
    jauges: Object.fromEntries([...document.querySelectorAll('[data-jauge]')].map((j) => [j.dataset.jauge, Number(j.dataset.valeur)])) }; })()`);

const CONSULTANT = chargerScenario(DONNEES, 'consultant').scenario;
const SUITE_CONSULTANT = SUITES_FINS.consultant['consultant-fin-pivot'];
const TRI = 'train-de-vie-tri';

/** Bac a choisir pour la piece i : le bon pour les `bien` premieres, un autre sinon. */
const bacPour = (scene, i, bien) => {
  const { bacs, pieces } = scene.parametres;
  return i < bien ? bacs.indexOf(pieces[i].bac_attendu) : bacs.findIndex((b) => b !== pieces[i].bac_attendu);
};

// ------------------------------------------------------------ EX-112 : tri

test('EX-112 : tri joue a la souris, au clavier et au toucher ; issue retenue pour 3 scores = moteur', async () => {
  const modes = [
    ['souris', 6, 'train-de-vie-tri-parfait'],
    ['clavier', 4, 'train-de-vie-tri-presque'],
    ['toucher', 1, 'train-de-vie-tri-rate'],
  ];
  for (const [mode, bien, attendue] of modes) {
    const p = await lancer('consultant');
    try {
      const etat = await allerA(p, CONSULTANT, SUITE_CONSULTANT, TRI);
      const scene = sceneCourante(etat);
      assert.equal(await p.eval(`document.querySelector('#scene').dataset.type`), 'tri');
      const pieces = await p.eval(`[...document.querySelectorAll('#scene-jeu .tri-piece')].map((li) => li.querySelector('legend').textContent)`);
      assert.deepEqual(pieces, scene.parametres.pieces.map((x) => x.texte), `${mode} : pieces affichees`);
      const n = scene.parametres.pieces.length;
      if (mode === 'clavier') {
        // Tab jusqu'au premier groupe, Espace coche le premier bac, fleches = bac suivant, Tab = piece suivante.
        let trouve = false;
        for (let k = 0; k < 40 && !trouve; k += 1) {
          await p.touche('Tab');
          trouve = await p.eval(`document.activeElement?.closest('.tri-piece')?.dataset.piece === '0'`);
        }
        assert.ok(trouve, 'premiere piece atteinte par Tab');
        for (let i = 0; i < n; i += 1) {
          assert.equal(await p.eval(`document.activeElement.closest('.tri-piece').dataset.piece`), String(i), `piece ${i} focalisee`);
          // Focus visible sur l'etiquette du bac (le bouton radio natif est transparent).
          const contour = await p.eval(`getComputedStyle(document.activeElement.nextElementSibling).outlineStyle`);
          assert.notEqual(contour, 'none', `piece ${i} : focus visible`);
          await p.touche('Space');
          for (let j = 0; j < bacPour(scene, i, bien); j += 1) await p.touche('ArrowRight');
          if (i < n - 1) await p.touche('Tab');
        }
        await p.touche('Enter');
      } else {
        for (let i = 0; i < n; i += 1) {
          const sel = `#scene-jeu .tri-piece[data-piece="${i}"] .tri-bac[data-bac="${bacPour(scene, i, bien)}"]`;
          if (mode === 'souris') await p.cliquer(sel);
          else await p.toucher(sel);
        }
        if (mode === 'souris') await p.cliquer('#scene-jeu .tri-valider');
        else await p.toucher('#scene-jeu .tri-valider');
      }
      await p.attendre(`!document.querySelector('#encadre').hidden`, `${mode} : encadre`);
      const e = await encadre(p);
      const attendu = resoudre(etat, bien);
      assert.equal(e.choix, attendue, `${mode} : issue retenue`);
      assert.equal(attendu.dernierChoix, attendue, `${mode} : le moteur retient la meme issue`);
      assert.deepEqual(e.jauges, { ...attendu.jauges }, `${mode} : jauges = moteur`);
      assert.equal(e.resultat, `${bien} pièce${bien > 1 ? 's' : ''} sur ${n} dans le bon bac`);
      assert.equal(e.libelleResultat, true);
      assert.deepEqual(p.erreurs, [], `${mode} : erreurs console`);
    } finally {
      await p.fermer();
    }
  }
});

test('EX-112 : tri incomplet = message, rien n\'est resolu ; 375x740 sans defilement horizontal', async () => {
  const p = await lancer('consultant', { largeur: 375, hauteur: 740 });
  try {
    await allerA(p, CONSULTANT, SUITE_CONSULTANT, TRI);
    assert.ok(await largeurPage(p) <= 375, `scrollWidth ${await largeurPage(p)}`);
    await p.cliquer('#scene-jeu .tri-piece[data-piece="0"] .tri-bac[data-bac="0"]');
    await p.cliquer('#scene-jeu .tri-valider');
    await p.attendre(`!document.querySelector('#scene-jeu .tri-manque').hidden`, 'message pieces manquantes');
    assert.match(await p.eval(`document.querySelector('#scene-jeu .tri-manque').textContent`), /^Il reste 5 pièces à ranger\.$/);
    assert.equal(await p.eval(`document.querySelector('#encadre').hidden`), true, 'pas d\'encadre');
    assert.equal(await p.eval(`document.activeElement.closest('.tri-piece')?.dataset.piece`), '1', 'focus sur la premiere piece non rangee');
    assert.ok(await largeurPage(p) <= 375);
    assert.deepEqual(p.erreurs, []);
  } finally {
    await p.fermer();
  }
});

// ------------------------------------------------------------ EX-113 : animations

test('EX-113 : animation appliquee sans reduction, absente sous prefers-reduced-motion (jeu identique)', async () => {
  const bilan = {};
  for (const reduit of [false, true]) {
    const p = await lancer('consultant', { reduit });
    try {
      assert.equal(await p.eval(`matchMedia('(prefers-reduced-motion: reduce)').matches`), reduit, 'emulation CDP');
      const etat = await allerA(p, CONSULTANT, SUITE_CONSULTANT, TRI);
      const scene = sceneCourante(etat);
      for (let i = 0; i < scene.parametres.pieces.length; i += 1) {
        await p.cliquer(`#scene-jeu .tri-piece[data-piece="${i}"] .tri-bac[data-bac="${bacPour(scene, i, 6)}"]`);
      }
      await p.cliquer('#scene-jeu .tri-valider');
      await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
      const e = await encadre(p);
      assert.equal(e.choix, 'train-de-vie-tri-parfait');
      bilan[reduit] = e;
      if (!reduit) {
        assert.ok(e.classes.includes('anim-tampon'), `classe anim-tampon attendue : ${e.classes}`);
        assert.equal(await p.eval(`getComputedStyle(document.querySelector('#encadre'), '::after').animationName`), 'anim-tampon');
      } else {
        assert.equal(e.classes.some((c) => c.startsWith('anim-')), false, `aucune classe d'animation : ${e.classes}`);
      }
      // Scene suivante : la classe de l'encadre precedent ne reste pas.
      await p.cliquer('#bouton-suivant');
      await p.attendre(`document.querySelector('#scene').dataset.scene !== ${JSON.stringify(TRI)}`, 'scene suivante');
      assert.equal(await p.eval(`[...document.querySelector('#encadre').classList].some((c) => c.startsWith('anim-'))`), false);
      assert.deepEqual(p.erreurs, []);
    } finally {
      await p.fermer();
    }
  }
  // Jeu identique : meme issue, memes jauges.
  assert.deepEqual(bilan.true.jauges, bilan.false.jauges);
  assert.equal(bilan.true.choix, bilan.false.choix);
});

// ------------------------------------------------------------ EX-111 : EX-051 bis

function hashFichier(f) {
  return createHash('sha256').update(readFileSync(f)).digest('hex');
}

/** Extrait le bloc de code qui suit `marqueur` dans le guide (pour rejouer exactement l'exemple). */
function blocDuGuide(guide, marqueur, langage) {
  const debut = guide.indexOf(marqueur);
  assert.ok(debut >= 0, `guide : ${marqueur}`);
  const m = guide.slice(debut).match(new RegExp('```' + langage + '\\r?\\n([\\s\\S]*?)```'));
  assert.ok(m, `guide : bloc ${langage} apres ${marqueur}`);
  return m[1];
}

test('EX-051 bis / EX-114 : type essai-bouton du guide ajoute dans une copie (fichier + une ligne, joueur de test + une ligne), valide, joue jusqu\'a une fin, coeur inchange', async () => {
  const tmp = mkdtempSync(join(tmpdir(), PREFIXE));
  temporaires.push(tmp);
  const site = join(tmp, 'site');
  for (const r of ['index.html', 'css', 'js', 'data', 'outils', 'tests']) cpSync(join(DEPOT, r), join(site, r), { recursive: true });
  const coeur = ['js/moteur.js', 'js/interface.js', 'tests/partie.mjs'];
  const avant = coeur.map((f) => hashFichier(join(DEPOT, f)));

  // Le guide, tel quel : le fichier du type, la ligne d'enregistrement, la scene, le joueur de test et sa ligne.
  const guide = readFileSync(join(DEPOT, 'docs', 'AJOUTER_UN_TYPE_DE_SCENE.md'), 'utf8');
  writeFileSync(join(site, 'js', 'types', 'essai-bouton.js'), blocDuGuide(guide, '### 3.1', 'js'));
  const ligne = blocDuGuide(guide, '### 3.2', 'js').trim();
  assert.equal(ligne.split('\n').length, 1, 'une seule ligne a ajouter');
  const index = join(site, 'js', 'types', 'index.js');
  writeFileSync(index, `${readFileSync(index, 'utf8')}${ligne}\n`);
  const scene = JSON.parse(blocDuGuide(guide, '### 3.3', 'json'));
  writeFileSync(join(site, 'tests', 'joueurs', 'essai-bouton.mjs'), blocDuGuide(guide, '### 7.1', 'js'));
  const ligneJoueur = blocDuGuide(guide, '### 7.2', 'js').trim();
  assert.equal(ligneJoueur.split('\n').length, 1, 'une seule ligne a ajouter pour le joueur');
  const indexJoueurs = join(site, 'tests', 'joueurs', 'index.mjs');
  writeFileSync(indexJoueurs, `${readFileSync(indexJoueurs, 'utf8')}${ligneJoueur}\n`);

  // Scene placee en fin du chapitre "chantier" du plombier : les choix qui terminaient le chapitre y menent.
  const fProfil = join(site, 'data', 'profils', 'plombier', 'profil.json');
  const profil = JSON.parse(readFileSync(fProfil, 'utf8'));
  const chap = profil.chapitres.find((c) => c.id === 'chantier');
  for (const s of chap.scenes) for (const c of s.choix) if (c.suivant === null) c.suivant = scene.id;
  chap.scenes.push(scene);
  writeFileSync(fProfil, `${JSON.stringify(profil, null, 2)}\n`);

  // Validateur de la copie (il lit le registre de la copie) : vert ; sans la ligne d'enregistrement : type inconnu.
  const { valider } = await import(pathToFileURL(join(site, 'outils', 'valider.mjs')).href);
  const rapport = valider({ racine: join(site, 'data') });
  assert.deepEqual(rapport.erreurs, [], 'validateur vert avec le type enregistre');

  // Partie jouee par le jouerPartie de la copie (inchange), qui trouve le joueur essai-bouton dans son registre.
  const partieCopie = await import(pathToFileURL(join(site, 'tests', 'partie.mjs')).href);
  assert.ok(partieCopie.JOUEURS.has('essai-bouton'), 'joueur de test enregistre dans la copie');
  const srvSite = await servir(site);
  const p = await nav.nouvellePage();
  try {
    await p.aller(`${srvSite.origine}/`);
    await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
    await allerAuChoix(p);
    // Suite figee de la fin "etanche" du plombier ; le resultat 1 de la scene essai-bouton suit le chapitre chantier.
    const suite = [...SUITES_FINS.plombier['plombier-fin-etanche']];
    suite.splice(suite.indexOf('chantier-s3-a') + 1, 0, 1);
    const { resultat, scenario } = await partieCopie.jouerPartie(p, join(site, 'data'), 'plombier', suite);
    assert.equal(resultat.id, 'plombier-fin-etanche', 'une fin est atteinte');
    assert.ok(scenario.chapitres.flatMap((c) => c.scenes).some((s) => s.id === 'chantier-bouton'));
    assert.equal(await ecran(p), 'ecran-fin');
    assert.deepEqual(p.erreurs, [], 'erreurs console');
    assert.deepEqual(p.requetesExternes(srvSite.origine), []);
  } finally {
    await p.fermer();
    await srvSite.fermer();
  }

  // Sans la ligne d'enregistrement : type inconnu (nouveau processus, le registre est relu).
  writeFileSync(index, readFileSync(join(DEPOT, 'js', 'types', 'index.js')));
  const r = spawnSync(process.execPath, [join(site, 'outils', 'valider.mjs'), '--racine', join(site, 'data')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /profils\/plombier\/profil\.json : scene "chantier-bouton", champ "type" : type "essai-bouton" inconnu/);

  assert.deepEqual(coeur.map((f) => hashFichier(join(site, f))), avant, 'js/moteur.js et js/interface.js identiques a l\'original');
});
