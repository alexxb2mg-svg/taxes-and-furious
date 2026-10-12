// Registre des joueurs de test (EX-111, EX-114) : pour chaque type de scene enregistre dans
// js/types/index.js, un module qui sait jouer une scene de ce type dans le navigateur headless.
// Une ligne par type ; chaque module exporte par defaut { type, jouer(page, scene, resultat) }.
// Utilise par tests/partie.mjs (jouerPartie) ; un test verifie que chaque type a son joueur.
export { default as choix } from './choix.mjs';
export { default as tri } from './tri.mjs';
