// Decors et portraits illustres (EX-150, EX-152, EX-153, EX-155) : resolution du decor par le moteur,
// lecture des dimensions WebP, plafonds de poids du validateur, outil outils/preparer-images.py.
// L'outil de preparation demande Python et Pillow (outil local, installe en integration continue) :
// s'ils manquent, les tests EX-155 echouent (jamais sautes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assembler, portraitRepli, decorTitre } from '../js/moteur.js';
import { valider, dimensionsWebp, IMAGES } from '../outils/valider.mjs';
import { DEPOT, DONNEES, DONNEES_DEMO, chargerScenario, copieTemporaire, lireJson } from './aides.mjs';

const ART = join(DEPOT, 'tests', 'donnees', 'art');
const OUTIL = join(DEPOT, 'outils', 'preparer-images.py');
const PYTHON = process.env.PYTHON ?? 'python';

// ------------------------------------------------------------------ EX-150 : moteur

test('EX-150 : decor resolu dans les 4 cas (scene, chapitre du profil, defaut du tronc, aucun)', () => {
  const { scenario } = chargerScenario(DONNEES_DEMO, 'demo-fleuriste');
  const scene = (id) => scenario.chapitres.flatMap((c) => c.scenes).find((s) => s.id === id);
  // 1. decor de la scene (caisse-s2), prioritaire sur le decor du chapitre du profil
  assert.equal(scene('caisse-s2').decor, 'profils/demo-fleuriste/decors/arriere-boutique.webp');
  // 2. decor du chapitre dans le profil : chapitre propre (caisse) et chapitre du tronc (fec, qui a un defaut)
  assert.equal(scene('caisse-s1').decor, 'profils/demo-fleuriste/decors/boutique.webp');
  for (const s of scenario.chapitres.find((c) => c.id === 'tronc:fec').scenes) {
    assert.equal(s.decor, 'profils/demo-fleuriste/decors/arriere-boutique.webp', `${s.id} : profil avant le defaut du tronc`);
  }
  // 3. decor par defaut du tronc (communs/decors.json)
  for (const s of scenario.chapitres.find((c) => c.id === 'tronc:avis').scenes) {
    assert.equal(s.decor, 'communs/decors/bureau.webp', s.id);
  }
  // 4. aucun : chapitre sans decor nulle part
  for (const s of scenario.chapitres.find((c) => c.id === 'tronc:rectification').scenes) assert.equal(s.decor, null, s.id);

  // L'autre profil n'a pas de decors : defaut du tronc seulement (fec -> archives).
  const gl = chargerScenario(DONNEES_DEMO, 'demo-glacier').scenario;
  assert.equal(gl.chapitres.find((c) => c.id === 'tronc:fec').scenes[0].decor, 'communs/decors/archives.webp');
  assert.ok(gl.chapitres.filter((c) => c.origine === 'profil').every((c) => c.scenes.every((s) => s.decor === null)));
});

test('EX-150 : sans decors.json ni decors, aucune scene n\'a de decor (fond uni) ; decor du titre', () => {
  const tronc = lireJson(DONNEES_DEMO, 'tronc.json');
  const communs = lireJson(DONNEES_DEMO, 'communs/personnages.json');
  const profil = { ...lireJson(DONNEES_DEMO, 'profils/demo-fleuriste/profil.json') };
  delete profil.decors;
  profil.chapitres = profil.chapitres.map((c) => ({ ...c, scenes: c.scenes.map(({ decor, ...s }) => s) }));
  const scenario = assembler(tronc, profil, {}, communs);
  assert.ok(scenario.chapitres.every((c) => c.decor === null && c.scenes.every((s) => s.decor === null)));
  assert.equal(decorTitre(lireJson(DONNEES_DEMO, 'communs/decors.json')), 'communs/decors/couverture.webp');
  assert.equal(decorTitre({ chapitres: {}, titre: null }), null);
  assert.equal(decorTitre(undefined), null);
  // data/communs/decors.json existe (vide pour l'instant) et reste valide.
  assert.deepEqual(Object.keys(lireJson(DONNEES, 'communs/decors.json')).sort(), ['chapitres', 'titre']);
});

test('EX-152 : repli d\'un portrait .webp = SVG de meme nom ; aucun repli pour un SVG', () => {
  assert.equal(portraitRepli('profils/x/img/a.webp'), 'profils/x/img/a.svg');
  assert.equal(portraitRepli('profils/x/img/a.WEBP'), 'profils/x/img/a.svg');
  assert.equal(portraitRepli('profils/x/img/a.svg'), null);
  assert.equal(portraitRepli(null), null);
});

// ------------------------------------------------------------------ EX-152 / EX-153 : fichiers WebP

