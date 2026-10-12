// Cablage du lot 5 sur le contenu reel de data/ : decors des chapitres (EX-150), portraits illustres
// (EX-152) et illustrations en pied (EX-156) de chaque personnage, joueur et embleme (EX-157),
// provenance des images (EX-154).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEPOT, DONNEES, chargerScenario, lireJson } from './aides.mjs';
import { valider, PROFILS_OBLIGATOIRES, IMAGES } from '../outils/valider.mjs';

const INITIAUX = Object.keys(PROFILS_OBLIGATOIRES);
const lire = (...p) => readFileSync(join(DEPOT, ...p), 'utf8').replace(/\r\n/g, '\n');

/** Tous les .webp sous data/, chemins relatifs au depot avec des barres obliques. */
function webpDeData(dossier = DONNEES) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return webpDeData(p);
    return e.name.toLowerCase().endsWith('.webp') ? [relative(DEPOT, p).split(sep).join('/')] : [];
  });
}

test('--exigences-lot4 --exigences-lot5 : data/ valide, code 0 en ligne de commande', () => {
  const r = valider({ racine: DONNEES, exigencesLot4: true, exigencesLot5: true });
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.avertissements, []);
  for (const id of INITIAUX) assert.ok(r.profils.includes(id), `profil "${id}" verifie`);
  const c = spawnSync(process.execPath, [join(DEPOT, 'outils', 'valider.mjs'), '--exigences-lot4', '--exigences-lot5'], { cwd: DEPOT, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(c.stdout, /^OK : donnees valides \(.*exigences du lot 5\)/);
});

test('EX-150 : decors par defaut du tronc et de l\'ecran titre dans communs/decors.json', () => {
  assert.deepEqual(lireJson(DONNEES, 'communs/decors.json'), {
    chapitres: {
      avis: 'decors/bureau-verificateur.webp',
      fec: 'decors/archives.webp',
      rectification: 'decors/bureau-verificateur.webp',
    },
    titre: 'decors/couverture.webp',
  });
});

test('EX-150 : chaque scene des 6 profils a un decor ; chaque profil utilise ses 2 decors et habille au moins un chapitre du tronc', () => {
  for (const id of INITIAUX) {
    const { scenario, profil } = chargerScenario(DONNEES, id);
    const propres = readdirSync(join(DONNEES, 'profils', id, 'decors')).filter((f) => f.endsWith('.webp')).map((f) => `profils/${id}/decors/${f}`);
    assert.equal(propres.length, 2, `${id} : 2 decors propres`);
    const utilises = new Set();
    for (const ch of scenario.chapitres) {
      for (const s of ch.scenes) {
        assert.ok(s.decor, `${id} / ${ch.id} / ${s.id} : decor attendu`);
        assert.ok(existsSync(join(DONNEES, ...s.decor.split('/'))), `${s.decor} present`);
        utilises.add(s.decor);
      }
      // Chapitres propres au profil : un decor du profil, jamais le decor generique du tronc.
      if (ch.origine === 'profil') for (const s of ch.scenes) assert.ok(propres.includes(s.decor), `${id} / ${ch.id} : decor du profil`);
    }
    for (const d of propres) assert.ok(utilises.has(d), `${id} : decor ${d} utilise`);
    const tronc = Object.keys(profil.decors).filter((ch) => ['avis', 'fec', 'rectification'].includes(ch));
    assert.ok(tronc.length >= 1, `${id} : au moins un chapitre du tronc habille par un decor du profil`);
  }
});

test('EX-152 / EX-156 / EX-157 : chaque personnage nomme de data/ a un portrait .webp et une illustration en pied', () => {
  const verifier = (dossier, p, ctx) => {
    assert.equal(p.portrait, `img/${p.id}.webp`, `${ctx} : portrait illustre`);
    assert.equal(p.illustration, `img/${p.id}${IMAGES.illustrationSuffixe}`, `${ctx} : illustration en pied`);
    for (const f of [p.portrait, p.illustration]) assert.ok(existsSync(join(dossier, ...f.split('/'))), `${ctx} : ${f} present`);
  };
  for (const p of lireJson(DONNEES, 'communs/personnages.json').personnages) verifier(join(DONNEES, 'communs'), p, `communs/${p.id}`);
  for (const id of INITIAUX) {
    const { scenario, profil } = chargerScenario(DONNEES, id);
    for (const p of profil.personnages) verifier(join(DONNEES, 'profils', id), p, `${id}/${p.id}`);
    const joueur = scenario.personnages.roles.joueur;
    assert.notEqual(joueur.id, 'joueur', `${id} : joueur propre au profil (EX-157)`);
    assert.ok(joueur.illustration, `${id} : illustration du joueur pour la carte de profil`);
  }
});

test('EX-154 : chaque .webp de data/ a son entree dans docs/art/PROMPTS.md (date et prompt) et inversement', () => {
  const prompts = lire('docs', 'art', 'PROMPTS.md');
  const blocs = prompts.split(/^### /m).slice(1);
  const entrees = blocs.map((b) => b.match(/^`([^`]+)`/)?.[1]);
  assert.deepEqual(entrees.filter((e) => !e), [], 'titre d\'entree sous la forme ### `chemin`');
  assert.deepEqual(entrees.filter((e, i) => entrees.indexOf(e) !== i), [], 'entrees en double');
  const fichiers = webpDeData();
  assert.ok(fichiers.length > 0);
  assert.deepEqual(fichiers.filter((f) => !entrees.includes(f)), [], '.webp sans entree dans PROMPTS.md');
  assert.deepEqual(entrees.filter((e) => !fichiers.includes(e)), [], 'entree de PROMPTS.md sans fichier');
  for (const b of blocs) {
    const nom = b.split('\n')[0];
    assert.match(b, /^- Date : \d{4}-\d{2}-\d{2}$/m, `${nom} : date`);
    assert.match(b, /^> \S.{40,}$/m, `${nom} : prompt exact`);
  }
});

test('EX-154 : provenance des illustrations dans LICENSE-CONTENU.md et le README', () => {
  const sansAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const mention = "illustrations generees avec l'aide de gemini (google), puis selectionnees et retouchees";
  for (const f of ['LICENSE-CONTENU.md', 'README.md']) {
    const t = sansAccents(lire(f)).replace(/[’]/g, "'").replace(/\s+/g, ' ');
    assert.ok(t.includes(mention) || t.includes(mention.replace(/^illustrations/, 'illustrations ont ete')), `${f} : mention de provenance`);
    assert.ok(t.includes('cc by 4.0'), `${f} : licence du contenu`);
    assert.ok(lire(f).includes('docs/art/PROMPTS.md'), `${f} : renvoi vers les prompts`);
  }
});
