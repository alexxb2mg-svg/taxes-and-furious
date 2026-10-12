import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assembler, nouvellePartie, choisir, estTerminee, fin, sceneCourante, borner,
} from '../js/moteur.js';
import { DEPOT, DONNEES, DONNEES_DEMO, chargerScenario, lireJson } from './aides.mjs';

const jouer = (scenario, suite) => suite.reduce((e, id) => choisir(e, id), nouvellePartie(scenario));

/** Parcourt toutes les suites de choix ; appelle visiter(etat) a chaque etat. */
function explorer(scenario, visiter) {
  let terminees = 0;
  const pile = [nouvellePartie(scenario)];
  while (pile.length) {
    const e = pile.pop();
    visiter(e);
    if (estTerminee(e)) {
      terminees += 1;
      continue;
    }
    for (const c of sceneCourante(e).choix) pile.push(choisir(e, c.id));
  }
  return terminees;
}

// ------------------------------------------------------------ EX-010, EX-021

test('EX-010 : moteur.js sans document, window, fetch ni localStorage', () => {
  const src = readFileSync(join(DEPOT, 'js', 'moteur.js'), 'utf8');
  assert.deepEqual(src.split('\n').filter((l) => /document|window|fetch|localStorage/.test(l)), []);
});

test('EX-021 : aucun nom de personnage ni texte de contenu dans js/', () => {
  const src = readFileSync(join(DEPOT, 'js', 'moteur.js'), 'utf8');
  assert.deepEqual(src.split('\n').filter((l) => /rectif|addition|tableur|frange|poney|story|cindy/i.test(l)), []);
});

test('EX-010 : le moteur expose assembler, nouvellePartie, choisir, estTerminee, fin', async () => {
  const m = await import('../js/moteur.js');
  for (const f of ['assembler', 'nouvellePartie', 'choisir', 'estTerminee', 'fin']) assert.equal(typeof m[f], 'function', f);
});

// ------------------------------------------------------------ assemblage

test('assembler : parcours deroule dans l\'ordre du profil, scene d\'entree = premiere du tableau', () => {
  const { scenario, profil } = chargerScenario(DONNEES_DEMO, 'demo-glacier');
  assert.deepEqual(scenario.chapitres.map((c) => c.id), profil.parcours);
  assert.deepEqual(scenario.chapitres.map((c) => c.origine), ['tronc', 'tronc', 'profil', 'tronc']);
  const e = nouvellePartie(scenario);
  assert.equal(e.scene, 'avis-s1');
  assert.equal(e.chapitre, 0);
});

test('assembler : variantes appliquees sur texte et reaction, effets et explication du tronc conserves', () => {
  const { scenario, tronc, variantes } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const scene = scenario.chapitres[0].scenes.find((s) => s.id === 'avis-s2');
  const original = tronc.chapitres[0].scenes.find((s) => s.id === 'avis-s2');
  assert.equal(scene.texte, variantes['avis-s2'].texte);
  const a = scene.choix.find((c) => c.id === 'avis-s2-a');
  const aOrig = original.choix.find((c) => c.id === 'avis-s2-a');
  assert.equal(a.reaction, variantes['avis-s2'].choix['avis-s2-a'].reaction);
  assert.equal(a.texte, aOrig.texte, 'texte non surcharge = texte du tronc');
  assert.deepEqual(a.effets, aOrig.effets);
  assert.equal(a.explication, aOrig.explication);
  assert.deepEqual(a.references, aOrig.references);
  const b = scene.choix.find((c) => c.id === 'avis-s2-b');
  assert.equal(b.texte, variantes['avis-s2'].choix['avis-s2-b'].texte);
  // l'autre profil voit le texte du tronc
  const autre = chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario.chapitres[0].scenes.find((s) => s.id === 'avis-s2');
  assert.equal(autre.texte, original.texte);
});

test('assembler : roles resolus (profil, generiques de communs, narrateur sans portrait)', () => {
  const fl = chargerScenario(DONNEES_DEMO, 'demo-fleuriste').scenario;
  assert.equal(fl.personnages.roles.verificateur.id, 'pistil');
  assert.equal(fl.personnages.roles.verificateur.portrait, 'profils/demo-fleuriste/img/pistil.webp');
  assert.equal(fl.personnages.roles.verificateur.repli, 'profils/demo-fleuriste/img/pistil.svg', 'EX-152 : repli SVG de meme nom');
  assert.equal(fl.personnages.roles.comptable.id, 'bilan', 'comptable porte par le profil');
  assert.equal(fl.personnages.roles.comptable.repli, null, 'portrait SVG : pas de repli');
  assert.equal(fl.personnages.roles.joueur.portrait, 'communs/img/joueur.svg', 'joueur generique');

  const { scenario: gl, communs } = chargerScenario(DONNEES_DEMO, 'demo-glacier');
  const generique = communs.personnages.find((p) => p.role === 'comptable');
  assert.equal(gl.personnages.roles.comptable.nom, generique.nom, 'comptable generique quand le profil n\'en a pas');
  assert.equal(gl.personnages.roles.comptable.portrait, 'communs/img/comptable.svg');
  const s3 = gl.chapitres[0].scenes.find((s) => s.id === 'avis-s3');
  assert.equal(s3.personnage.nom, generique.nom);
  const narr = gl.chapitres[0].scenes.find((s) => s.id === 'avis-s1').personnage;
  assert.equal(narr.role, 'narrateur');
  assert.equal(narr.portrait, null);
  const cornet = gl.chapitres[2].scenes[0].personnage;
  assert.equal(cornet.id, 'sorbet');
});

