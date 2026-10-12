# Architecture

Taxes & Furious est un site statique, sans dépendance ni étape de compilation : des fichiers HTML, CSS, JavaScript (modules ES) et JSON, servis tels quels. Ce document situe les modules, dit ce qui est stable (sur quoi un contributeur peut s'appuyer) et ce qui ne l'est pas.

## Schéma des modules

```
                 data/  (contenu, JSON + portraits SVG)
                   │  tronc.json, profils/<id>/profil.json, variantes.json,
                   │  communs/personnages.json, references.json
                   ▼
 ┌──────────────────────────────┐         ┌──────────────────────────────┐
 │ js/moteur.js  (moteur pur)   │◄────────│ outils/valider.mjs           │
 │ assembler, nouvellePartie,   │         │ validateur des données       │
 │ choisir, resoudre, fin       │         │ (node outils/valider.mjs)    │
 │ aucun DOM, aucun hasard      │         └──────────────┬───────────────┘
 └──────────────▲───────────────┘                        │ validerParametres
                │ état ← résultat                        │
 ┌──────────────┴───────────────┐         ┌──────────────▼───────────────┐
 │ js/interface.js (DOM)        │────────►│ js/types/index.js (registre) │
 │ écrans, jauges, encadré loi, │ rendre  │  choix.js : choix multiples  │
 │ meilleurs scores             │◄────────│  tri.js   : tri des pièces   │
 │                              │terminer │  <type>.js : votre type      │
 └──────────────┬───────────────┘         └──────────────────────────────┘
                │ classe CSS
 ┌──────────────▼───────────────┐
 │ js/animations.js (registre)  │  nom → classe CSS de css/style.css, durée ≤ 600 ms
 └──────────────────────────────┘
```

- **`js/moteur.js` — moteur pur.** Assemble un scénario (tronc commun + profil + variantes + personnages communs), puis fait avancer la partie : `choisir(etat, idChoix)` pour une scène à choix, `resoudre(etat, resultat)` pour tout type de scène (première issue dont les conditions sont vraies). Chaque appel renvoie un nouvel état figé ; même état et même entrée donnent toujours le même état. Aucun accès à la page, au réseau, à l'heure ni au hasard. Le moteur ne connaît aucun type de scène en particulier.
- **`js/interface.js` — interface.** Seul module qui touche à la page : chargement des données, écrans (titre, choix du profil, partie, fin), jauges, encadré « Ce que dit vraiment la loi », meilleur score par profil (`localStorage`). Pour une scène, il prête une zone (`#scene-jeu`) au type de la scène, attend son résultat, le donne au moteur et affiche l'issue.
- **`js/types/` — types de scène.** Un fichier par type ; `js/types/index.js` est la seule liste qui les enregistre. Chaque type valide ses paramètres et rend son épreuve. Guide : [AJOUTER_UN_TYPE_DE_SCENE.md](AJOUTER_UN_TYPE_DE_SCENE.md).
- **`js/animations.js` — animations.** Registre nom → classe CSS et durée. Une scène, une issue ou un choix peut demander une animation par son nom ; l'interface n'en joue aucune si le système demande moins de mouvement (`prefers-reduced-motion: reduce`).
- **`data/` — données.** Tout le contenu du jeu : textes, personnages, fins, jauges, et les sources juridiques (`references.json`) citées par les explications. Guide : [CREER_UN_PROFIL.md](CREER_UN_PROFIL.md).
- **`outils/valider.mjs` — validateur.** Vérifie les données avant qu'elles arrivent dans le jeu : format, enchaînement des scènes, références juridiques, chiffres des explications, types de scène connus et leurs paramètres (via le registre), animations connues, couverture des notions obligatoires.
- **`outils/construire.mjs`** construit le site publié (`dist/`) avec ses en-têtes de sécurité ; **`outils/captures.mjs`** refait les captures d'écran ; **`lancer.py`** sert le jeu en local.
- **`tests/`** — `node --test tests/` : moteur, validateur, profils (chaque fin atteignable), et parties jouées dans un navigateur sans fenêtre. `tests/joueurs/` : un joueur de test par type de scène, enregistré dans `tests/joueurs/index.mjs`.

## Ce qui est stable

Un contributeur peut s'appuyer sur :

- **le format des données** : `tronc.json`, `profils/<id>/profil.json` et `variantes.json`, `communs/personnages.json`, `references.json`, `profils/index.json`, y compris les champs `type`, `parametres`, `issues` et `si` des scènes et le champ `animation`. Une évolution qui les change met à jour le validateur, les guides et les données dans la même pull request ;
- **le contrat des types de scène** : un module exporte `{ type, validerParametres(parametres), rendre(scene, conteneur, terminer) }`, avec `decrire` et `resultatsPossibles` facultatifs ; le résultat est une donnée simple ; il s'enregistre par une ligne dans `js/types/index.js` ;
- **le registre des animations** : un nom, une classe CSS, une durée de 600 ms au plus ;
- **les règles de fond** : moteur pur et déterministe, aucune requête hors du site, aucun style ni script en ligne, jouable au clavier, à la souris et au toucher, à 375 px de large ;
- **le contrat des joueurs de test** : `tests/joueurs/<type>.mjs` exporte `{ type, jouer(page, scene, resultat) }` et s'enregistre par une ligne dans `tests/joueurs/index.mjs` ; c'est par lui, et non en modifiant `tests/partie.mjs`, qu'un nouveau type se joue dans les parties de test (guide, section 7).

## Ce qui ne l'est pas

Peut changer sans préavis, ne pas s'en servir depuis un type ou un outil externe :

- les fonctions internes de `js/moteur.js` et de `js/interface.js` autres que celles citées ci-dessus, et la forme exacte de l'objet d'état (champs ajoutés ou renommés) ;
- la structure de `index.html` et les classes CSS de l'interface (hors zone `#scene-jeu` prêtée aux types) ;
- l'apparence : couleurs, mise en page, textes de l'interface ;
- les aides de test de `tests/` (`navigateur.mjs`, fonctions internes de `partie.mjs`) et les suites figées de `tests/suites-fins.mjs`.
