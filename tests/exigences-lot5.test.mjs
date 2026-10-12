// EX-157 : option --exigences-lot5 du validateur (un `joueur` propre a chaque profil de l'index, et le
// controleur emblematique de communs/personnages.json, chacun avec portrait .webp et illustration en pied).
// Les donnees de demonstration sont rendues conformes par une copie : les profil.json de data/ ne sont pas touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { valider } from '../outils/valider.mjs';
import { embleme } from '../js/moteur.js';
import { DEPOT, DONNEES_DEMO, copieTemporaire, appliquerModifs, lireJson, chargerScenario } from './aides.mjs';

const VALIDEUR = join(DEPOT, 'outils', 'valider.mjs');
const cli = (...args) => spawnSync(process.execPath, [VALIDEUR, ...args], { cwd: DEPOT, encoding: 'utf8' });

/** Un personnage `joueur` illustre pour le profil `id` (images d'essai de tests/donnees/art). */
function joueurIllustre(id, rang) {
  const dossier = `profils/${id}`;
  return [
    { fichier: `${dossier}/img/gerant.webp`, copier: 'tests/donnees/profils/demo-fleuriste/img/pistil.webp' },
    { fichier: `${dossier}/img/gerant-situation.webp`, copier: 'tests/donnees/art/situation-essai-2.webp' },
    {
      fichier: `${dossier}/profil.json`,
      chemin: ['personnages', rang],
      valeur: { id: 'gerant', role: 'joueur', nom: `Gérant ${id}`, description: 'Gérant de démonstration.', portrait: 'img/gerant.webp', illustration: 'img/gerant-situation.webp' },
    },
  ];
}

/** Copie conforme au lot 5 : un joueur illustre par profil de l'index ; l'embleme d'essai est deja complet. */
function copieConforme(modifs = []) {
  const c = copieTemporaire(DONNEES_DEMO);
  const rangs = Object.fromEntries(lireJson(DONNEES_DEMO, 'profils/index.json').map((id) => [id, lireJson(DONNEES_DEMO, `profils/${id}/profil.json`).personnages.length]));
  appliquerModifs(c.racine, Object.entries(rangs).flatMap(([id, rang]) => joueurIllustre(id, rang)));
  appliquerModifs(c.racine, modifs);
  return c;
}

const lot5 = (racine) => valider({ racine, couverture: false, exigencesLot5: true }).erreurs;

test('--exigences-lot5 : copie conforme valide (API et CLI) ; donnees de demonstration brutes refusees ; option inactive par defaut', () => {
  const c = copieConforme();
  try {
    assert.deepEqual(lot5(c.racine), []);
    const r = cli('--racine', c.racine, '--sans-couverture', '--exigences-lot5');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^OK : donnees valides \(.*, exigences du lot 5\)/);
    const deux = cli('--racine', c.racine, '--sans-couverture', '--exigences-lot4', '--exigences-lot5');
    assert.match(deux.stderr + deux.stdout, /exigences du lot 4, exigences du lot 5/, 'options combinables');
  } finally {
    c.nettoyer();
  }
  const brut = cli('--racine', 'tests/donnees', '--sans-couverture', '--exigences-lot5');
  assert.equal(brut.status, 1);
  assert.deepEqual(brut.stderr.trim().split('\n').slice(0, -1), [
    'profils/demo-fleuriste/profil.json : champ "personnages" : 0 personnage(s) de role "joueur" : il en faut exactement 1, propre au profil (EX-157)',
    'profils/demo-glacier/profil.json : champ "personnages" : 0 personnage(s) de role "joueur" : il en faut exactement 1, propre au profil (EX-157)',
  ]);
  assert.equal(cli('--racine', 'tests/donnees', '--sans-couverture').status, 0, 'sans l\'option, les donnees de demonstration passent');
  assert.equal(cli('--help').stdout.includes('[--exigences-lot5]'), true, 'option documentee dans l\'usage');
});

