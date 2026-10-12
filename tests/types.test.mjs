// Architecture d'extensions (lot 7.3), tests sans navigateur :
// EX-110 (moteur : resoudre, issues), EX-111 (registre de types, validateur), EX-112 (parametres du tri),
// EX-113 (registre d'animations, validateur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assembler, nouvellePartie, choisir, resoudre, estTerminee, fin, sceneCourante, issuePour, typeDe, trouverChoix,
} from '../js/moteur.js';
import * as types from '../js/types/index.js';
import tri, { compter } from '../js/types/tri.js';
import { ANIMATIONS, DUREE_MAX_MS } from '../js/animations.js';
import { valider } from '../outils/valider.mjs';
import { DEPOT, DONNEES, chargerScenario, copieTemporaire, appliquerModifs, lireJson } from './aides.mjs';
import { etapesPossibles, JOUEURS } from './partie.mjs';
import * as modulesJoueurs from './joueurs/index.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

/** Joue `suite` (ids de choix ou resultats) a partir du debut. */
const jouer = (scenario, suite) => suite.reduce((e, x) => resoudre(e, x), nouvellePartie(scenario));

/** Etat juste avant la scene `idScene`, en suivant la suite donnee. */
function avant(scenario, suite, idScene) {
  let e = nouvellePartie(scenario);
  for (const x of suite) {
    if (sceneCourante(e).id === idScene) return e;
    e = resoudre(e, x);
  }
  throw new Error(`scene ${idScene} jamais atteinte`);
}

// Scenario minimal avec une scene d'un type de test ("essai"), inconnu du registre : le moteur
// ne depend pas des types (il resout par les issues).
function scenarioEssai() {
  const choix = (id, suivant) => ({ id, texte: 't', juste: true, effets: {}, reaction: 'r', explication: 'e', references: [], suivant });
  const issue = (id, si, effets, juste = false) => ({ id, ...(si ? { si } : {}), juste, effets, reaction: `r ${id}`, explication: 'e', references: [], suivant: null });
  const tronc = {
    titre: 'x',
    chapitres: [
      { id: 'a', titre: 'A', scenes: [
        { id: 'a1', personnage: 'narrateur', texte: 't', choix: [choix('a1-x', 'a2'), choix('a1-y', 'a2')] },
        { id: 'a2', personnage: 'verificateur', type: 'essai', texte: 't', parametres: { n: 3 }, issues: [
          issue('a2-haut', [{ op: '>=', valeur: 3 }], { redressement: 0, patience: 10, stress: -10 }, true),
          issue('a2-champ', [{ champ: 'mode', op: '==', valeur: 'fuite' }], { redressement: 500, patience: -1000, stress: 0 }),
          issue('a2-bas', null, { redressement: 1000, patience: -10, stress: 10 }),
        ] },
      ] },
      { id: 'b', titre: 'B', scenes: [
        { id: 'b1', personnage: 'joueur', texte: 't', choix: [choix('b1-x', null), choix('b1-y', null)] },
      ] },
    ],
    fins: [
      { id: 'fin-patience', titre: 'p', texte: 'p', conditions: [{ jauge: 'patience', op: '<=', valeur: 0 }] },
      { id: 'fin-defaut', titre: 'd', texte: 'd', conditions: [] },
    ],
  };
  const profil = {
    id: 'essai', personnages: [{ id: 'v', role: 'verificateur', nom: 'V', portrait: 'img/v.svg' }],
    parcours: ['tronc:a', 'tronc:b'], chapitres: [],
    fins: [{ id: 'x1', titre: 'x', texte: 'x', conditions: [{ jauge: 'redressement', op: '>=', valeur: 1 }] }],
  };
  return assembler(tronc, profil, {});
}

// ------------------------------------------------------------ EX-110 : moteur

test('EX-110 : une scene sans champ type est de type "choix" ; les scenes existantes restent inchangees', () => {
  const { scenario } = chargerScenario(DONNEES, 'restaurateur');
  const scenes = scenario.chapitres.flatMap((c) => c.scenes);
  assert.ok(scenes.every((s) => typeDe(s) === 'choix' && s.type === 'choix' && Array.isArray(s.choix) && s.issues === undefined));
  // resoudre sur une scene a choix = choisir
  const e0 = nouvellePartie(scenario);
  const id = sceneCourante(e0).choix[0].id;
  assert.deepEqual(resoudre(e0, id), choisir(e0, id));
});

