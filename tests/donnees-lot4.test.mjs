// Regles du lot 4 sur le contenu reel de data/ : validateur avec --exigences-lot4, puis les deux
// effets visibles par le joueur (EX-140 : chaque profil ouvre sur sa propre scene ; EX-141 : chaque
// scene du tronc est racontee differemment dans chacun des 6 profils initiaux).
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEPOT, DONNEES, chargerScenario, lireJson } from './aides.mjs';
import { valider, PROFILS_OBLIGATOIRES } from '../outils/valider.mjs';

const INITIAUX = Object.keys(PROFILS_OBLIGATOIRES);
const SCENARIOS = new Map(INITIAUX.map((id) => [id, chargerScenario(DONNEES, id).scenario]));
const TRONC = lireJson(DONNEES, 'tronc.json');
const scenesDe = (chapitres) => chapitres.flatMap((c) => c.scenes);

/** Paires de profils qui partagent la meme valeur (vide si toutes differentes). */
function doublons(valeurs) {
  const vus = new Map();
  const paires = [];
  for (const [id, v] of valeurs) {
    if (vus.has(v)) paires.push(`${vus.get(v)} = ${id}`);
    else vus.set(v, id);
  }
  return paires;
}

test('--exigences-lot4 : data/ valide (tous les profils, couverture comprise), code 0 en ligne de commande', () => {
  const r = valider({ racine: DONNEES, exigencesLot4: true });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
  for (const id of INITIAUX) assert.ok(r.profils.includes(id), `profil "${id}" verifie`);
  const c = spawnSync(process.execPath, [join(DEPOT, 'outils', 'valider.mjs'), '--exigences-lot4'], { cwd: DEPOT, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stdout, /^OK : donnees valides \(.*exigences du lot 4\)/);
});

test('EX-140 : les premieres scenes des 6 profils sont propres au profil et deux a deux differentes', () => {
  const premieres = INITIAUX.map((id) => {
    const ch = SCENARIOS.get(id).chapitres[0];
    assert.equal(ch.origine, 'profil', `${id} : le premier chapitre est un chapitre du profil`);
    return [id, ch.scenes[0]];
  });
  assert.deepEqual(doublons(premieres.map(([id, s]) => [id, s.id])), [], 'identifiants de premiere scene');
  assert.deepEqual(doublons(premieres.map(([id, s]) => [id, s.texte])), [], 'textes de premiere scene');
});

test('EX-141 : chaque scene du tronc a 6 textes differents (un par profil), aucun egal au texte du tronc', () => {
  const tronc = scenesDe(TRONC.chapitres);
  assert.ok(tronc.length > 0);
  for (const t of tronc) {
    const textes = INITIAUX.map((id) => {
      const s = scenesDe(SCENARIOS.get(id).chapitres).find((x) => x.id === t.id);
      assert.ok(s, `${id} : scene "${t.id}" absente du parcours`);
      assert.notEqual(s.texte, t.texte, `${id} : scene "${t.id}" non habillee (texte du tronc)`);
      return [id, s.texte];
    });
    assert.deepEqual(doublons(textes), [], `scene "${t.id}" : textes identiques entre profils`);
  }
});
