// Registre des animations (EX-113) : nom (valeur du champ `animation` d'une scene, d'un choix ou
// d'une issue) -> classe CSS et duree (600 ms au plus). Ajouter une animation = une entree ici
// + une regle CSS de meme classe dans css/style.css. Donnees pures : l'interface applique la classe,
// sauf sous `prefers-reduced-motion: reduce` (aucune animation, jeu identique).

export const DUREE_MAX_MS = 600;

export const ANIMATIONS = Object.freeze({
  // Tampon "Verifie" qui s'abat sur l'encadre.
  tampon: Object.freeze({ classe: 'anim-tampon', duree: 600 }),
  // Secousse breve de l'element.
  secousse: Object.freeze({ classe: 'anim-secousse', duree: 450 }),
});

/** Classes CSS de toutes les animations (pour les retirer avant un nouveau rendu). */
export const CLASSES_ANIMATIONS = Object.freeze(Object.values(ANIMATIONS).map((a) => a.classe));