test('EX-110 : type de test resolu avec deux resultats differents -> deux issues differentes ; meme resultat -> meme etat', () => {
  const scenario = scenarioEssai();
  const e = resoudre(nouvellePartie(scenario), 'a1-x');
  assert.equal(sceneCourante(e).type, 'essai');
  assert.deepEqual(sceneCourante(e).parametres, { n: 3 });
  const haut = resoudre(e, 3);
  const bas = resoudre(e, 1);
  assert.equal(haut.dernierChoix, 'a2-haut');
  assert.equal(bas.dernierChoix, 'a2-bas');
  assert.notDeepEqual(haut.jauges, bas.jauges);
  assert.equal(haut.bonsReflexes, 2, 'issue juste comptee comme un bon reflexe');
  assert.equal(bas.bonsReflexes, 1);
  assert.equal(trouverChoix(haut, 'a2-haut').reaction, 'r a2-haut', 'trouverChoix retrouve aussi les issues');
  // EX-013 : meme etat + meme resultat = meme etat ; l'ancien etat est intact
  const avantJson = JSON.stringify(e);
  assert.deepEqual(resoudre(e, 3), haut);
  assert.deepEqual(resoudre(e, 5), haut, 'premiere issue satisfaite (>= 3)');
  assert.equal(JSON.stringify(e), avantJson);
  // les issues sont evaluees dans l'ordre ; condition sur un champ d'un resultat objet
  assert.equal(resoudre(e, { mode: 'fuite' }).dernierChoix, 'a2-champ');
  assert.equal(resoudre(e, { mode: 'calme' }).dernierChoix, 'a2-bas');
  assert.equal(issuePour(sceneCourante(e), 2).id, 'a2-bas');
});

test('EX-110 : issue = memes regles qu\'un choix (jauges bornees, fin anticipee, enchainement)', () => {
  const scenario = scenarioEssai();
  const e = resoudre(nouvellePartie(scenario), 'a1-x');
  const fuite = resoudre(e, { mode: 'fuite' });
  assert.equal(fuite.jauges.patience, 0, 'patience bornee a 0');
  assert.equal(estTerminee(fuite), true);
  assert.equal(fin(fuite, scenario).id, 'fin-patience');
  assert.equal(fin(fuite, scenario).anticipee, true);
  const suite = resoudre(e, 3);
  assert.equal(sceneCourante(suite).id, 'b1', 'suivant null : chapitre suivant');
  assert.equal(fin(resoudre(resoudre(e, 0), 'b1-x'), scenario).id, 'x1');
});

test('EX-110 : erreurs explicites (choisir sur un autre type, resultat non serialisable, scene a choix)', () => {
  const scenario = scenarioEssai();
  const e = resoudre(nouvellePartie(scenario), 'a1-x');
  assert.throws(() => choisir(e, 'a2-haut'), /de type "essai" : utiliser resoudre/);
  for (const mauvais of [undefined, Number.NaN, Infinity, () => 1, new Date(0)]) {
    assert.throws(() => resoudre(e, mauvais), /resultat non serialisable/, String(mauvais));
  }
  assert.throws(() => resoudre(nouvellePartie(scenario), 'inconnu'), /choix "inconnu" absent/);
});

test('EX-110 / EX-112 : la scene tri du consultant, 3 scores -> 3 issues ; parcours des fins inchange', () => {
  const { scenario } = chargerScenario(DONNEES, 'consultant');
  const suite = SUITES_FINS.consultant['consultant-fin-pivot'];
  const e = avant(scenario, suite, 'train-de-vie-tri');
  const scene = sceneCourante(e);
  assert.equal(scene.type, 'tri');
  assert.deepEqual(etapesPossibles(scene), [0, 1, 2, 3, 4, 5, 6]);
  const issues = Object.fromEntries([6, 4, 1].map((n) => [n, resoudre(e, n).dernierChoix]));
  assert.deepEqual(issues, { 6: 'train-de-vie-tri-parfait', 4: 'train-de-vie-tri-presque', 1: 'train-de-vie-tri-rate' });
  assert.equal(fin(jouer(scenario, suite), scenario).id, 'consultant-fin-pivot');
});

