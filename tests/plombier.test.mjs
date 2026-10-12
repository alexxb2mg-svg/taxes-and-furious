// Profil plombier (lot 4) : ouverture propre, regles EX-140 a EX-143, et consequence differee
// de la fin "Fuite, Fils & Kevin" (atteignable seulement si Kevin est embauche au chapitre "chantier").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONNEES, chargerScenario } from './aides.mjs';
import { nouvellePartie, resoudre, sceneCourante, estTerminee, fin } from '../js/moteur.js';
import { etapesPossibles } from './partie.mjs';
import { valider } from '../outils/valider.mjs';

const { profil, scenario } = chargerScenario(DONNEES, 'plombier');
const CHOIX_KEVIN = 'chantier-s2-a';
const FIN_KEVIN = 'plombier-fin-kevin';

test('plombier : validateur vert avec les exigences du lot 4', () => {
  const r = valider({ profil: 'plombier', exigencesLot4: true });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
});

test('plombier : ouverture propre au profil, 17 scenes, 3 fins propres', () => {
  assert.equal(profil.parcours[0], 'profil:ouverture');
  assert.equal(scenario.chapitres.flatMap((c) => c.scenes).length, 17);
  assert.deepEqual(profil.fins.map((f) => f.id), ['plombier-fin-etanche', FIN_KEVIN, 'plombier-fin-degat-des-eaux']);
  assert.ok(profil.chapitres.find((c) => c.id === 'chantier').scenes.some((s) => s.choix?.some((c) => c.id === CHOIX_KEVIN)));
});

test('plombier : la fin "Kevin" n\'est atteignable qu\'apres son embauche (consequence differee, EX-143)', () => {
  // Exploration complete, etats identiques fusionnes ; `kevin` = le choix chantier-s2-a a ete fait.
  const vus = new Set();
  const atteinte = { avec: 0, sans: 0 };
  const pile = [{ e: nouvellePartie(scenario), kevin: false }];
  while (pile.length) {
    const { e, kevin } = pile.pop();
    const cle = [e.chapitre, e.scene, e.jauges.redressement, e.jauges.patience, e.jauges.stress, e.terminee, e.anticipee, kevin].join('|');
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (estTerminee(e)) {
      if (fin(e).id === FIN_KEVIN) atteinte[kevin ? 'avec' : 'sans'] += 1;
      continue;
    }
    for (const x of etapesPossibles(sceneCourante(e))) pile.push({ e: resoudre(e, x), kevin: kevin || x === CHOIX_KEVIN });
  }
  assert.ok(atteinte.avec > 0, 'fin atteinte avec l\'embauche de Kevin');
  assert.equal(atteinte.sans, 0, 'fin jamais atteinte sans l\'embauche de Kevin');
});
