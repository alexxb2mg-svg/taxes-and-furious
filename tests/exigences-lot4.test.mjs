// EX-131 (recouvrement explication / resume) et regles du lot 4 (EX-140 a EX-143, option --exigences-lot4).
// Les temoins du lot 4 partent d'une copie des donnees de demonstration rendue conforme par construireConforme(),
// puis cassent une seule regle chacun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { valider, recouvrement, SEUIL_RECOUVREMENT, LIBELLE_LOI, LOT4 } from '../outils/valider.mjs';
import { DEPOT, DONNEES, copieTemporaire, lireJson } from './aides.mjs';

const VALIDEUR = join(DEPOT, 'outils', 'valider.mjs');
const cli = (...args) => spawnSync(process.execPath, [VALIDEUR, ...args], { cwd: DEPOT, encoding: 'utf8' });
const PROFIL = 'demo-glacier';

function modifier(racine, rel, fn) {
  const f = join(racine, ...rel.split('/'));
  const json = JSON.parse(readFileSync(f, 'utf8'));
  fn(json);
  writeFileSync(f, `${JSON.stringify(json, null, 2)}\n`);
}

const scenesDe = (chapitres) => chapitres.flatMap((c) => c.scenes);

/** Choix de test aux effets propres (k distingue les choix d'une scene). */
function choixTest(id, juste, k, suivant) {
  return {
    id,
    texte: `Choix de test ${id}.`,
    juste,
    effets: { redressement: juste ? 0 : 100 * k, patience: juste ? 5 : -k, stress: k },
    reaction: `Reaction de test ${id}.`,
    explication: 'Explication de test, sans chiffre.',
    references: ['R-279-MN'],
    suivant,
  };
}

function sceneTest(id, suivant) {
  return {
    id,
    personnage: 'sorbet',
    texte: `Scene de test ${id}.`,
    choix: [choixTest(`${id}-a`, true, 1, suivant), choixTest(`${id}-b`, false, 2, suivant), choixTest(`${id}-c`, false, 3, suivant)],
  };
}

function chapitreTest(id, n) {
  const ids = Array.from({ length: n }, (_, i) => `${id}-s${i + 1}`);
  return { id, titre: `Chapitre de test ${id}`, scenes: ids.map((s, i) => sceneTest(s, ids[i + 1] ?? null)) };
}

/**
 * Copie de tests/donnees ou le profil demo-glacier et le tronc respectent EX-140 a EX-143 :
 * ouverture d'1 scene, cornets (2 scenes) + suite (4 scenes), 3 fins propres, variantes completes,
 * 3 choix par scene ; parcours 1 + 9 (tronc) + 2 + 4 = 16 scenes.
 */
function construireConforme() {
  const copie = copieTemporaire();
  const { racine } = copie;
  modifier(racine, 'tronc.json', (t) => {
    for (const s of scenesDe(t.chapitres)) {
      if (!Array.isArray(s.choix)) continue;
      let k = 7;
      while (s.choix.length < 3) {
        const suivant = s.choix[s.choix.length - 1].suivant ?? null;
        s.choix.push({ ...choixTest(`${s.id}-test${k}`, false, k, suivant), references: s.choix[s.choix.length - 1].references, explication: 'Explication de test, sans chiffre.' });
        k += 1;
      }
    }
  });
  const tronc = lireJson(racine, 'tronc.json');
  modifier(racine, `profils/${PROFIL}/variantes.json`, (v) => {
    for (const s of scenesDe(tronc.chapitres)) {
      const vs = v[s.id] ?? (v[s.id] = {});
      vs.texte ??= `Variante de test ${s.id}.`;
      vs.choix ??= {};
      for (const c of s.choix ?? s.issues ?? []) {
        const vc = vs.choix[c.id] ?? (vs.choix[c.id] = {});
        vc.reaction ??= `Reaction de test ${c.id}.`;
      }
    }
  });
  modifier(racine, `profils/${PROFIL}/profil.json`, (p) => {
    for (const s of scenesDe(p.chapitres)) {
      const suivant = s.choix[0].suivant ?? null;
      while (s.choix.length < 3) s.choix.push(choixTest(`${s.id}-c${s.choix.length}`, false, 10 + s.choix.length, suivant));
    }
    p.chapitres.unshift(chapitreTest('ouverture', 1));
    p.chapitres.push(chapitreTest('suite', 4));
    p.parcours = ['profil:ouverture', 'tronc:avis', 'tronc:fec', 'profil:cornets', 'profil:suite', 'tronc:rectification'];
    p.fins.unshift({ id: 'glacier-fin-test', titre: 'Fin de test', texte: 'Fin de test.', conditions: [{ jauge: 'stress', op: '>', valeur: 90 }] });
  });
  return copie;
}

const optionsLot4 = (racine) => ({ racine, profil: PROFIL, couverture: false, exigencesLot4: true });

// ------------------------------------------------------------ EX-131