// ------------------------------------------------------------ EX-111 : registre

// Fonde sur le registre : un type ajoute en suivant le guide (fichier + une ligne) passe ces tests.
test('EX-111 : js/types/index.js enregistre au moins choix et tri, chaque type avec le contrat complet, une ligne par type', () => {
  const liste = Object.values(types);
  const noms = liste.map((t) => t.type);
  for (const attendu of ['choix', 'tri']) assert.ok(noms.includes(attendu), `type ${attendu} enregistre`);
  assert.equal(new Set(noms).size, noms.length, `noms de types en double : ${noms}`);
  for (const t of liste) {
    assert.match(t.type, /^[a-z][a-z0-9-]*$/, `nom de type ${t.type}`);
    assert.equal(typeof t.validerParametres, 'function', `${t.type}.validerParametres`);
    assert.equal(typeof t.rendre, 'function', `${t.type}.rendre`);
    assert.ok(Array.isArray(t.validerParametres(undefined)), `${t.type} : validerParametres renvoie une liste`);
    for (const f of ['decrire', 'resultatsPossibles']) {
      assert.ok(t[f] === undefined || typeof t[f] === 'function', `${t.type}.${f} : fonction facultative`);
    }
  }
  assert.deepEqual(types.choix.validerParametres(undefined), []);
  const src = readFileSync(join(DEPOT, 'js', 'types', 'index.js'), 'utf8');
  assert.equal(src.split('\n').filter((l) => l.startsWith('export ')).length, liste.length, 'une ligne par type');
});

test('EX-111 / EX-114 : chaque type enregistre a son joueur de test (tests/joueurs/index.mjs, une ligne par joueur)', () => {
  const noms = Object.values(types).map((t) => t.type).sort();
  const joueurs = Object.values(modulesJoueurs);
  for (const j of joueurs) assert.equal(typeof j.jouer, 'function', `joueur ${j.type} : jouer(page, scene, resultat)`);
  const sansJoueur = noms.filter((n) => !JOUEURS.has(n));
  assert.deepEqual(sansJoueur, [], `type(s) sans joueur de test : ajouter tests/joueurs/<type>.mjs et une ligne dans tests/joueurs/index.mjs (docs/AJOUTER_UN_TYPE_DE_SCENE.md, section 7)`);
  assert.deepEqual(joueurs.map((j) => j.type).sort(), noms, 'un joueur par type enregistre, sans joueur orphelin');
  const src = readFileSync(join(DEPOT, 'tests', 'joueurs', 'index.mjs'), 'utf8');
  assert.equal(src.split('\n').filter((l) => l.startsWith('export ')).length, joueurs.length, 'une ligne par joueur');
});

/** Valide une copie de data/ apres modifications ; renvoie les erreurs. */
function erreursApres(modifs) {
  const copie = copieTemporaire(DONNEES);
  try {
    appliquerModifs(copie.racine, modifs);
    return valider({ racine: copie.racine }).erreurs;
  } finally {
    copie.nettoyer();
  }
}

const F_CONSULTANT = 'profils/consultant/profil.json';
const SCENE_TRI = ['chapitres', 0, 'scenes', 2];

test('EX-111 : type inconnu = erreur nommant fichier, scene et type', () => {
  const profil = lireJson(DONNEES, F_CONSULTANT);
  assert.equal(profil.chapitres[0].scenes[2].id, 'train-de-vie-tri', 'chemin du temoin');
  const erreurs = erreursApres([{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'type'], valeur: 'memory' }]);
  assert.ok(erreurs.some((e) => e.startsWith('profils/consultant/profil.json : scene "train-de-vie-tri", champ "type" : type "memory" inconnu')), erreurs.join('\n'));
  assert.equal(erreurs.length, 1, `une seule erreur, sans cascade : ${erreurs.join('\n')}`);
});