/** En-tete WebP VP8X minimal (le validateur ne decode pas l'image) complete a `octets`. */
function webpSynthetique(largeur, hauteur, octets = 64) {
  const b = Buffer.alloc(Math.max(octets, 30));
  b.write('RIFF', 0, 'latin1');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WEBPVP8X', 8, 'latin1');
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(largeur - 1, 24, 3);
  b.writeUIntLE(hauteur - 1, 27, 3);
  return b;
}

test('EX-152 : dimensions lues dans l\'en-tete WebP (VP8, VP8L, VP8X), null sinon', () => {
  // Fichiers reels produits par l'encodeur (avec perte, sans perte) et en-tete synthetique.
  assert.deepEqual(dimensionsWebp(readFileSync(join(DONNEES_DEMO, 'profils/demo-fleuriste/img/pistil.webp'))), { largeur: 512, hauteur: 512 });
  assert.deepEqual(dimensionsWebp(readFileSync(join(DONNEES_DEMO, 'communs/decors/bureau.webp'))), { largeur: 1280, hauteur: 720 });
  assert.deepEqual(dimensionsWebp(readFileSync(join(ART, 'decor-800.webp'))), { largeur: 800, hauteur: 450 });
  assert.deepEqual(dimensionsWebp(webpSynthetique(1600, 900)), { largeur: 1600, hauteur: 900 });
  assert.equal(dimensionsWebp(readFileSync(join(ART, 'portrait-essai.png'))), null);
  assert.equal(dimensionsWebp(Buffer.from('RIFF')), null);
});

test('EX-153 : poids et dimensions mesures sur tous les .webp de data/ et des donnees de demonstration', () => {
  for (const racine of [DONNEES, DONNEES_DEMO]) {
    let total = 0;
    const liste = readdirSync(racine, { recursive: true }).map(String).filter((f) => f.endsWith('.webp'));
    for (const f of liste) {
      const parties = f.split(/[\\/]/);
      const octets = statSync(join(racine, f)).size;
      total += octets;
      const dim = dimensionsWebp(readFileSync(join(racine, f)));
      if (parties.includes('decors')) {
        assert.ok(octets <= IMAGES.decorMaxOctets, `${f} : ${octets} octets`);
        assert.ok(dim.largeur >= 1280 && dim.largeur <= 1600, `${f} : ${dim.largeur} px`);
      } else if (parties.includes('img')) {
        assert.ok(octets <= IMAGES.portraitMaxOctets, `${f} : ${octets} octets`);
        assert.deepEqual(dim, { largeur: 512, hauteur: 512 }, f);
      }
    }
    assert.ok(total <= 6 * 1024 * 1024, `${racine} : ${total} octets de WebP`);
  }
  assert.equal(IMAGES.decorMaxOctets, 250 * 1024);
  assert.equal(IMAGES.portraitMaxOctets, 80 * 1024);
  assert.equal(IMAGES.totalMaxOctets, 6 * 1024 * 1024);
});

