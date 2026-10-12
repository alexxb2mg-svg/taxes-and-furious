// Profil galeriste : consequence differee (EX-143). La fin « Le livre d'or a parle » n'est atteignable
// que si la vente du vernissage a ete passee sous silence (choix vernissage-s1-b, chapitre d'ouverture).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';

const CHOIX_DIFFERE = 'vernissage-s1-b';
const FIN_DIFFEREE = 'galeriste-fin-livre-or';

/** Fins atteignables en s'interdisant certains choix (etats dedoublonnes sur position + jauges). */
function finsAtteignables(scenario, interdits) {
  const atteintes = new Set();
  const vus = new Set();
  const pile = [nouvellePartie(scenario)];
  while (pile.length) {
    const e = pile.pop();
    if (estTerminee(e)) {
      atteintes.add(fin(e).id);
      continue;
    }
    const cle = JSON.stringify([e.chapitre, e.scene, e.jauges]);
    if (vus.has(cle)) continue;
    vus.add(cle);
    for (const x of etapesPossibles(sceneCourante(e))) {
      if (!interdits.includes(x)) pile.push(resoudre(e, x));
    }
  }
  return atteintes;
}

test('galeriste EX-143 : la fin du livre d\'or exige la vente cachee du vernissage (chapitre d\'ouverture)', () => {
  const { scenario, profil } = chargerScenario(DONNEES, 'galeriste');
  assert.equal(profil.parcours[0], 'profil:vernissage');
  assert.ok(profil.chapitres[0].scenes[0].choix.some((c) => c.id === CHOIX_DIFFERE));
  assert.ok(profil.fins.some((f) => f.id === FIN_DIFFEREE));
  assert.ok(finsAtteignables(scenario, []).has(FIN_DIFFEREE), 'fin atteignable avec le choix');
  assert.equal(finsAtteignables(scenario, [CHOIX_DIFFERE]).has(FIN_DIFFEREE), false, 'fin inatteignable sans le choix');
});
