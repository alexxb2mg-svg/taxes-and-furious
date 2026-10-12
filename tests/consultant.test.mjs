// Profil consultant (EX-140, EX-143) : ouverture propre au profil et consequence differee.
// La fin "Pivot reussi" n'est atteignable que si, au chapitre d'ouverture, le week-end du seminaire
// a ete regle sur le compte personnel (choix kick-off-s1-a) : verifie par exploration memoisee
// de toutes les parties, avec puis sans ce choix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';

const { scenario } = chargerScenario(DONNEES, 'consultant');

function finsAtteignables(exclus = []) {
  const atteintes = new Set();
  const vus = new Set();
  const pile = [nouvellePartie(scenario)];
  while (pile.length) {
    const e = pile.pop();
    const cle = JSON.stringify([e.chapitre, e.scene, e.terminee, e.anticipee, e.jauges]);
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (estTerminee(e)) {
      atteintes.add(fin(e).id);
      continue;
    }
    for (const x of etapesPossibles(sceneCourante(e))) if (!exclus.includes(x)) pile.push(resoudre(e, x));
  }
  return atteintes;
}

test('consultant : le parcours commence par le chapitre d\'ouverture, avant le tronc (EX-140)', () => {
  assert.equal(scenario.chapitres[0].id, 'profil:kick-off');
  assert.equal(sceneCourante(nouvellePartie(scenario)).id, 'kick-off-s1');
});

test('consultant : "Pivot reussi" atteignable seulement en reglant le seminaire de sa poche (consequence differee, EX-143)', () => {
  assert.ok(finsAtteignables().has('consultant-fin-pivot'), 'fin atteignable avec le choix kick-off-s1-a');
  const sans = finsAtteignables(['kick-off-s1-a']);
  assert.ok(!sans.has('consultant-fin-pivot'), 'fin inatteignable sans le choix kick-off-s1-a');
  for (const id of ['consultant-fin-burn', 'consultant-fin-dictionnaire', 'fin-defaut', 'fin-patience']) {
    assert.ok(sans.has(id), `${id} reste atteignable sans le choix kick-off-s1-a`);
  }
});