test('assembler : jauges initiales = defaut, puis tronc, puis profil', () => {
  const gl = chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario;
  assert.deepEqual({ ...gl.jauges_initiales }, { redressement: 0, patience: 60, stress: 40 });
  const fl = chargerScenario(DONNEES_DEMO, 'demo-fleuriste').scenario;
  assert.deepEqual({ ...fl.jauges_initiales }, { redressement: 0, patience: 70, stress: 30 });
});

test('assembler : appel a 3 arguments (sans communs) possible, roles generiques sans nom', () => {
  const tronc = lireJson(DONNEES_DEMO, 'tronc.json');
  const profil = lireJson(DONNEES_DEMO, 'profils/demo-glacier/profil.json');
  const s = assembler(tronc, profil, {});
  assert.equal(s.personnages.roles.comptable.nom, null);
  assert.equal(s.personnages.roles.verificateur.id, 'sorbet');
});

test('assembler : ne modifie pas ses arguments', () => {
  const tronc = lireJson(DONNEES_DEMO, 'tronc.json');
  const profil = lireJson(DONNEES_DEMO, 'profils/demo-fleuriste/profil.json');
  const variantes = lireJson(DONNEES_DEMO, 'profils/demo-fleuriste/variantes.json');
  const communs = lireJson(DONNEES_DEMO, 'communs/personnages.json');
  const avant = structuredClone({ tronc, profil, variantes, communs });
  const s = assembler(tronc, profil, variantes, communs);
  assert.deepEqual({ tronc, profil, variantes, communs }, avant);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.chapitres[0].scenes[0].choix[0]));
});

test('assembler : erreurs explicites (role verificateur non porte, chapitre inconnu)', () => {
  const tronc = lireJson(DONNEES_DEMO, 'tronc.json');
  const profil = lireJson(DONNEES_DEMO, 'profils/demo-glacier/profil.json');
  assert.throws(() => assembler(tronc, { ...profil, personnages: [] }), /role "verificateur" porte par aucun personnage/);
  assert.throws(() => assembler(tronc, { ...profil, parcours: ['tronc:avis', 'profil:inconnu'] }), /chapitre du profil "inconnu" introuvable/);
});

// ------------------------------------------------------------ deroulement

test('choisir : nouvel etat, ancien intact, scenes enchainees jusqu\'a la fin du parcours', () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const e0 = nouvellePartie(scenario);
  const copie0 = structuredClone(e0);
  const e1 = choisir(e0, 'avis-s1-a');
  assert.deepEqual(structuredClone(e0), copie0, 'ancien etat intact');
  assert.ok(Object.isFrozen(e0) && Object.isFrozen(e0.jauges));
  assert.notEqual(e0, e1);
  assert.equal(e1.scene, 'avis-s2');
  assert.deepEqual({ ...e1.jauges }, { redressement: 0, patience: 75, stress: 25 });
  assert.equal(e1.scenesJouees, 1);
  assert.equal(e1.bonsReflexes, 1);
  // fin de chapitre -> premiere scene du chapitre suivant (chapitre du profil)
  const e3 = choisir(choisir(e1, 'avis-s2-a'), 'avis-s3-a');
  assert.equal(e3.scene, 'caisse-s1');
  assert.equal(e3.chapitre, 1);
  assert.throws(() => choisir(e3, 'avis-s1-a'), /absent de la scene "caisse-s1"/);
});

test('fin normale : partie complete, score et anticipee=false', () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const e = jouer(scenario, ['avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a',
    'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a']);
  assert.equal(estTerminee(e), true);
  assert.equal(e.anticipee, false);
  assert.throws(() => choisir(e, 'avis-s1-a'), /partie terminee/);
  const f = fin(e, scenario);
  assert.equal(f.id, 'fleuriste-fin-bouquet');
  assert.equal(f.anticipee, false);
  assert.equal(f.redressement, 1500);
  assert.equal(f.scenesJouees, 11);
  assert.equal(f.bonsReflexes, 11);
  assert.throws(() => fin(nouvellePartie(scenario), scenario), /partie non terminee/);
});

