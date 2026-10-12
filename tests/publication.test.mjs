// EX-100, EX-102, EX-103, EX-104 : fichiers de projet public (licences, README, guides, workflow).
// Les motifs recherches sont assembles (et non ecrits d'un bloc) pour que ce fichier ne se trouve
// pas lui-meme par la recherche qu'il fait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { DEPOT } from './aides.mjs';

const lire = (...p) => readFileSync(join(DEPOT, ...p), 'utf8').replace(/\r\n/g, '\n');
const git = (...args) => spawnSync('git', args, { cwd: DEPOT, encoding: 'utf8' });

// Texte MIT de opensource.org (https://opensource.org/license/mit), hors ligne de titulaire.
const MIT = [
  'MIT License',
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
];

test('EX-100 : aucun renvoi a l\'outillage interne, chemin de poste ni adresse e-mail dans les fichiers suivis (hors docs/spec)', () => {
  const motif = [
    ['kan', 'ban'].join(''),
    ['C:', '\\\\', 'Users'].join(''), // chemin de poste Windows : lecteur, barre oblique inverse, dossier des utilisateurs
    ['App', 'Data'].join(''),
    ['@', 'gmail'].join(''),
    ['@[a-z0-9-]+', '\\.(fr|com)'].join(''),
  ].join('|');
  const r = git('grep', '-n', '-I', '-i', '-E', motif, '--', '.', ':!docs/spec');
  assert.equal(r.status, 1, `aucune occurrence attendue (git grep code 1) :\n${r.stdout}${r.stderr}`);
  // Roles d'agents du processus interne, en majuscules, hors docs/spec (le nom de fichier de la spec n'en est pas un).
  const roles = git('grep', '-n', '-I', '-E', `\\b(${['SP', 'EC'].join('')}|${['REVIE', 'WER'].join('')}|${['D', 'EV'].join('')})\\b`, '--', '.', ':!docs/spec');
  const fichierSpec = new RegExp(`${['SP', 'EC'].join('')}\\.md`, 'g');
  const roleNomme = new RegExp(`\\b(${['SP', 'EC'].join('')}|${['REVIE', 'WER'].join('')}|${['D', 'EV'].join('')})\\b`);
  const citees = roles.stdout.split('\n').filter((l) => roleNomme.test(l.replace(/^[^:]+:\d+:/, '').replace(fichierSpec, '')));
  assert.deepEqual(citees, [], 'roles internes cites');
});

test('EX-100 : README et guide parlent de contributeurs et de pull request', () => {
  for (const f of ['README.md', 'docs/CREER_UN_PROFIL.md', 'CONTRIBUTING.md']) {
    const t = lire(f);
    assert.match(t, /contribut/i, `${f} : contributeurs`);
    assert.match(t, /pull request/, `${f} : pull request`);
  }
});

test('EX-102 : LICENSE = texte MIT officiel, titulaire et annee de la spec ; LICENSE-CONTENU.md = CC BY 4.0', () => {
  const lignes = lire('LICENSE').trimEnd().split('\n');
  assert.equal(lignes[2], 'Copyright (c) 2026 Les contributeurs de Taxes & Furious');
  assert.deepEqual([...lignes.slice(0, 2), ...lignes.slice(4)], MIT);
  assert.equal(lignes[3], '');
  const cc = lire('LICENSE-CONTENU.md');
  assert.match(cc, /CC BY 4\.0/);
  assert.match(cc, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/legalcode/);
  assert.match(cc, /`data\/`/);
  assert.match(cc, /portraits SVG/);
  const readme = lire('README.md');
  const licence = readme.slice(readme.indexOf('## Licence'));
  assert.ok(readme.includes('## Licence'), 'section Licence du README');
  assert.match(licence, /\(LICENSE\)/);
  assert.match(licence, /\(LICENSE-CONTENU\.md\)/);
  assert.match(licence, /MIT/);
  assert.match(licence, /CC BY 4\.0/);
});