test('EX-110 : issues : derniere conditionnelle, aucune juste, si mal forme, choix et issues melanges', () => {
  const cas = [
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 2, 'si'], valeur: [{ op: '<', valeur: 4 }] }], 'champ "issues" : la derniere issue ("train-de-vie-tri-rate") doit etre sans condition'],
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 0, 'juste'], valeur: false }], 'champ "issues" : aucune issue "juste"'],
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 0, 'si'], valeur: [{ op: '=>', valeur: 6 }] }], 'issue "train-de-vie-tri-parfait", champ "si" : operateur "=>" inconnu'],
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'choix'], valeur: [] }], 'champ "choix" : une scene de type "tri" n\'a pas de choix'],
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 1, 'references'], valeur: ['R-INCONNUE'] }], 'issue "train-de-vie-tri-presque"'],
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 1, 'suivant'], valeur: 'nulle-part' }], 'scene "nulle-part" introuvable'],
    // EX-003 s'applique aux explications des issues
    [[{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'issues', 0, 'explication'], valeur: 'Plafond de 99 999 €.' }], 'issue "train-de-vie-tri-parfait", champ "explication"'],
  ];
  for (const [modifs, attendu] of cas) {
    const erreurs = erreursApres(modifs);
    assert.ok(erreurs.some((e) => e.includes(attendu)), `attendu : ${attendu}\nobtenus :\n${erreurs.join('\n')}`);
  }
});

// ------------------------------------------------------------ EX-112 : parametres du tri

test('EX-112 : validerParametres du tri rejette bac attendu inconnu, moins de 3 pieces, plus de 8, bacs mal formes', () => {
  const p = lireJson(DONNEES, F_CONSULTANT).chapitres[0].scenes[2].parametres;
  assert.deepEqual(tri.validerParametres(p), []);
  const avec = (modif) => tri.validerParametres(modif(structuredClone(p)));
  const un = (erreurs, motif) => assert.ok(erreurs.some((e) => motif.test(e)), `${motif} dans ${JSON.stringify(erreurs)}`);
  un(avec((x) => { x.pieces[1].bac_attendu = 'Peut-etre'; return x; }), /piece 2, champ "bac_attendu" : bac "Peut-etre" inconnu/);
  un(avec((x) => { x.pieces = x.pieces.slice(0, 2); return x; }), /champ "pieces" : 2 piece\(s\), il en faut de 3 a 8/);
  un(avec((x) => { x.pieces = [...x.pieces, ...x.pieces]; return x; }), /12 piece\(s\), il en faut de 3 a 8/);
  un(avec((x) => { x.bacs = ['Seul']; return x; }), /champ "bacs" : 2 ou 3 noms/);
  un(avec((x) => { x.bacs = ['A', 'B', 'C', 'D']; return x; }), /champ "bacs" : 2 ou 3 noms/);
  un(avec((x) => { x.bacs = ['A', 'A']; return x; }), /noms de bacs en double/);
  un(avec((x) => { x.pieces[0].texte = ''; return x; }), /piece 1, champ "texte"/);
  un(avec((x) => { x.pieces[0].portrait = 'https://exemple.test/a.svg'; return x; }), /piece 1, champ "portrait" : chemin/);
  un(avec((x) => { x.minuterie = 30; return x; }), /champ "minuterie" inconnu/);
  un(tri.validerParametres(undefined), /obligatoire/);
  // portrait facultatif : accepte s'il existe dans le dossier du profil
  const portrait = (x) => { x.pieces[0].portrait = 'img/tableur.svg'; return x; };
  assert.deepEqual(tri.validerParametres(portrait(structuredClone(p)), { existe: () => true }), []);
  un(tri.validerParametres(portrait(structuredClone(p)), { existe: () => false }), /fichier "img\/tableur.svg" introuvable/);
});

