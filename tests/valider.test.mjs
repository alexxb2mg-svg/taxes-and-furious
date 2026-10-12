import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { valider, verifierChiffres, extraireChiffres } from '../outils/valider.mjs';
import { DEPOT, DONNEES, DONNEES_DEMO, TEMOINS, lireJson, copieTemporaire, appliquerModifs } from './aides.mjs';

const VALIDEUR = join(DEPOT, 'outils', 'valider.mjs');
const cli = (...args) => spawnSync(process.execPath, [VALIDEUR, ...args], { cwd: DEPOT, encoding: 'utf8' });

// ------------------------------------------------------------ donnees valides

test('donnees de demonstration valides (avec et sans couverture)', () => {
  for (const couverture of [false, true]) {
    const r = valider({ racine: DONNEES_DEMO, couverture });
    assert.deepEqual(r.erreurs, []);
    assert.deepEqual(r.avertissements, []);
    assert.deepEqual(r.profils, ['demo-fleuriste', 'demo-glacier']);
  }
});

test('EX-053 : le modele _modele est un profil valide (1 chapitre, 2 scenes, 2 fins, textes "A remplacer")', () => {
  const r = valider({ profil: '_modele' });
  assert.deepEqual(r.erreurs, []);
  const modele = lireJson(DONNEES, 'profils/_modele/profil.json');
  assert.equal(modele.chapitres.length, 1);
  assert.equal(modele.chapitres[0].scenes.length, 2);
  assert.equal(modele.fins.length, 2);
  assert.match(modele.nom, /^A remplacer/);
  assert.deepEqual(lireJson(DONNEES, 'profils/index.json').includes('_modele'), false, '_modele absent de l\'index');
});

test('data/ valide en entier (sans argument)', () => {
  const r = valider();
  assert.deepEqual(r.erreurs, []);
});

test('ligne de commande : code 0 sur des donnees valides', () => {
  for (const args of [['--profil', '_modele'], ['--racine', 'tests/donnees', '--sans-couverture'], []]) {
    const r = cli(...args);
    assert.equal(r.status, 0, `${args.join(' ')} : ${r.stderr}`);
    assert.match(r.stdout, /^OK : donnees valides/);
  }
});

test('ligne de commande : code 1 et un message par erreur, option inconnue refusee', () => {
  const copie = copieTemporaire();
  try {
    appliquerModifs(copie.racine, [
      { fichier: 'profils/demo-fleuriste/profil.json', chemin: ['chapitres', 0, 'scenes', 0, 'choix', 1, 'suivant'], valeur: 'caisse-s9' },
      { fichier: 'profils/demo-glacier/profil.json', chemin: ['actif'], valeur: 'oui' },
    ]);
    const r = cli('--racine', copie.racine, '--sans-couverture');
    assert.equal(r.status, 1);
    const lignes = r.stderr.trim().split(/\r?\n/);
    assert.equal(lignes.length, 3, r.stderr);
    assert.match(lignes[0], /^profils\/demo-fleuriste\/profil\.json : scene "caisse-s1", champ "suivant" : scene "caisse-s9" introuvable/);
    assert.match(lignes[1], /^profils\/demo-glacier\/profil\.json : champ "actif" : booleen obligatoire/);
    assert.match(lignes[2], /^ECHEC : 2 erreur\(s\)/);
  } finally {
    copie.nettoyer();
  }
  const r = cli('--inconnue');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /option "--inconnue" inconnue/);
});

test('--profil valide un profil hors index ; --racine sur un dossier inexistant echoue', () => {
  const copie = copieTemporaire();
  try {
    appliquerModifs(copie.racine, [{ fichier: 'profils/index.json', valeur_fichier: ['demo-fleuriste'] }]);
    assert.deepEqual(valider({ racine: copie.racine, profil: 'demo-glacier' }).erreurs, []);
  } finally {
    copie.nettoyer();
  }
  assert.match(valider({ racine: join(DEPOT, 'tests', 'pas-de-dossier') }).erreurs[0], /dossier de donnees introuvable/);
});