test('EX-131 : recouvrement = part des mots de 4 lettres et plus de l\'explication presents dans le resume', () => {
  assert.equal(recouvrement('Le taux normal est de 20 %.', 'Le taux normal de TVA est de 20 %.'), 1);
  assert.equal(recouvrement('Le TAUX normal', 'le taux réduit'), 0.5, 'casse ignoree, mots de moins de 4 lettres ignores');
  assert.equal(recouvrement('Inaltérabilité exigée', 'inalterabilite des donnees'), 0.5, 'accents ignores');
  assert.equal(recouvrement('Un cornet sur le trottoir', 'Ventes a emporter'), 0);
  assert.equal(recouvrement('a b c', 'a b c'), 0, 'aucun mot significatif');
  assert.equal(SEUIL_RECOUVREMENT, 0.6);
  assert.equal(LIBELLE_LOI, 'Ce que dit vraiment la loi');
});

test('EX-131 : explication qui recopie le resume d\'une reference citee = avertissement (code 0)', () => {
  const copie = copieTemporaire();
  try {
    const refs = new Map(lireJson(copie.racine, 'references.json').references.map((r) => [r.id, r]));
    modifier(copie.racine, `profils/${PROFIL}/profil.json`, (p) => {
      p.chapitres[0].scenes[0].choix[0].explication = refs.get('R-279-MN').resume;
    });
    const r = valider({ racine: copie.racine, couverture: false });
    assert.deepEqual(r.erreurs, []);
    assert.equal(r.avertissements.length, 1, r.avertissements.join('\n'));
    assert.match(r.avertissements[0], /^profils\/demo-glacier\/profil\.json : scene "cornets-s1", choix "cornets-s1-a", champ "explication" : 100 % de ses mots figurent dans le resume de R-279-MN \(seuil 60 %\)/);
    const c = cli('--racine', copie.racine, '--sans-couverture');
    assert.equal(c.status, 0, c.stderr);
    assert.match(c.stdout, /avertissement : profils\/demo-glacier\/profil\.json .* 100 % de ses mots/);
  } finally {
    copie.nettoyer();
  }
});

test('EX-131 : data/ sans libelle dans les explications et sans avertissement de recouvrement', () => {
  const r = valider();
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements.filter((a) => a.includes('de ses mots figurent')), []);
  for (const f of ['tronc.json', ...lireJson(DONNEES, 'profils/index.json').map((id) => `profils/${id}/profil.json`), 'profils/_modele/profil.json']) {
    assert.ok(!readFileSync(join(DONNEES, ...f.split('/')), 'utf8').includes(LIBELLE_LOI), `${f} : libelle present`);
  }
});

// ------------------------------------------------------------ EX-142 (tronc de data/)

test('EX-142 : chaque scene a choix du tronc de data/ a 3 ou 4 choix, un juste, un mauvais reflexe, des effets distincts', () => {
  const tronc = lireJson(DONNEES, 'tronc.json');
  for (const s of scenesDe(tronc.chapitres).filter((x) => Array.isArray(x.choix))) {
    assert.ok(s.choix.length >= LOT4.choixParScene[0] && s.choix.length <= LOT4.choixParScene[1], `${s.id} : ${s.choix.length} choix`);
    assert.ok(s.choix.some((c) => c.juste === true), `${s.id} : un juste`);
    assert.ok(s.choix.some((c) => c.juste === false), `${s.id} : un mauvais reflexe`);
    const effets = s.choix.map((c) => JSON.stringify(c.effets));
    assert.equal(new Set(effets).size, effets.length, `${s.id} : effets distincts`);
  }
  const r = valider({ exigencesLot4: true });
  assert.deepEqual(r.erreurs.filter((e) => e.startsWith('tronc.json')), [], 'aucune erreur lot 4 sur le tronc de data/');
});

// ------------------------------------------------------------ --exigences-lot4

test('--exigences-lot4 : copie conforme valide ; donnees de demonstration brutes refusees ; option inactive par defaut', () => {
  const copie = construireConforme();
  try {
    assert.deepEqual(valider(optionsLot4(copie.racine)).erreurs, []);
    assert.deepEqual(valider({ racine: copie.racine, couverture: false }).erreurs, [], 'sans l\'option, la copie reste valide');
    const c = cli('--racine', copie.racine, '--profil', PROFIL, '--sans-couverture', '--exigences-lot4');
    assert.equal(c.status, 0, c.stderr);
    assert.match(c.stdout, /^OK : donnees valides \(.*, exigences du lot 4\)/);
  } finally {
    copie.nettoyer();
  }
  const brut = cli('--racine', 'tests/donnees', '--profil', PROFIL, '--sans-couverture', '--exigences-lot4');
  assert.equal(brut.status, 1);
  assert.match(brut.stderr, /EX-140/);
  assert.equal(cli('--racine', 'tests/donnees', '--sans-couverture').status, 0, 'sans l\'option, les donnees de demonstration passent');
});

