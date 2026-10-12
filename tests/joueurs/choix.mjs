// Joueur de test du type "choix" : `resultat` est l'id du choix, clique avec la souris (CDP).
export default {
  type: 'choix',

  async jouer(page, scene, resultat) {
    await page.cliquer(`#scene-choix .choix[data-choix="${resultat}"]`);
  },
};
