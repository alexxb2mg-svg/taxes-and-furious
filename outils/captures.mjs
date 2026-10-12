// Captures des 5 écrans (EX-033) en 1280x800 et 375x740, navigateur headless ; si le profil a
// une scène de mini-jeu tri (EX-112), 2 captures de plus : 6-tri (pièces rangées) et 7-tri-resultat.
//   node outils/captures.mjs [--donnees data] [--profil plombier] [--sortie docs/captures]
// Par défaut, un profil réel de data/ : docs/captures/ ne garde que des profils réels (EX-103).
// Joue la première partie du profil (premier choix à chaque scène) jusqu'à la fin.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerNavigateur, servir } from '../tests/navigateur.mjs';

const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function options(argv) {
  const o = { donnees: 'data', profil: 'plombier', sortie: join(DEPOT, 'docs', 'captures') };
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i].replace(/^--/, '');
    if (!(cle in o) || argv[i + 1] === undefined) throw new Error(`option ${argv[i]} inconnue ou sans valeur`);
    o[cle] = cle === 'sortie' ? resolve(argv[i + 1]) : argv[i + 1];
  }
  return o;
}

const TAILLES = [[1280, 800], [375, 740]];

/** Index du bon bac de chaque pièce de la scène tri `idScene` du profil (données de `o.donnees`). */
function bacsAttendus(o, idScene) {
  const profil = JSON.parse(readFileSync(join(resolve(DEPOT, o.donnees), 'profils', o.profil, 'profil.json'), 'utf8'));
  const scene = profil.chapitres.flatMap((c) => c.scenes).find((s) => s.id === idScene);
  if (!scene) throw new Error(`scene tri "${idScene}" absente de profils/${o.profil}/profil.json`);
  return scene.parametres.pieces.map((x) => scene.parametres.bacs.indexOf(x.bac_attendu));
}

async function principal() {
  const o = options(process.argv.slice(2));
  mkdirSync(o.sortie, { recursive: true });
  const srv = await servir(DEPOT);
  const nav = await lancerNavigateur();
  const fichiers = [];
  try {
    for (const [l, h] of TAILLES) {
      const p = await nav.nouvellePage({ largeur: l, hauteur: h });
      const cap = async (nom) => {
        await p.attendre(`[...document.images].every((i) => i.complete)`, 'images');
        await new Promise((r) => setTimeout(r, 400)); // fin des transitions CSS des jauges
        const f = join(o.sortie, `${o.profil}-${nom}-${l}x${h}.png`);
        await p.capture(f);
        fichiers.push(f);
      };
      await p.aller(`${srv.origine}/?donnees=${encodeURIComponent(o.donnees)}`);
      await p.attendre(`document.body.dataset.pret === 'oui'`, 'interface prete');
      await cap('1-titre');
      await p.cliquer('#bouton-commencer');
      await p.attendre(`document.body.dataset.ecran === 'ecran-choix'`, 'choix');
      await cap('2-choix-profil');
      await p.cliquer(`.carte-profil[data-profil="${o.profil}"]`);
      await p.attendre(`document.body.dataset.ecran === 'ecran-partie'`, 'partie');
      // Avance jusqu'à une scène avec portrait pour la capture "scene".
      let capturee = false;
      let triCapture = false;
      while (await p.eval(`document.body.dataset.ecran`) === 'ecran-partie') {
        await p.attendre(`!document.querySelector('#scene').hidden`, 'scene');
        const portrait = await p.eval(`!!document.querySelector('#scene-orateur img')`);
        if (!capturee && portrait) await cap('3-scene');
        if (await p.eval(`document.querySelector('#scene').dataset.type`) === 'tri') {
          // Mini-jeu de tri (EX-112) : chaque pièce dans son bac, captures du tri rempli puis du résultat.
          const n = await p.eval(`document.querySelectorAll('#scene-jeu .tri-piece').length`);
          const attendus = bacsAttendus(o, await p.eval(`document.querySelector('#scene').dataset.scene`));
          for (let i = 0; i < n; i += 1) await p.cliquer(`#scene-jeu .tri-piece[data-piece="${i}"] .tri-bac[data-bac="${attendus[i]}"]`);
          if (!triCapture) {
            await p.eval(`document.querySelector('#scene-jeu').scrollIntoView({ block: 'start' })`);
            await cap('6-tri');
          }
          await p.cliquer('#scene-jeu .tri-valider');
          await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre du tri');
          if (!triCapture) {
            await p.eval(`document.querySelector('#encadre').scrollIntoView({ block: 'start' }); window.scrollBy(0, -32)`);
            await new Promise((r) => setTimeout(r, 700)); // fin de l'animation du tampon (600 ms)
            await cap('7-tri-resultat');
            triCapture = true;
          }
        } else {
          await p.cliquer('#scene-choix .choix');
        }
        await p.attendre(`!document.querySelector('#encadre').hidden`, 'encadre');
        if (!capturee && portrait) {
          await cap('4-encadre-loi');
          capturee = true;
        }
        await p.cliquer('#bouton-suivant');
        await new Promise((r) => setTimeout(r, 30));
      }
      await p.attendre(`document.body.dataset.ecran === 'ecran-fin'`, 'fin');
      await cap('5-fin');
      if (p.erreurs.length) console.error(`erreurs console (${l}x${h}) :`, p.erreurs);
      await p.fermer();
    }
  } finally {
    await nav.fermer();
    await srv.fermer();
  }
  for (const f of fichiers) console.log(f);
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