const temoins = [
  {
    nom: 'embleme absent',
    modifs: [{ fichier: 'communs/personnages.json', chemin: ['personnages', 2], supprimer: true }],
    attendu: 'communs/personnages.json : champ "personnages" : controleur emblematique (role "embleme") absent (EX-157)',
  },
  {
    nom: 'embleme sans illustration',
    modifs: [{ fichier: 'communs/personnages.json', chemin: ['personnages', 2, 'illustration'], supprimer: true }],
    attendu: 'communs/personnages.json : personnage "embleme", champ "illustration" : illustration en pied <perso>-situation.webp obligatoire (EX-157)',
  },
  {
    nom: 'embleme au portrait SVG',
    modifs: [{ fichier: 'communs/personnages.json', chemin: ['personnages', 2, 'portrait'], valeur: 'img/joueur.svg' }],
    attendu: 'communs/personnages.json : personnage "embleme", champ "portrait" : portrait illustre .webp obligatoire (EX-157)',
  },
  {
    nom: 'joueur sans illustration',
    modifs: [{ fichier: 'profils/demo-glacier/profil.json', chemin: ['personnages', 1, 'illustration'], supprimer: true }],
    attendu: 'profils/demo-glacier/profil.json : personnage "gerant", champ "illustration" : illustration en pied <perso>-situation.webp obligatoire (EX-157)',
  },
  {
    nom: 'joueur au portrait SVG',
    modifs: [{ fichier: 'profils/demo-fleuriste/profil.json', chemin: ['personnages', 2, 'portrait'], valeur: 'img/bilan.svg' }],
    attendu: 'profils/demo-fleuriste/profil.json : personnage "gerant", champ "portrait" : portrait illustre .webp obligatoire (EX-157)',
  },
  {
    nom: 'deux joueurs dans un profil',
    modifs: [{ fichier: 'profils/demo-fleuriste/profil.json', chemin: ['personnages', 1, 'role'], valeur: 'joueur' }],
    attendu: 'profils/demo-fleuriste/profil.json : champ "personnages" : 2 personnage(s) de role "joueur" : il en faut exactement 1, propre au profil (EX-157)',
  },
];

for (const t of temoins) {
  test(`--exigences-lot5, temoin negatif : ${t.nom}`, () => {
    const c = copieConforme(t.modifs);
    try {
      const erreurs = lot5(c.racine);
      assert.ok(erreurs.includes(t.attendu), `attendu : ${t.attendu}\nobtenus :\n${erreurs.join('\n')}`);
    } finally {
      c.nettoyer();
    }
  });
}

test('EX-157 : le moteur expose l\'embleme (chemins relatifs a la racine) sans en faire un role de scene', () => {
  const communs = lireJson(DONNEES_DEMO, 'communs/personnages.json');
  const e = embleme(communs);
  assert.deepEqual({ ...e }, {
    id: 'embleme', role: 'embleme', nom: 'Inspecteur Démo Furieux',
    description: 'Contrôleur de démonstration, lunettes noires et calculatrice à la ceinture.',
    portrait: 'communs/img/embleme.webp', repli: 'communs/img/embleme.svg', illustration: 'communs/img/embleme-situation.webp',
  });
  assert.ok(Object.isFrozen(e));
  assert.equal(embleme({ personnages: communs.personnages.filter((p) => p.role !== 'embleme') }), null);
  assert.equal(embleme(undefined), null);
  for (const id of lireJson(DONNEES_DEMO, 'profils/index.json')) {
    const { scenario } = chargerScenario(DONNEES_DEMO, id);
    assert.equal(Object.values(scenario.personnages.roles).some((p) => p.role === 'embleme'), false, `${id} : l'embleme ne joue dans aucune scene`);
  }
});

test('EX-156 : le moteur transmet l\'illustration du personnage (null si absente)', () => {
  const c = copieConforme([{ fichier: 'profils/demo-fleuriste/profil.json', chemin: ['personnages', 0, 'illustration'], valeur: 'img/pistil-situation.webp' }]);
  try {
    const { scenario } = chargerScenario(c.racine, 'demo-fleuriste');
    assert.equal(scenario.personnages.roles.verificateur.illustration, 'profils/demo-fleuriste/img/pistil-situation.webp');
    assert.equal(scenario.personnages.roles.joueur.illustration, 'profils/demo-fleuriste/img/gerant-situation.webp');
    assert.equal(scenario.personnages.roles.comptable.illustration, null);
    assert.equal(scenario.personnages.roles.narrateur.illustration, null);
    const glacier = chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario;
    assert.equal(glacier.personnages.roles.joueur.illustration, null, 'joueur generique sans illustration');
  } finally {
    c.nettoyer();
  }
});
