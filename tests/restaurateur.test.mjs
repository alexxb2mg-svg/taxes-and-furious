// Profil restaurateur (EX-143) : la fin « Le fantôme de la caisse » est une conséquence différée du choix
// d'ouverture coup-de-feu-s1-b (installer le module de caisse qui masque des ventes). Sans ce choix,
// aucune partie ne peut l'atteindre ; avec lui, une suite explicite l'atteint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

const { scenario } = chargerScenario(DONNEES, 'restaurateur');
const FIN = 'restaurateur-fin-fantome';
const DECLENCHEUR = 'coup-de-feu-s1-b';

/** Fins atteignables en interdisant certaines etapes (etats identiques explores une seule fois). */
function finsAtteignables(interdits = new Set()) {
  const atteintes = new Set();
  const vus = new Set();
  const pile = [nouvellePartie(scenario)];
  while (pile.length) {
    const e = pile.pop();
    const cle = JSON.stringify([e.chapitre, e.scene, e.jauges, e.terminee, e.anticipee]);
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (estTerminee(e)) {
      atteintes.add(fin(e).id);
      continue;
    }
    for (const x of etapesPossibles(sceneCourante(e))) if (!interdits.has(x)) pile.push(resoudre(e, x));
  }
  return atteintes;
}

test('restaurateur : le parcours s\'ouvre sur le chapitre propre au profil, où se trouve le choix déclencheur', () => {
  assert.equal(scenario.chapitres[0].id, 'profil:coup-de-feu');
  assert.ok(scenario.chapitres[0].scenes.some((s) => s.choix?.some((c) => c.id === DECLENCHEUR)));
});

test(`restaurateur : "${FIN}" n'est atteignable qu'après le choix "${DECLENCHEUR}"`, () => {
  const sans = finsAtteignables(new Set([DECLENCHEUR]));
  assert.ok(!sans.has(FIN), `"${FIN}" atteinte sans "${DECLENCHEUR}"`);
  assert.ok(finsAtteignables().has(FIN));
  const suite = SUITES_FINS.restaurateur[FIN];
  assert.ok(suite.includes(DECLENCHEUR));
  let e = nouvellePartie(scenario);
  for (const x of suite) e = resoudre(e, x);
  assert.equal(fin(e).id, FIN);
});