test('index.json : dossier hors index = avertissement (code 0), _modele exempte', () => {
  const copie = copieTemporaire();
  try {
    cpSync(join(copie.racine, 'profils', 'demo-glacier'), join(copie.racine, 'profils', 'demo-orphelin'), { recursive: true });
    mkdirSync(join(copie.racine, 'profils', '_modele'));
    const r = valider({ racine: copie.racine, couverture: false });
    assert.deepEqual(r.erreurs, []);
    assert.deepEqual(r.avertissements, ['profils/demo-orphelin/ : dossier absent de profils/index.json : profil ignore par le jeu']);
    const c = cli('--racine', copie.racine, '--sans-couverture');
    assert.equal(c.status, 0);
    assert.match(c.stdout, /avertissement : profils\/demo-orphelin\//);
  } finally {
    copie.nettoyer();
  }
});

// ------------------------------------------------------------ temoins negatifs

const temoins = readdirSync(TEMOINS).filter((f) => f.endsWith('.json')).sort();

test('tests/donnees-invalides : au moins un temoin par regle', () => {
  assert.ok(temoins.length >= 30, `${temoins.length} temoins`);
});

for (const f of temoins) {
  const t = JSON.parse(readFileSync(join(TEMOINS, f), 'utf8'));
  test(`temoin negatif ${f.replace(/\.json$/, '')} (${t.regle})`, () => {
    const copie = copieTemporaire();
    try {
      // La copie intacte est valide : l'echec vient bien de la modification du temoin.
      assert.deepEqual(valider({ racine: copie.racine, couverture: t.couverture }).erreurs, []);
      appliquerModifs(copie.racine, t.modifs);
      const { erreurs } = valider({ racine: copie.racine, couverture: t.couverture });
      assert.ok(erreurs.length > 0, 'le validateur doit echouer');
      for (const attendu of t.attendu) {
        assert.ok(erreurs.some((e) => e.includes(attendu)), `message attendu : ${attendu}\nobtenus :\n${erreurs.join('\n')}`);
      }
    } finally {
      copie.nettoyer();
    }
  });
}

// ------------------------------------------------------------ EX-003

const refs = new Map(lireJson(DONNEES, 'references.json').references.map((r) => [r.id, r]));
const ok = (texte, ids) => assert.deepEqual(verifierChiffres(texte, ids, refs), [], `${texte} / ${ids}`);
const ko = (texte, ids) => assert.notDeepEqual(verifierChiffres(texte, ids, refs), [], `${texte} / ${ids}`);

test('EX-003 : temoins de la spec', () => {
  ko('TVA a 7 %', ['R-279-0B']);
  ok('0,20 % par mois', ['R-1727']);
  ko('0,2 %', ['R-1727']);
  ko('amende de 50 000 €', ['R-1729D']);
  ko('amende de 50 000 euros', ['R-1729D']);
  ok('amende de 5 000 euros', ['R-1729D']);
  ko('10 pour cent', ['R-278']);
  ko('trois mois', ['R-L52']);
});

test('EX-003 : nombres a point (decimal ou milliers) refuses, message en francais', () => {
  for (const [texte, ids] of [['TVA a 19.6 %', ['R-286']], ['amende de 1.500 €', ['R-286']], ['TVA a 7.5 %', ['R-279-0B']],
    ['amende de 50.000 €', ['R-1729D']], ['amende de 5.000 euros', ['R-1729D']], ['0.20 % par mois', ['R-1727']],
    ['amende de 1 500.50 €', ['R-1729D']], ['amende de 1.500,50 €', ['R-1729D']], ['TVA a 20.0 pour cent', ['R-278']]]) {
    ko(texte, ids);
  }
  assert.deepEqual(verifierChiffres('TVA a 19.6 %, amende de 1.500 €.', ['R-286'], refs), [
    'nombre "19.6 %" : ecrire la virgule decimale et l\'espace de milliers (19,6 %, 1 500 €)',
    'nombre "1.500 €" : ecrire la virgule decimale et l\'espace de milliers (19,6 %, 1 500 €)',
  ]);
  ok('article 1729, edition 2026', ['R-1729']);
  ok('Voir article 1729. Une majoration de 40 %', ['R-1729']);
  ok('amende de 5 000 euros.', ['R-1729D']);
});

test('EX-003 : normalisation (unites, espaces, casse)', () => {
  for (const s of ['10%', '10 pour cent', '10 %', '10\u00a0%', '10 POUR CENT']) ok(`TVA a ${s}`, ['R-279-0B']);
  for (const s of ['7500 €', '7 500 euros', '7 500 EUR', '7 500 €', '7\u00a0500 €', '7\u202f500 Euros']) ok(`amende de ${s}`, ['R-1770DUO']);
  assert.deepEqual(extraireChiffres('7500 €, 7 500 euros, 7 500 EUR').map((c) => c.cle), ['7500 €', '7500 €', '7500 €']);
  assert.deepEqual(extraireChiffres('10%, 10 pour cent, 10 %').map((c) => c.cle), ['10 %', '10 %', '10 %']);
  ok('dans les 60 jours', ['R-1770DUO']);
  ok('3 ans, ou 10 ans', ['R-L169']);
  ko('3 ans', ['R-1729']);
  ko('5 000 €', []);
  ko('5 000 €', ['R-1770DUO']);
});

test('EX-003 : chiffres de reference ailleurs que dans les unites ignores, nombres en lettres refuses', () => {
  ok('article 1729, edition 2026, troisieme annee, trois representants', ['R-1729']);
  ok('Une majoration de 40 %', ['R-1729', 'R-L62']);
  for (const s of ['un an', 'deux ans', 'dix jours', 'douze mois', 'quinze jours', 'vingt pour cent', 'trente jours', 'quarante %',
    'cinquante euros', 'soixante jours', 'cent euros', 'mille €', 'Trois Mois']) {
    ko(`delai de ${s}`, ['R-L52', 'R-L57', 'R-L169', 'R-1729', 'R-1729D']);
  }
});