const P = `profils/${PROFIL}/profil.json`;
const V = `profils/${PROFIL}/variantes.json`;
const chapitre = (p, id) => p.chapitres.find((c) => c.id === id);

const TEMOINS_LOT4 = [
  {
    nom: 'EX-140 : le parcours ne commence pas par le chapitre d\'ouverture',
    fichier: P,
    modif: (p) => { p.parcours = ['tronc:avis', 'profil:ouverture', 'tronc:fec', 'profil:cornets', 'profil:suite', 'tronc:rectification']; },
    attendu: 'profils/demo-glacier/profil.json : champ "parcours" : premiere entree "tronc:avis" : le parcours commence par le chapitre d\'ouverture du profil',
  },
  {
    nom: 'EX-140 : chapitre d\'ouverture de 3 scenes',
    fichier: P,
    modif: (p) => { p.chapitres[0] = chapitreTest('ouverture', 3); },
    attendu: 'chapitre "ouverture", champ "scenes" : 3 scene(s) dans le chapitre d\'ouverture : il en faut de 1 a 2 (EX-140)',
  },
  {
    nom: 'EX-141 : scene du tronc sans variante',
    fichier: V,
    modif: (v) => { delete v['avis-s2']; },
    attendu: 'profils/demo-glacier/variantes.json : scene "avis-s2", champ "texte" : variante absente',
  },
  {
    nom: 'EX-141 : choix du tronc sans reaction propre au profil',
    fichier: V,
    modif: (v) => { delete v['fec-s1'].choix['fec-s1-a']; },
    attendu: 'profils/demo-glacier/variantes.json : scene "fec-s1", choix "fec-s1-a", champ "reaction" : reaction absente',
  },
  {
    nom: 'EX-142 : scene du profil a 2 choix',
    fichier: P,
    modif: (p) => { chapitre(p, 'suite').scenes[1].choix.pop(); },
    attendu: 'scene "suite-s2", champ "choix" : 2 choix : il en faut 3 ou 4 (EX-142)',
  },
  {
    nom: 'EX-142 : scene du profil sans mauvais reflexe',
    fichier: P,
    modif: (p) => { for (const c of chapitre(p, 'suite').scenes[0].choix) c.juste = true; },
    attendu: 'scene "suite-s1", champ "choix" : aucun mauvais reflexe',
  },
  {
    nom: 'EX-142 : deux choix aux effets identiques',
    fichier: P,
    modif: (p) => { const [, b, c] = chapitre(p, 'ouverture').scenes[0].choix; c.effets = { ...b.effets }; },
    attendu: 'scene "ouverture-s1", choix "ouverture-s1-c", champ "effets" : effets identiques a ceux du choix "ouverture-s1-b"',
  },
  {
    nom: 'EX-142 : scene du tronc a 2 choix',
    fichier: 'tronc.json',
    modif: (t) => { t.chapitres[0].scenes[0].choix.pop(); },
    attendu: 'tronc.json : scene "avis-s1", champ "choix" : 2 choix : il en faut 3 ou 4 (EX-142)',
  },
  {
    nom: 'EX-143 : un seul chapitre propre hors ouverture',
    fichier: P,
    modif: (p) => {
      p.chapitres = p.chapitres.filter((c) => c.id !== 'suite');
      p.parcours = p.parcours.filter((e) => e !== 'profil:suite');
    },
    attendu: 'profils/demo-glacier/profil.json : champ "chapitres" : 1 chapitre(s) propre(s) hors ouverture : il en faut au moins 2 (EX-143)',
  },
  {
    nom: 'EX-143 : 2 fins propres seulement',
    fichier: P,
    modif: (p) => { p.fins.shift(); },
    attendu: 'profils/demo-glacier/profil.json : champ "fins" : 2 fin(s) propre(s) : il en faut au moins 3 (EX-143)',
  },
  {
    nom: 'EX-143 : parcours de 15 scenes',
    fichier: P,
    modif: (p) => {
      const suite = chapitre(p, 'suite');
      suite.scenes.pop();
      for (const c of suite.scenes[suite.scenes.length - 1].choix) c.suivant = null;
    },
    attendu: 'profils/demo-glacier/profil.json : champ "parcours" : 15 scene(s) sur l\'ensemble du parcours : il en faut de 16 a 24 (EX-143)',
  },
];

for (const t of TEMOINS_LOT4) {
  test(`--exigences-lot4, temoin negatif : ${t.nom}`, () => {
    const copie = construireConforme();
    try {
      modifier(copie.racine, t.fichier, t.modif);
      const { erreurs } = valider(optionsLot4(copie.racine));
      assert.ok(erreurs.some((e) => e.includes(t.attendu)), `message attendu : ${t.attendu}\nobtenus :\n${erreurs.join('\n')}`);
      const c = cli('--racine', copie.racine, '--profil', PROFIL, '--sans-couverture', '--exigences-lot4');
      assert.equal(c.status, 1, 'code 1 en ligne de commande');
    } finally {
      copie.nettoyer();
    }
  });
}
