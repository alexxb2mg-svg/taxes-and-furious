// EX-105 : construction du site (dist/) et partie complete jouee sur le resultat servi avec la CSP
// de _headers, comme Cloudflare Pages la servira. 0 erreur console (aucun style ni script en ligne bloque).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { DEPOT } from './aides.mjs';
import { construire, lireHeaders, lister } from '../outils/construire.mjs';
import { lancerNavigateur, servir, trouverChrome } from './navigateur.mjs';
import { allerAuChoix, avertissementAttendu, jouerPartie } from './partie.mjs';
import { SUITES_FINS } from './suites-fins.mjs';

// Texte exact de EX-105, recopie ici (et non importe) pour que le test controle le script.
const CSP_SPEC = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const PREFIXE = 'fiscfiction-dist-';
let tmp;
let dist;
let nav;

before(async () => {
  trouverChrome(); // echec explicite si le navigateur manque
  tmp = mkdtempSync(join(tmpdir(), PREFIXE));
  dist = join(tmp, 'dist');
  construire({ sortie: dist });
  nav = await lancerNavigateur();
});

after(async () => {
  await nav?.fermer();
  if (tmp && basename(tmp).startsWith(PREFIXE) && resolve(tmp).startsWith(resolve(tmpdir()))) rmSync(tmp, { recursive: true, force: true });
});

const entetesDe = (racine) => lireHeaders(readFileSync(join(racine, '_headers'), 'utf8'))['/*'];

test('EX-105 : dist/ ne contient que index.html, css/, js/, data/ (sans _modele) et _headers', () => {
  const fichiers = lister(dist);
  const racines = [...new Set(fichiers.map((f) => f.split('/')[0]))].sort();
  assert.deepEqual(racines, ['_headers', 'css', 'data', 'index.html', 'js']);
  for (const interdit of ['tests/', 'docs/', 'outils/', '_modele', '.git', 'lancer.py', 'README', 'LICENSE']) {
    assert.equal(fichiers.some((f) => f.includes(interdit)), false, `${interdit} ne doit pas etre dans dist/`);
  }
  // Tout le reste de data/, css/, js/ (fichiers suivis) est copie a l'identique.
  const suivis = spawnSync('git', ['ls-files', '--', 'index.html', 'css', 'js', 'data'], { cwd: DEPOT, encoding: 'utf8' });
  assert.equal(suivis.status, 0, suivis.stderr);
  const source = suivis.stdout.split('\n').filter((f) => f && !f.startsWith('data/profils/_modele/')).sort();
  assert.deepEqual(fichiers.filter((f) => f !== '_headers'), source);
  for (const f of source) assert.ok(readFileSync(join(dist, f)).equals(readFileSync(join(DEPOT, f))), `${f} copie a l'identique`);
});

test('EX-105 : _headers = en-tetes Cloudflare de la spec', () => {
  assert.deepEqual(entetesDe(dist), {
    'Content-Security-Policy': CSP_SPEC,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
});

test('EX-105 : la ligne de commande construit dist/ et refuse de vider un dossier etranger', () => {
  const sortie = join(tmp, 'cli');
  const cli = () => spawnSync(process.execPath, [join(DEPOT, 'outils', 'construire.mjs'), '--sortie', sortie], { encoding: 'utf8' });
  let r = cli();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^OK : \d+ fichier\(s\) dans /);
  r = cli(); // reconstruction sur une construction precedente : acceptee
  assert.equal(r.status, 0, r.stderr);
  mkdirSync(join(sortie, 'a-garder'));
  r = cli();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ECHEC : .*a-garder.*rien n'est supprime/);
  assert.ok(existsSync(join(sortie, 'a-garder')), 'rien supprime');
});

/** Sert `racine` avec les en-tetes de son _headers ; ouvre une page et renvoie { p, srv }. */
async function ouvrir(racine, options) {
  const srv = await servir(racine, {}, { entetes: entetesDe(racine) });
  const p = await nav.nouvellePage(options);
  await p.aller(`${srv.origine}/`);
  return { p, srv };
}

test('EX-105 : partie complete sur dist/ servi avec la CSP : 0 erreur console, 0 requete externe', async () => {
  for (const [largeur, hauteur] of [[1280, 800], [375, 740]]) {
    const { p, srv } = await ouvrir(dist, { largeur, hauteur });
    try {
      const csp = await p.eval(`fetch(location.href).then((r) => r.headers.get('content-security-policy'))`);
      assert.equal(csp, CSP_SPEC, 'la CSP est bien appliquee par le serveur de test');
      await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
      assert.equal(await p.eval(`document.querySelector('#ecran-titre [data-avertissement]').textContent.trim()`), avertissementAttendu(join(dist, 'data')));
      await allerAuChoix(p);
      const { resultat } = await jouerPartie(p, join(dist, 'data'), 'plombier', SUITES_FINS.plombier['plombier-fin-etanche'], { largeurMax: largeur });
      assert.equal(resultat.id, 'plombier-fin-etanche');
      // Les jauges sont reglees par CSSOM (style.setProperty), autorise par style-src 'self'.
      assert.notEqual(await p.eval(`document.querySelector('[data-jauge]').style.getPropertyValue('--niveau')`), '');
      assert.deepEqual(p.erreurs, [], `erreurs console ${largeur}x${hauteur}`);
      assert.deepEqual(p.requetesExternes(srv.origine), []);
    } finally {
      await p.fermer();
      await srv.fermer();
    }
  }
});

test('EX-105 : temoin : un style en ligne ajoute a index.html est bloque par la CSP et detecte', async () => {
  const copie = join(tmp, 'temoin');
  construire({ sortie: copie });
  const html = join(copie, 'index.html');
  writeFileSync(html, readFileSync(html, 'utf8').replace('</head>', '<style>body { outline: 1px solid red; }</style>\n</head>'));
  const { p, srv } = await ouvrir(copie);
  try {
    await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
    await p.attendre(() => p.erreurs.length > 0, 'erreur CSP signalee', 5000);
    assert.ok(p.erreurs.some((e) => /Content Security Policy/i.test(e)), `erreur CSP attendue : ${p.erreurs.join(' | ')}`);
  } finally {
    await p.fermer();
    await srv.fermer();
  }
});
