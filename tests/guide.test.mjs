// EX-053 : le guide docs/CREER_UN_PROFIL.md est exécutable tel quel. Le test rejoue ses étapes
// dans une copie temporaire de data/ avec les blocs JSON du guide (profil, variantes, index) :
// validateur vert (profil seul puis complet), toutes les fins atteignables, messages d'erreur
// cités par le guide identiques à ceux du validateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEPOT, DONNEES, copieTemporaire } from './aides.mjs';
import { valider } from '../outils/valider.mjs';
import { suitesParFin } from './partie.mjs';

const GUIDE = readFileSync(join(DEPOT, 'docs', 'CREER_UN_PROFIL.md'), 'utf8').replace(/\r\n/g, '\n');
const blocs = (langue) => [...GUIDE.matchAll(new RegExp('```' + langue + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);
const json = blocs('json').map((b) => JSON.parse(b));
const PROFIL = json.find((j) => j.id === 'boulanger');
const VARIANTES = json.find((j) => j['avis-s1']);
const INDEX = json.find((j) => Array.isArray(j));
// Index de data/ sans l'exemple : le test reste vert une fois le guide suivi pour de vrai dans data/.
const INDEX_BASE = JSON.parse(readFileSync(join(DONNEES, 'profils', 'index.json'), 'utf8')).filter((id) => id !== 'boulanger');

/** Étapes 1 à 3 (et 5 si `index`) du guide dans une copie de data/. */
function suivreLeGuide({ index = true } = {}) {
  const c = copieTemporaire(DONNEES);
  const dossier = join(c.racine, 'profils', 'boulanger');
  // Point de départ du guide : data/ sans boulanger (copie temporaire seulement).
  if (dossier.startsWith(c.racine) && existsSync(dossier)) rmSync(dossier, { recursive: true });
  writeFileSync(join(c.racine, 'profils', 'index.json'), `${JSON.stringify(INDEX_BASE, null, 2)}\n`);
  cpSync(join(c.racine, 'profils', '_modele'), dossier, { recursive: true }); // 1. copier
  renameSync(join(dossier, 'img', 'verificateur.svg'), join(dossier, 'img', 'levain.svg')); // 2. renommer
  const svg = join(dossier, 'img', 'levain.svg');
  writeFileSync(svg, readFileSync(svg, 'utf8').replaceAll('A remplacer : nom du vérificateur', 'M. Gaston Levain'));
  writeFileSync(join(dossier, 'profil.json'), `${JSON.stringify(PROFIL, null, 2)}\n`); // 3. remplir
  writeFileSync(join(dossier, 'variantes.json'), `${JSON.stringify(VARIANTES, null, 2)}\n`);
  if (index) writeFileSync(join(c.racine, 'profils', 'index.json'), `${JSON.stringify(INDEX, null, 2)}\n`); // 5.
  return c;
}

test('EX-053 : le guide contient l\'exemple complet (profil, variantes, index) et les commandes', () => {
  assert.ok(PROFIL, 'bloc JSON du profil boulanger');
  assert.ok(VARIANTES, 'bloc JSON de variantes.json');
  assert.deepEqual(INDEX, [...INDEX_BASE, 'boulanger']);
  const bash = blocs('bash').join('\n');
  for (const cmd of ['cp -r data/profils/_modele data/profils/boulanger', 'node outils/valider.mjs --profil boulanger', 'node outils/valider.mjs', 'python lancer.py', 'node --test tests/']) {
    assert.ok(bash.includes(cmd), `commande absente du guide : ${cmd}`);
  }
  assert.match(GUIDE, /notion est nouvelle[\s\S]{0,400}texte officiel[\s\S]{0,200}data\/references\.json` dans la même pull request/,
    'mention : notion juridique nouvelle = article lu dans le texte officiel, ajoute dans la meme pull request (EX-002, EX-103)');
  assert.match(GUIDE, /contributeurs/, 'le guide parle de contributeurs (EX-100)');
  assert.ok(bash.includes('node outils/captures.mjs --donnees data --profil boulanger'), 'commande de captures pour la pull request');
  assert.match(GUIDE, /--profil[\s\S]{0,400}saute[\s\S]{0,40}couverture du tronc/, '--profil saute la couverture du tronc');
});

test('EX-053 : etapes 1 a 4 du guide : profil seul valide avant l\'index, avertissement de dossier hors index', () => {
  const c = suivreLeGuide({ index: false });
  try {
    const seul = valider({ racine: c.racine, profil: 'boulanger' });
    assert.deepEqual(seul.erreurs, []);
    assert.deepEqual(seul.avertissements, []);
    const tout = valider({ racine: c.racine });
    assert.deepEqual(tout.erreurs, []);
    assert.deepEqual(tout.avertissements, ['profils/boulanger/ : dossier absent de profils/index.json : profil ignore par le jeu']);
  } finally {
    c.nettoyer();
  }
});

test('EX-053 : etape 5 du guide : validation complete verte, chaque fin du profil atteignable', () => {
  const c = suivreLeGuide();
  try {
    const r = valider({ racine: c.racine });
    assert.deepEqual(r.erreurs, []);
    assert.deepEqual(r.avertissements, []);
    assert.deepEqual(r.profils, INDEX);
    const fins = Object.keys(suitesParFin(c.racine, 'boulanger')).sort();
    assert.deepEqual(fins, [...PROFIL.fins.map((f) => f.id), 'fin-sereine', 'fin-defaut', 'fin-patience'].sort());
  } finally {
    c.nettoyer();
  }
});

test('EX-053 : les messages d\'erreur cites par le guide sont ceux du validateur', () => {
  const lignes = GUIDE.split('\n').filter((l) => l.startsWith('profils/boulanger/profil.json : '));
  assert.equal(lignes.length, 3);
  const mutations = [
    (p) => { p.chapitres[0].scenes[0].choix.forEach((ch) => { ch.suivant = 'fournil-s9'; }); },
    (p) => { p.chapitres[0].scenes[1].choix[0].references = ['R-278-0B-A1', 'R-999']; },
    (p) => { p.personnages[0].nom = 'M. Gaston Levain-Brioche'; },
  ];
  for (const [i, muter] of mutations.entries()) {
    const c = suivreLeGuide({ index: false });
    try {
      const p = structuredClone(PROFIL);
      muter(p);
      writeFileSync(join(c.racine, 'profils', 'boulanger', 'profil.json'), JSON.stringify(p, null, 2));
      const r = valider({ racine: c.racine, profil: 'boulanger' });
      assert.ok(r.erreurs.includes(lignes[i]), `message du guide absent de la sortie : ${lignes[i]}\nsortie : ${r.erreurs.join('\n')}`);
    } finally {
      c.nettoyer();
    }
  }
});
