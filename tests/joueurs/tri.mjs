// Joueur de test du type "tri" (EX-112) : `resultat` est le nombre de pieces bien rangees.
// Clics souris (CDP) : les `resultat` premieres pieces dans leur bac, les autres dans le premier
// bac different, puis « Valider le tri ».
export default {
  type: 'tri',

  async jouer(page, scene, resultat) {
    const { bacs, pieces } = scene.parametres;
    for (const [i, piece] of pieces.entries()) {
      const j = i < resultat ? bacs.indexOf(piece.bac_attendu) : bacs.findIndex((b) => b !== piece.bac_attendu);
      await page.cliquer(`#scene-jeu .tri-piece[data-piece="${i}"] .tri-bac[data-bac="${j}"]`);
    }
    await page.cliquer('#scene-jeu .tri-valider');
  },
};