// ------------------------------------------------------------ EX-011

test('EX-011 : jauges bornees sur toutes les suites de choix des scenarios de demonstration', () => {
  for (const id of ['demo-fleuriste', 'demo-glacier']) {
    const { scenario } = chargerScenario(DONNEES_DEMO, id);
    let etats = 0;
    const terminees = explorer(scenario, (e) => {
      etats += 1;
      const { redressement, patience, stress } = e.jauges;
      assert.ok(Number.isInteger(redressement) && redressement >= 0, `${id} redressement ${redressement}`);
      assert.ok(Number.isInteger(patience) && patience >= 0 && patience <= 100, `${id} patience ${patience}`);
      assert.ok(Number.isInteger(stress) && stress >= 0 && stress <= 100, `${id} stress ${stress}`);
      if (estTerminee(e)) assert.ok(fin(e, scenario).id);
    });
    assert.ok(terminees > 1000, `${id} : ${terminees} parties explorees`);
    assert.ok(etats > terminees);
  }
});

function scenarioExtreme() {
  const choix = (id, delta, suivant, juste = true) => ({
    id, texte: 't', juste, effets: { redressement: delta, patience: delta, stress: -delta },
    reaction: 'r', explication: 'e', references: [], suivant,
  });
  const tronc = {
    titre: 'x',
    chapitres: [
      { id: 'a', titre: 'A', scenes: [
        { id: 'a1', personnage: 'narrateur', texte: 't', choix: [choix('a1-p', 1000, 'a2'), choix('a1-m', -1000, 'a2', false), choix('a1-z', 0, 'a2')] },
        { id: 'a2', personnage: 'verificateur', texte: 't', choix: [choix('a2-p', 1000, null), choix('a2-m', -1000, null, false)] },
      ] },
      { id: 'b', titre: 'B', scenes: [
        { id: 'b1', personnage: 'joueur', texte: 't', choix: [choix('b1-p', 1000, null), choix('b1-m', -1000, null, false)] },
      ] },
    ],
    fins: [
      { id: 'fin-patience', titre: 'p', texte: 'p', conditions: [{ jauge: 'patience', op: '<=', valeur: 0 }] },
      { id: 'fin-defaut', titre: 'd', texte: 'd', conditions: [] },
    ],
  };
  const profil = {
    id: 'extreme', personnages: [{ id: 'v', role: 'verificateur', nom: 'V', portrait: 'img/v.svg' }],
    parcours: ['tronc:a', 'tronc:b'], chapitres: [],
    fins: [{ id: 'x1', titre: 'x', texte: 'x', conditions: [{ jauge: 'stress', op: '==', valeur: 100 }] },
      { id: 'x2', titre: 'x', texte: 'x', conditions: [{ jauge: 'redressement', op: '>=', valeur: 3000 }] }],
  };
  return assembler(tronc, profil, {});
}

test('EX-011 : deltas extremes +/-1000, jauges toujours bornees', () => {
  const scenario = scenarioExtreme();
  const vus = { patience0: false, patience100: false, stress0: false, stress100: false };
  explorer(scenario, (e) => {
    const { redressement, patience, stress } = e.jauges;
    assert.ok(redressement >= 0);
    assert.ok(patience >= 0 && patience <= 100);
    assert.ok(stress >= 0 && stress <= 100);
    if (patience === 0) vus.patience0 = true;
    if (patience === 100) vus.patience100 = true;
    if (stress === 0) vus.stress0 = true;
    if (stress === 100) vus.stress100 = true;
  });
  assert.deepEqual(vus, { patience0: true, patience100: true, stress0: true, stress100: true });
  assert.equal(borner('redressement', -5), 0);
  assert.equal(borner('patience', 250), 100);
  assert.equal(borner('stress', -1), 0);
});

// ------------------------------------------------------------ EX-012

test('EX-012 : patience a 0 des la premiere scene -> fin-patience, anticipee, meme si une fin de profil est satisfaite', () => {
  const tronc = lireJson(DONNEES_DEMO, 'tronc.json');
  const profil = structuredClone(lireJson(DONNEES_DEMO, 'profils/demo-glacier/profil.json'));
  const premier = structuredClone(tronc);
  premier.chapitres[0].scenes[0].choix[0].effets = { patience: -100, redressement: 100000 };
  profil.fins.unshift({ id: 'fin-profil-redresse', titre: 't', texte: 't', conditions: [{ jauge: 'redressement', op: '>=', valeur: 1 }] });
  const scenario = assembler(premier, profil, {}, lireJson(DONNEES_DEMO, 'communs/personnages.json'));
  const e = choisir(nouvellePartie(scenario), 'avis-s1-a');
  assert.equal(estTerminee(e), true, 'arret au milieu du premier chapitre');
  assert.equal(e.anticipee, true);
  assert.equal(e.scenesJouees, 1);
  const f = fin(e, scenario);
  assert.equal(f.id, 'fin-patience');
  assert.equal(f.anticipee, true);
  assert.equal(f.redressement, 100000);
});

