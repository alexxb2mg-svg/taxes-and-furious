// Type de scene "choix" (par defaut) : 2 a 4 choix, un bouton par choix (EX-033).
// Le resultat transmis a terminer() est l'id du choix clique ; le moteur l'applique (resoudre/choisir).
// Les controles des choix eux-memes (2 a 4, un "juste", references...) sont faits par outils/valider.mjs.

const LETTRES = ['A', 'B', 'C', 'D'];

export default {
  type: 'choix',

  /** Une scene a choix n'a pas de parametres. */
  validerParametres(parametres) {
    return parametres === undefined ? [] : ['une scene de type "choix" n\'a pas de parametres'];
  },

  /** Rendu dans `conteneur` avec les gabarits de index.html (#gabarit-scene-choix, #gabarit-choix). */
  rendre(scene, conteneur, terminer) {
    const doc = conteneur.ownerDocument;
    const bloc = doc.querySelector('#gabarit-scene-choix').content.cloneNode(true);
    const liste = bloc.querySelector('.liste-choix');
    scene.choix.forEach((c, i) => {
      const li = doc.querySelector('#gabarit-choix').content.firstElementChild.cloneNode(true);
      const b = li.querySelector('button');
      b.dataset.choix = c.id;
      li.querySelector('.choix-lettre').textContent = LETTRES[i];
      li.querySelector('.choix-texte').textContent = c.texte;
      b.addEventListener('click', () => terminer(c.id));
      liste.append(li);
    });
    conteneur.append(bloc);
  },
};