/** Liens markdown relatifs d'un fichier : [texte](chemin) et ![alt](chemin), hors URL et ancres. */
function liensRelatifs(fichier) {
  const t = lire(fichier);
  return [...t.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^(https?:|mailto:|#)/.test(l)).map((l) => l.split('#')[0]);
}

test('EX-103 : chaque lien relatif de README, CONTRIBUTING, guide et modele de pull request existe', () => {
  for (const f of ['README.md', 'CONTRIBUTING.md', 'LICENSE-CONTENU.md', 'docs/CREER_UN_PROFIL.md', 'docs/AJOUTER_UN_TYPE_DE_SCENE.md', 'docs/ARCHITECTURE.md', '.github/pull_request_template.md']) {
    const liens = liensRelatifs(f);
    if (f === 'README.md') assert.ok(liens.length >= 5, `README : liens relatifs attendus (${liens.length})`);
    for (const l of liens) assert.ok(existsSync(resolve(DEPOT, dirname(f), l)), `${f} : lien ${l} introuvable`);
  }
});

test('EX-103 : README complet, CONTRIBUTING, modele de pull request ; captures demo-* retirees', () => {
  const readme = lire('README.md');
  for (const titre of ['## Jouer en ligne', '## Lancer en local', '## Tester', '## Contribuer', '## Licence', '## Avertissement']) {
    assert.ok(readme.includes(titre), `README : section ${titre}`);
  }
  assert.match(readme, /!\[[^\]]+\]\(docs\/captures\/[a-z]+-[^)]+\.png\)/, 'README : une capture');
  assert.match(readme, /Jeu humoristique\. Ce n'est pas un conseil fiscal\./, 'README : avertissement EX-004');
  const contrib = lire('CONTRIBUTING.md');
  assert.match(contrib, /## Ajouter un profil/);
  assert.match(contrib, /## Ajouter un type de scène/);
  assert.match(contrib, /article lu dans le texte officiel[\s\S]{0,120}ajoutée à `data\/references\.json` dans la même pull request/);
  assert.match(contrib, /relit/);
  const modele = lire('.github', 'pull_request_template.md');
  for (const c of ['node outils/valider.mjs', 'node --test tests/', 'Sources juridiques']) assert.ok(modele.includes(c), `modele : ${c}`);
  assert.ok((modele.match(/- \[ \]/g) ?? []).length >= 3, 'modele : cases a cocher');
  const captures = readdirSync(join(DEPOT, 'docs', 'captures'));
  assert.deepEqual(captures.filter((c) => c.startsWith('demo-')), []);
  const profils = JSON.parse(lire('data', 'profils', 'index.json'));
  for (const c of captures) assert.ok(profils.includes(c.split('-')[0]), `capture ${c} : profil reel`);
  assert.equal(git('ls-files', 'docs/captures/demo-*').stdout, '');
});

test('EX-104 : workflow tests.yml : push et pull request, actions epinglees par SHA, Playwright epingle, tests complets', () => {
  const w = lire('.github', 'workflows', 'tests.yml');
  assert.match(w, /^on:\n {2}push:\n {2}pull_request:/m);
  const uses = [...w.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2, 'actions utilisees');
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `action non epinglee par SHA : ${u}`);
  assert.ok(uses.some((u) => u.startsWith('actions/setup-node@')));
  assert.match(w, /node-version: '26'/);
  const pw = w.match(/npx -y playwright@(\d+\.\d+\.\d+) install (?:--with-deps )?chromium-headless-shell/);
  assert.ok(pw, 'installation de chrome-headless-shell par une version epinglee de Playwright');
  assert.ok(lire('README.md').includes(`npx -y playwright@${pw[1]} install chromium-headless-shell`), 'meme version que le README');
  assert.ok(lire('tests', 'navigateur.mjs').includes(`playwright@${pw[1]}`), 'meme version que le message de trouverChrome');
  assert.match(w, /run: node outils\/valider\.mjs/);
  assert.match(w, /run: node --test tests\//);
  assert.doesNotMatch(w, /\$\{\{\s*github\.event\./, 'aucune donnee d\'evenement dans les commandes');
});
