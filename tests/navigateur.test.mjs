// EX-104 : trouverChrome() portable, teste sur de faux arbres de dossiers (un par plateforme).
// Aucun navigateur n'est lance ici ; les tests d'interface utilisent le vrai.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, dirname } from 'node:path';
import { trouverChrome, emplacementPlaywright } from './navigateur.mjs';

const PREFIXE = 'fiscfiction-chrome-arbre-';
const VAR_WINDOWS = ['LOCAL', 'APP', 'DATA'].join('');

function faux(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), PREFIXE));
  for (const rel of fichiers) {
    const f = join(racine, ...rel.split('/'));
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '');
  }
  return {
    racine,
    nettoyer() {
      if (basename(racine).startsWith(PREFIXE) && resolve(racine).startsWith(resolve(tmpdir()))) rmSync(racine, { recursive: true, force: true });
    },
  };
}

const CAS = [
  { platform: 'win32', arch: 'x64', cache: 'local/ms-playwright', sous: 'chrome-headless-shell-win64', exe: 'chrome-headless-shell.exe' },
  { platform: 'linux', arch: 'x64', cache: '.cache/ms-playwright', sous: 'chrome-headless-shell-linux64', exe: 'chrome-headless-shell' },
  { platform: 'linux', arch: 'arm64', cache: '.cache/ms-playwright', sous: 'chrome-headless-shell-linux-arm64', exe: 'chrome-headless-shell' },
  { platform: 'darwin', arch: 'arm64', cache: 'Library/Caches/ms-playwright', sous: 'chrome-headless-shell-mac-arm64', exe: 'chrome-headless-shell' },
  { platform: 'darwin', arch: 'x64', cache: 'Library/Caches/ms-playwright', sous: 'chrome-headless-shell-mac-x64', exe: 'chrome-headless-shell' },
];

for (const c of CAS) {
  test(`EX-104 : ${c.platform}/${c.arch} : cache Playwright de la plateforme, version la plus recente`, () => {
    const a = faux([
      `${c.cache}/chromium_headless_shell-999/${c.sous}/${c.exe}`,
      `${c.cache}/chromium_headless_shell-1223/${c.sous}/${c.exe}`,
      `${c.cache}/chromium_headless_shell-1208/${c.sous}/${c.exe}`,
      // Version plus recente mais sans le bon sous-dossier (autre plateforme) : ignoree.
      `${c.cache}/chromium_headless_shell-2000/chrome-headless-shell-autre/${c.exe}`,
      `${c.cache}/chromium-3000/chrome-win64/chrome.exe`,
    ]);
    try {
      const options = { platform: c.platform, arch: c.arch, home: a.racine, env: { [VAR_WINDOWS]: join(a.racine, 'local') } };
      assert.equal(emplacementPlaywright(options).cache, join(a.racine, ...c.cache.split('/')));
      assert.equal(trouverChrome(options), join(a.racine, ...c.cache.split('/'), 'chromium_headless_shell-1223', c.sous, c.exe));
    } finally {
      a.nettoyer();
    }
  });
}

test('EX-104 : CHROME_HEADLESS_SHELL passe avant le cache ; chemin explicite absent = erreur', () => {
  const a = faux(['perso/chrome-headless-shell', '.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell']);
  try {
    const explicite = join(a.racine, 'perso', 'chrome-headless-shell');
    assert.equal(trouverChrome({ platform: 'linux', arch: 'x64', home: a.racine, env: { CHROME_HEADLESS_SHELL: explicite } }), explicite);
    assert.throws(
      () => trouverChrome({ platform: 'linux', arch: 'x64', home: a.racine, env: { CHROME_HEADLESS_SHELL: join(a.racine, 'absent') } }),
      /navigateur introuvable : CHROME_HEADLESS_SHELL=.*n'est pas un fichier/,
    );
  } finally {
    a.nettoyer();
  }
});

test('EX-104 : introuvable = erreur explicite (jamais de saut)', () => {
  const vide = faux([]);
  const sansExe = faux(['.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/LISEZMOI']);
  try {
    assert.throws(() => trouverChrome({ platform: 'linux', arch: 'x64', home: vide.racine, env: {} }), /navigateur introuvable : .*ms-playwright absent \(installer : npx -y playwright@/);
    assert.throws(() => trouverChrome({ platform: 'linux', arch: 'x64', home: sansExe.racine, env: {} }), /navigateur introuvable : aucun chrome-headless-shell-linux64\/chrome-headless-shell/);
    assert.throws(() => trouverChrome({ platform: 'win32', arch: 'x64', home: vide.racine, env: {} }), /navigateur introuvable : variable d'environnement \w+ absente/);
    assert.throws(() => trouverChrome({ platform: 'aix', arch: 'ppc64', home: vide.racine, env: {} }), /plateforme aix non geree/);
  } finally {
    vide.nettoyer();
    sansExe.nettoyer();
  }
});

test('EX-104 : sur ce poste, le navigateur reel est trouve', () => {
  assert.match(basename(trouverChrome()), /^chrome-headless-shell(\.exe)?$/);
});
