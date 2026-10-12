// Profil influenceuse (EX-143) : la fin "Dix ans de stories" est une consequence differee d'un choix
// du chapitre d'ouverture (garder l'adresse de Dubai, tournage-s2-b). Exploration de toutes les
// parties : cette fin n'est atteinte que si ce choix a ete fait, et elle l'est au moins une fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';

const FIN = 'influenceuse-fin-dix-ans';
const CHOIX = 'tournage-s2-b';

test(`influenceuse : la fin "${FIN}" n'est atteignable qu'apres le choix "${CHOIX}" (consequence differee)`, () => {
  const { scenario } = chargerScenario(DONNEES, 'influenceuse');
  assert.ok(scenario.chapitres[0].scenes.some((s) => s.choix?.some((c) => c.id === CHOIX)), `${CHOIX} est dans le chapitre d'ouverture`);
  const avec = new Set();
  const sans = new Set();
  const vus = new Set();
  const pile = [[nouvellePartie(scenario), false]];
  while (pile.length) {
    const [e, fait] = pile.pop();
    const cle = JSON.stringify([e.chapitre, e.scene, e.terminee, e.anticipee, e.jauges, fait]);
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (estTerminee(e)) {
      (fait ? avec : sans).add(fin(e).id);
      continue;
    }
    for (const x of etapesPossibles(sceneCourante(e))) pile.push([resoudre(e, x), fait || x === CHOIX]);
  }
  assert.ok(avec.has(FIN), `${FIN} atteinte apres ${CHOIX}`);
  assert.ok(!sans.has(FIN), `${FIN} atteinte sans ${CHOIX}`);
});