test('EX-012 : fin anticipee au milieu d\'un chapitre sur les donnees de demonstration', () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-glacier');
  const e = jouer(scenario, ['avis-s1-b', 'avis-s3-a', 'fec-s1-b', 'fec-s2-b', 'fec-s3-b']);
  assert.equal(e.jauges.patience, 0);
  assert.equal(estTerminee(e), true);
  assert.equal(fin(e, scenario).id, 'fin-patience');
});

// ------------------------------------------------------------ EX-013

test('EX-013 : determinisme (deux parties identiques, etats finaux egaux)', () => {
  const suite = ['avis-s1-b', 'avis-s3-b', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'cornets-s1-b', 'cornets-s2-a',
    'rectification-s1-c', 'rectification-s2-a', 'rectification-s3-b'];
  const a = jouer(chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario, suite);
  const b = jouer(chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario, suite);
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(fin(a), fin(b));
});

// ------------------------------------------------------------ EX-014

// Chaque fin de chaque profil (demonstration et modele), atteinte par une suite de choix explicite.
// L'ordre d'evaluation (fins du profil, puis communes) se lit dans les cas ou plusieurs fins sont vraies.
const FINS_ATTENDUES = {
  'demo-fleuriste': {
    // patience 100 et redressement 1500 : bouquet (profil) ET sereine (commune) vraies -> profil d'abord
    'fleuriste-fin-bouquet': ['avis-s1-b', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'fleuriste-fin-fanee': ['avis-s1-b', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-b', 'rectification-s1-c', 'rectification-s2-b', 'rectification-s3-b'],
    'fin-sereine': ['avis-s1-b', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'rectification-s1-a', 'rectification-s2-b', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-patience': ['avis-s1-a', 'avis-s2-b', 'avis-s3-b', 'caisse-s1-b', 'caisse-s2-b', 'fec-s1-b'],
  },
  'demo-glacier': {
    'glacier-fin-givre': ['avis-s1-b', 'avis-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'cornets-s1-a', 'cornets-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'glacier-fin-fondue': ['avis-s1-b', 'avis-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-b', 'cornets-s1-a', 'cornets-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-sereine': ['avis-s1-b', 'avis-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'cornets-s1-a', 'cornets-s2-a', 'rectification-s1-a', 'rectification-s2-b', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'cornets-s1-a', 'cornets-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-patience': ['avis-s1-b', 'avis-s3-a', 'fec-s1-b', 'fec-s2-b', 'fec-s3-b'],
  },
  _modele: {
    'modele-fin-1': ['avis-s1-b', 'avis-s3-a', 'avis-s4-a', 'modele-s1-a', 'modele-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'modele-fin-2': ['avis-s1-b', 'avis-s3-a', 'avis-s4-b', 'modele-s1-a', 'modele-s2-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-b', 'rectification-s1-c', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-patience': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'modele-s1-b', 'modele-s2-b', 'fec-s1-b'],
  },
};

for (const [id, fins] of Object.entries(FINS_ATTENDUES)) {
  test(`EX-014 : profil "${id}", chaque fin propre atteinte par une suite explicite`, () => {
    const racine = id === '_modele' ? DONNEES : DONNEES_DEMO;
    const { scenario, profil } = chargerScenario(racine, id);
    for (const f of profil.fins) assert.ok(fins[f.id], `fin "${f.id}" sans suite de choix dans le test`);
    for (const [idFin, suite] of Object.entries(fins)) {
      const e = jouer(scenario, suite);
      assert.equal(estTerminee(e), true, `${idFin} : partie terminee`);
      assert.equal(fin(e, scenario).id, idFin, `suite ${suite.join(' > ')}`);
    }
  });
}

test('EX-014 : fin de profil prioritaire sur une fin commune satisfaite en meme temps', () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const e = jouer(scenario, FINS_ATTENDUES['demo-fleuriste']['fleuriste-fin-bouquet']);
  const sereine = scenario.fins.find((f) => f.id === 'fin-sereine');
  assert.ok(sereine.conditions.every(({ jauge, op, valeur }) => (op === '<=' ? e.jauges[jauge] <= valeur : false)),
    'la fin commune "fin-sereine" est aussi satisfaite');
  assert.equal(fin(e, scenario).id, 'fleuriste-fin-bouquet');
  assert.deepEqual(scenario.fins.map((f) => f.id), ['fleuriste-fin-bouquet', 'fleuriste-fin-fanee', 'fin-sereine', 'fin-defaut']);
});
