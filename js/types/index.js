// Registre des types de scene (EX-111) : la seule liste a modifier pour enregistrer un type.
// Une ligne par type ; chaque module exporte par defaut { type, validerParametres, rendre }.
// Le nom d'export est libre : c'est le champ `type` du module qui compte.
export { default as choix } from './choix.js';
export { default as tri } from './tri.js';