test('EX-112 : le validateur reporte les erreurs de parametres du tri (fichier, scene, champ)', () => {
  const erreurs = erreursApres([{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'parametres', 'pieces', 0, 'bac_attendu'], valeur: 'Bof' }]);
  assert.ok(erreurs.some((e) => e.startsWith('profils/consultant/profil.json : scene "train-de-vie-tri", champ "parametres" : piece 1, champ "bac_attendu" : bac "Bof" inconnu')), erreurs.join('\n'));
  const portrait = erreursApres([{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'parametres', 'pieces', 0, 'portrait'], valeur: 'img/absent.svg' }]);
  assert.ok(portrait.some((e) => e.includes('fichier "img/absent.svg" introuvable')), portrait.join('\n'));
  assert.deepEqual(erreursApres([{ fichier: F_CONSULTANT, chemin: [...SCENE_TRI, 'parametres', 'pieces', 0, 'portrait'], valeur: 'img/tableur.svg' }]), []);
});

test('EX-112 : compter = nombre de pieces bien rangees ; scenes tri du consultant (restaurant, voiture, salaire) et du plombier', () => {
  const p = { bacs: ['A', 'B'], pieces: [{ texte: '1', bac_attendu: 'A' }, { texte: '2', bac_attendu: 'B' }, { texte: '3', bac_attendu: 'A' }] };
  assert.equal(compter(p, ['A', 'B', 'A']), 3);
  assert.equal(compter(p, ['B', 'B', null]), 1);
  for (const [id, scene, motifs] of [['consultant', 'train-de-vie-tri', [/restaurant|déjeuner|dîner/i, /voiture/i, /salaire/i]], ['plombier', 'devis-tri', []]]) {
    const { scenario } = chargerScenario(DONNEES, id);
    const s = scenario.chapitres.flatMap((c) => c.scenes).find((x) => x.id === scene);
    assert.equal(s?.type, 'tri', `${id} : scene ${scene}`);
    const textes = s.parametres.pieces.map((x) => x.texte).join(' | ');
    for (const m of motifs) assert.match(textes, m);
    assert.ok(s.issues.length >= 3, `${id} : au moins 3 issues (3 scores)`);
    assert.ok(s.issues.every((i) => i.references.length > 0));
  }
});

// ------------------------------------------------------------ EX-113 : animations

test('EX-113 : registre tampon et secousse, duree <= 600 ms, une regle CSS par classe, reduction de mouvement', () => {
  assert.ok(ANIMATIONS.tampon && ANIMATIONS.secousse);
  assert.equal(DUREE_MAX_MS, 600);
  const css = readFileSync(join(DEPOT, 'css', 'style.css'), 'utf8');
  for (const [nom, a] of Object.entries(ANIMATIONS)) {
    assert.ok(a.duree > 0 && a.duree <= DUREE_MAX_MS, `${nom} : ${a.duree} ms`);
    assert.ok(css.includes(`.${a.classe}`), `${nom} : regle .${a.classe} dans css/style.css`);
    // la duree CSS ne depasse pas celle du registre
    const durees = [...css.matchAll(new RegExp(`animation: ${a.classe} (\\d+)ms`, 'g'))].map((m) => Number(m[1]));
    assert.ok(durees.length > 0 && durees.every((d) => d === a.duree), `${nom} : durees CSS ${durees}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('EX-113 : animation inconnue (scene, issue ou choix) = erreur du validateur', () => {
  const cas = [
    [[...SCENE_TRI, 'animation'], 'scene "train-de-vie-tri", champ "animation" : animation "inconnue" inconnue'],
    [[...SCENE_TRI, 'issues', 0, 'animation'], 'issue "train-de-vie-tri-parfait", champ "animation" : animation "inconnue" inconnue'],
    [['chapitres', 0, 'scenes', 0, 'choix', 0, 'animation'], 'choix "train-de-vie-s1-a", champ "animation" : animation "inconnue" inconnue'],
  ];
  for (const [chemin, attendu] of cas) {
    const erreurs = erreursApres([{ fichier: F_CONSULTANT, chemin, valeur: 'inconnue' }]);
    assert.ok(erreurs.some((e) => e.includes(attendu)), `attendu : ${attendu}\nobtenus :\n${erreurs.join('\n')}`);
  }
  assert.deepEqual(erreursApres([{ fichier: F_CONSULTANT, chemin: ['chapitres', 0, 'scenes', 0, 'choix', 0, 'animation'], valeur: 'secousse' }]), []);
});
