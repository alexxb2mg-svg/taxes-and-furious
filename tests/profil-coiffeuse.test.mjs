// Profil coiffeuse : regles du lot 4 (EX-140 a EX-143) et consequence differee de la fin
// « Le carnet des habituees » (EX-143) : seul le choix samedi-s2-b, fait dans le chapitre
// d'ouverture du profil, permet de l'atteindre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';
import { valider } from '../outils/valider.mjs';

const ID = 'coiffeuse';
const FIN_DIFFEREE = 'coiffeuse-fin-carnet';
const CHOIX_DECLENCHEUR = 'samedi-s2-b';

test('coiffeuse : validateur vert avec les exigences du lot 4', () => {
  const r = valider({ racine: DONNEES, profil: ID, exigencesLot4: true });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
});

test('coiffeuse : le parcours commence par le chapitre d\'ouverture du profil (EX-140)', () => {
  const { scenario } = chargerScenario(DONNEES, ID);
  const e = nouvellePartie(scenario);
  assert.equal(sceneCourante(e).id, 'samedi-s1');
});

test(`coiffeuse : "${FIN_DIFFEREE}" n'est atteignable qu'apres le choix "${CHOIX_DECLENCHEUR}" (EX-143)`, () => {
  const { scenario } = chargerScenario(DONNEES, ID);
  const atteinte = { avec: false, sans: false };
  const vus = new Set();
  const pile = [{ e: nouvellePartie(scenario), declenche: false }];
  while (pile.length) {
    const { e, declenche } = pile.pop();
    const cle = `${declenche}|${e.chapitre}|${e.scene}|${e.terminee}|${e.anticipee}|${e.jauges.redressement}|${e.jauges.patience}|${e.jauges.stress}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (estTerminee(e)) {
      if (fin(e).id === FIN_DIFFEREE) atteinte[declenche ? 'avec' : 'sans'] = true;
      continue;
    }
    for (const x of etapesPossibles(sceneCourante(e))) {
      pile.push({ e: resoudre(e, x), declenche: declenche || x === CHOIX_DECLENCHEUR });
    }
  }
  assert.equal(atteinte.avec, true, 'fin jamais atteinte avec le choix declencheur');
  assert.equal(atteinte.sans, false, 'fin atteinte sans le choix declencheur');
});
