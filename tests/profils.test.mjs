// Contenu reel de data/ (C2) : chaque fin de chaque profil atteinte par une suite de choix explicite,
// et aucune fin inatteignable (exploration exhaustive des parties).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario, lireJson } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';
import { valider, PROFILS_OBLIGATOIRES } from '../outils/valider.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

const IDS = lireJson(DONNEES, 'profils/index.json');

function idsFins(scenario) {
  return [...scenario.fins.map((f) => f.id), scenario.finPatience.id];
}

function jouer(scenario, suite) {
  let etat = nouvellePartie(scenario);
  for (const id of suite) {
    assert.equal(estTerminee(etat), false, `partie terminee avant le choix "${id}"`);
    etat = resoudre(etat, id); // id de choix, ou resultat d'un mini-jeu (EX-110)
  }
  assert.equal(estTerminee(etat), true, 'partie non terminee a la fin de la suite');
  return fin(etat);
}

// Les 6 profils initiaux (section 2.2) sont dans l'index, dans l'ordre de la spec ; un profil
// ajoute ensuite (docs/CREER_UN_PROFIL.md) peut s'y intercaler sans casser ce test.
const INITIAUX = Object.keys(PROFILS_OBLIGATOIRES);

test('data/ : les 6 profils initiaux sont dans l\'index, dans l\'ordre de la spec', () => {
  assert.deepEqual(IDS.filter((id) => INITIAUX.includes(id)), INITIAUX);
});

test('EX-142 : chaque choix du tronc est joue par au moins une suite de tests/suites-fins.mjs (donc dans le navigateur)', () => {
  const joues = new Set(Object.values(SUITES_FINS).flatMap((fins) => Object.values(fins).flat()));
  const tronc = lireJson(DONNEES, 'tronc.json');
  const absents = tronc.chapitres.flatMap((c) => c.scenes).flatMap((s) => (s.choix ?? []).map((c) => c.id)).filter((id) => !joues.has(id));
  assert.deepEqual(absents, []);
});

test('data/ : validateur vert sur tout data/ (couverture comprise)', () => {
  const r = valider({ racine: DONNEES });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
  assert.deepEqual(r.profils, IDS);
});

for (const id of IDS) {
  const { scenario } = chargerScenario(DONNEES, id);

  // EX-014 vise les profils initiaux ; pour un profil ajoute, les suites sont facultatives
  // (l'exploration exhaustive ci-dessous verifie quand meme que chaque fin est atteignable).
  const initial = INITIAUX.includes(id);
  test(`${id} : une suite explicite par fin (profil puis communes), chacune atteint sa fin`, () => {
    const suites = SUITES_FINS[id];
    if (!initial && !suites) return; // jamais saute : le test passe, l'exploration couvre ce profil
    assert.ok(suites, `aucune suite pour "${id}" dans tests/suites-fins.mjs`);
    assert.deepEqual(Object.keys(suites).sort(), idsFins(scenario).sort(), 'une suite par fin, ni plus ni moins');
    for (const [idFin, suite] of Object.entries(suites)) {
      const f = jouer(scenario, suite);
      assert.equal(f.id, idFin, `suite de "${idFin}"`);
      assert.equal(f.anticipee, idFin === 'fin-patience');
    }
  });

  test(`${id} : exploration exhaustive, toutes les fins sont atteignables`, () => {
    const atteintes = new Set();
    const pile = [nouvellePartie(scenario)];
    // La suite d'une partie ne depend que de la position et des jauges : deux etats identiques sur ces
    // points menent aux memes fins. Les explorer une seule fois garde le test rapide avec 16 a 24 scenes
    // a 3 ou 4 choix (EX-142, EX-143), ou le nombre de parties possibles depasse le milliard.
    const vus = new Set();
    let parties = 0;
    while (pile.length) {
      const e = pile.pop();
      const cle = JSON.stringify([e.chapitre, e.scene, e.jauges, e.terminee, e.anticipee]);
      if (vus.has(cle)) continue;
      vus.add(cle);
      if (estTerminee(e)) {
        parties += 1;
        atteintes.add(fin(e).id);
        continue;
      }
      for (const x of etapesPossibles(sceneCourante(e))) pile.push(resoudre(e, x));
    }
    assert.ok(parties > 0);
    assert.deepEqual([...atteintes].sort(), idsFins(scenario).sort());
  });
}