test('EX-153 : le validateur refuse un decor de plus de 250 Ko et plus de 6 Mo d\'images au total', () => {
  const copie = copieTemporaire();
  try {
    const decors = join(copie.racine, 'communs', 'decors');
    writeFileSync(join(decors, 'bureau.webp'), webpSynthetique(1280, 720, 250 * 1024)); // pile au plafond : accepte
    assert.deepEqual(valider({ racine: copie.racine, couverture: false }).erreurs, []);
    writeFileSync(join(decors, 'bureau.webp'), webpSynthetique(1280, 720, 250 * 1024 + 1));
    assert.ok(valider({ racine: copie.racine, couverture: false }).erreurs
      .some((e) => e === 'communs/decors/bureau.webp : decor de 251 Ko : plafond 250 Ko (EX-153)'));
    writeFileSync(join(decors, 'bureau.webp'), webpSynthetique(1280, 720, 200 * 1024));
    for (let i = 0; i < 31; i += 1) writeFileSync(join(decors, `extra-${i}.webp`), webpSynthetique(1600, 900, 200 * 1024));
    const { erreurs } = valider({ racine: copie.racine, couverture: false });
    assert.equal(erreurs.length, 1, erreurs.join('\n'));
    assert.match(erreurs[0], /^\*\*\/\*\.webp : 6\.\d\d Mo d'images WebP au total : plafond 6 Mo \(EX-153\)$/);
  } finally {
    copie.nettoyer();
  }
});

// ------------------------------------------------------------------ EX-155 : outil de preparation

function dossierTemp() {
  const d = mkdtempSync(join(tmpdir(), 'fiscfiction-images-'));
  return {
    d,
    nettoyer: () => {
      if (basename(d).startsWith('fiscfiction-images-') && resolve(d).startsWith(resolve(tmpdir()))) rmSync(d, { recursive: true, force: true });
    },
  };
}

const outil = (...args) => spawnSync(PYTHON, [OUTIL, ...args], { cwd: DEPOT, encoding: 'utf8' });

/** Lit des pixels RGBA d'une image avec Pillow : { taille, pixels: [[r,g,b,a], ...] }. */
function pixels(fichier, points) {
  const code = 'import json,sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGBA")\n'
    + 'print(json.dumps({"format":Image.open(sys.argv[1]).format,"taille":im.size,"pixels":[im.getpixel(tuple(p)) for p in json.loads(sys.argv[2])]}))';
  const r = spawnSync(PYTHON, ['-c', code, fichier, JSON.stringify(points)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `lecture Pillow : ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test('EX-155 : Python et Pillow (avec WebP) presents pour l\'outil de preparation', () => {
  const r = spawnSync(PYTHON, ['-c', 'from PIL import features; import PIL; print(PIL.__version__, features.check("webp"))'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `Pillow introuvable (pip install pillow) : ${r.error?.message ?? r.stderr}`);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+ True$/);
});

test('EX-155 : portrait d\'essai -> WebP carre 512, <= 80 Ko, coins transparents, centre et blancs interieurs opaques', () => {
  const t = dossierTemp();
  try {
    const sortie = join(t.d, 'portrait.webp');
    const r = outil('portrait', join(ART, 'portrait-essai.png'), sortie);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /512x512, \d+ octets/);
    assert.ok(statSync(sortie).size <= 80 * 1024, `${statSync(sortie).size} octets`);
    assert.deepEqual(dimensionsWebp(readFileSync(sortie)), { largeur: 512, hauteur: 512 });
    const coins = [[0, 0], [511, 0], [0, 511], [511, 511], [4, 256], [507, 256]];
    // Centre du personnage (cou), puis le blanc d'un oeil et le col blanc : entoures par le personnage,
    // ils restent opaques (remplissage depuis les coins, pas de seuil global).
    const interieurs = [[256, 256]];
    const lu = pixels(sortie, [...coins, ...interieurs]);
    assert.equal(lu.format, 'WEBP');
    assert.deepEqual(lu.taille, [512, 512]);
    lu.pixels.slice(0, coins.length).forEach((p, i) => assert.equal(p[3], 0, `coin ${coins[i]} transparent`));
    lu.pixels.slice(coins.length).forEach((p, i) => assert.equal(p[3], 255, `${interieurs[i]} opaque`));
    // Blancs interieurs : les pixels blancs opaques existent encore apres detourage.
    const code = 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGBA")\n'
      + 'print(sum(1 for r,g,b,a in im.getdata() if a==255 and min(r,g,b)>=245))';
    const blancs = spawnSync(PYTHON, ['-c', code, sortie], { encoding: 'utf8' });
    assert.equal(blancs.status, 0, blancs.stderr);
    assert.ok(Number(blancs.stdout) > 2000, `${blancs.stdout.trim()} pixels blancs opaques (yeux, col) conserves`);
  } finally {
    t.nettoyer();
  }
});

test('EX-155 : decor d\'essai -> WebP 16:9 de 1280 a 1600 px, <= 250 Ko ; largeur hors bornes refusee', () => {
  const t = dossierTemp();
  try {
    for (const largeur of [1280, 1600]) {
      const sortie = join(t.d, `decor-${largeur}.webp`);
      const r = outil('decor', join(ART, 'decor-essai.png'), sortie, '--largeur', String(largeur));
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(dimensionsWebp(readFileSync(sortie)), { largeur, hauteur: Math.round(largeur * 9 / 16) });
      assert.ok(statSync(sortie).size <= 250 * 1024);
    }
    const r = outil('decor', join(ART, 'decor-essai.png'), join(t.d, 'x.webp'), '--largeur', '800');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /largeur 800 hors de 1280 a 1600 px/);
  } finally {
    t.nettoyer();
  }
});

test('EX-155 : verifier controle les poids d\'EX-153 (0 sur les donnees de demonstration, 1 sur un portrait trop lourd)', () => {
  let r = outil('verifier', DONNEES_DEMO);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 ecart\(s\)/);
  const t = dossierTemp();
  try {
    mkdirSync(join(t.d, 'img'));
    mkdirSync(join(t.d, 'decors'));
    writeFileSync(join(t.d, 'img', 'lourd.webp'), readFileSync(join(ART, 'portrait-lourd.webp')));
    writeFileSync(join(t.d, 'decors', 'etroit.webp'), readFileSync(join(ART, 'decor-800.webp')));
    r = outil('verifier', t.d);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /img\/lourd\.webp : portrait de 126 Ko \(plafond 80 Ko\)/);
    assert.match(r.stderr, /decors\/etroit\.webp : decor de 800 px de large/);
  } finally {
    t.nettoyer();
  }
});
