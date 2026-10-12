# Ajouter un type de scène

Ce guide explique comment ajouter une nouvelle mécanique de jeu (un mini-jeu, une épreuve, une autre façon de répondre au vérificateur) **sans toucher au cœur du jeu** : `js/moteur.js` et `js/interface.js` restent identiques. Il suffit d'un fichier `js/types/<type>.js`, d'une ligne dans `js/types/index.js` et de données ; côté tests, d'un joueur de test et d'une ligne qui l'enregistre (section 7).

Vous n'avez pas besoin de lire le code du moteur ni de l'interface pour suivre ce guide. Pour situer les modules les uns par rapport aux autres : [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Le principe

Une scène a un champ `type`. Sans ce champ, c'est une scène `"choix"` : le joueur clique un des 2 à 4 choix, comme dans tout le jeu.

Une scène d'un autre type :

1. est **rendue** par son module de type, dans une zone que l'interface lui prête ;
2. produit un **résultat** quand le joueur a fini (un nombre, un texte, un booléen, ou un petit objet de ces valeurs) ;
3. est **résolue** par le moteur à partir de ce résultat : il prend la première de ses `issues` dont les conditions `si` sont vraies.

Une issue se comporte exactement comme un choix : elle a ses effets sur les jauges, sa réaction, son explication juridique avec ses références, son `suivant`, et compte comme un « bon réflexe » si elle est `juste`. L'encadré « Ce que dit vraiment la loi » s'affiche ensuite comme après un choix.

Le moteur ne connaît aucun type : il ne voit que le résultat et les issues. C'est ce qui garde le jeu déterministe et testable.

## 2. Le contrat d'un type

Un module de type exporte par défaut un objet :

| Champ | Rôle |
| --- | --- |
| `type` | Nom du type, tel qu'écrit dans le champ `type` des scènes (ex. `"essai-bouton"`). |
| `validerParametres(parametres)` | Renvoie la liste des erreurs (textes en français, qui nomment le champ fautif) ; liste vide si les paramètres sont bons. Appelée par le validateur (`node outils/valider.mjs`) et au chargement d'un profil. |
| `rendre(scene, conteneur, terminer)` | Construit l'épreuve dans `conteneur` (un élément vide). Quand le joueur a fini, appeler `terminer(resultat)` une seule fois. |
| `decrire(scene, resultat)` | Facultatif. Texte court affiché dans l'encadré après l'épreuve (« Résultat : … »). Sans lui, l'encadré affiche le champ `texte` de l'issue retenue, s'il existe. |
| `resultatsPossibles(parametres)` | Facultatif. Liste de tous les résultats possibles : les tests s'en servent pour vérifier que chaque fin reste atteignable. Indispensable si le type est utilisé dans `data/`. |

Dans `rendre`, `scene` contient `id`, `texte`, `personnage`, `parametres` et `issues`. Les paramètres sont libres : c'est votre type qui décide de leur forme et qui la vérifie.

Pour créer des éléments, passez par le document du conteneur (`conteneur.ownerDocument.createElement(...)`), jamais par `document` ou `window` : seul `js/interface.js` touche à la page, et un test le vérifie.

## 3. Exemple complet : le type `essai-bouton`

Le plus petit type possible : un bouton qui renvoie toujours `1`. Les tests du dépôt rejouent exactement cet exemple (fichier, ligne d'enregistrement, scène) dans une copie du site, le valident et le jouent jusqu'à une fin.

### 3.1 Le fichier du type

Créer `js/types/essai-bouton.js` :

```js
// js/types/essai-bouton.js
// Type de démonstration : un bouton qui renvoie toujours 1.
export default {
  type: 'essai-bouton',

  validerParametres(parametres) {
    if (parametres === null || typeof parametres !== 'object' || typeof parametres.libelle !== 'string' || !parametres.libelle.trim()) {
      return ['champ "libelle" : texte du bouton obligatoire'];
    }
    return [];
  },

  resultatsPossibles() {
    return [1];
  },

  rendre(scene, conteneur, terminer) {
    const bouton = conteneur.ownerDocument.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton bouton-principal';
    bouton.dataset.essai = 'bouton';
    bouton.textContent = scene.parametres.libelle;
    bouton.addEventListener('click', () => terminer(1));
    conteneur.append(bouton);
  },
};
```

Un `<button>` natif est déjà utilisable au clavier (Tab puis Entrée ou Espace), à la souris et au toucher, avec le contour de focus du jeu.

### 3.2 L'enregistrer

Ajouter **une ligne** à `js/types/index.js`, la seule liste des types :

```js
export { default as essaiBouton } from './essai-bouton.js';
```

Le nom à gauche de `from` est libre ; c'est le champ `type` du module qui compte.

### 3.3 L'utiliser dans un profil

Dans un chapitre de `data/profils/<id>/profil.json`, ajouter la scène, puis faire pointer vers elle le `suivant` d'une scène précédente du même chapitre (ou la placer en tête de chapitre). Exemple :

```json
{
  "id": "chantier-bouton",
  "type": "essai-bouton",
  "personnage": "narrateur",
  "texte": "Le vérificateur vous tend un formulaire d'une seule case. Une seule. C'est suspect.",
  "parametres": { "libelle": "Cocher la case" },
  "issues": [
    {
      "id": "chantier-bouton-fait",
      "si": [{ "op": "==", "valeur": 1 }],
      "juste": true,
      "effets": { "redressement": 0, "patience": 0, "stress": 0 },
      "reaction": "La case est cochée. Le vérificateur range le formulaire avec respect.",
      "explication": "Le taux normal de TVA est de 20 %.",
      "references": ["R-278"],
      "suivant": null
    },
    {
      "id": "chantier-bouton-autre",
      "juste": false,
      "effets": { "redressement": 0, "patience": 0, "stress": 0 },
      "reaction": "Rien ne se passe. C'est encore plus suspect.",
      "explication": "Le taux normal de TVA est de 20 %.",
      "references": ["R-278"],
      "suivant": null
    }
  ]
}
```

Règles des issues :

- `issues` remplace `choix` (une scène d'un autre type n'a pas de `choix`) ;
- elles sont évaluées dans l'ordre ; la **dernière n'a pas de `si`**, pour qu'une issue soit toujours trouvée ;
- au moins une issue est `"juste": true` ;
- `si` est une liste de conditions, toutes vraies pour retenir l'issue : `{ "op": ">=", "valeur": 3 }` compare le résultat ; `{ "champ": "mode", "op": "==", "valeur": "rapide" }` compare un champ d'un résultat objet. Opérateurs : `<`, `<=`, `>`, `>=`, `==` ;
- `id`, `juste`, `effets`, `reaction`, `explication`, `references`, `suivant` suivent les mêmes règles que les choix ; `texte` est facultatif ;
- les chiffres de l'explication doivent figurer dans les références citées (même contrôle que pour les choix), et toute référence vient de `data/references.json`.

Une scène, une issue ou un choix peut aussi porter `"animation": "tampon"` ou `"animation": "secousse"` (voir la section 6).

### 3.4 Vérifier

```bash
node outils/valider.mjs
```

Le validateur signale, en nommant fichier, scène et champ : un type non enregistré, des paramètres refusés par `validerParametres`, une dernière issue conditionnelle, une animation inconnue. Puis lancez le jeu (`python lancer.py`) et jouez la scène.

Avant `node --test tests/`, ajoutez le joueur de test du type et, si besoin, complétez les suites figées : c'est la section 7, qui nomme exactement les fichiers à toucher.

## 4. Déterminisme

Le moteur est pur : même état et même résultat donnent toujours le même état suivant. Pour que cela tienne avec votre type :

- **le résultat ne dépend que de ce que le joueur a fait**, jamais du hasard ni de l'heure : pas de `Math.random()`, pas de `Date.now()`, pas de minuterie qui décide à la place du joueur ;
- le résultat est une **donnée simple** : nombre fini, texte, booléen, `null`, tableau ou objet de ces valeurs. Le moteur refuse le reste (fonction, date, `NaN`…) avec un message clair ;
- `terminer` n'est pris en compte qu'**une fois** par scène ;
- `validerParametres` et `resultatsPossibles` sont des fonctions pures : elles ne lisent que leurs arguments.

## 5. Accessibilité

Chaque type doit être jouable :

- **au clavier** : Tab pour aller d'un élément à l'autre, flèches dans un groupe, Entrée pour valider, avec un focus visible ;
- **à la souris et au toucher**, avec des cibles assez grandes pour un doigt ;
- **sans minuterie** : aucune pression de temps, le joueur valide quand il veut ;
- **à 375 px de large sans défilement horizontal** ;
- avec des contrôles natifs autant que possible (`<button>`, groupes de boutons radio dans un `<fieldset>` avec `<legend>`), qui sont lus correctement par les lecteurs d'écran.

Les styles vont dans `css/style.css` (aucun style ni script en ligne : le site publié est servi avec une politique de sécurité du contenu stricte). Les textes de contenu (consignes propres à une scène, pièces, réponses) vont dans les paramètres de la scène, pas dans le code.

Le type `tri` du dépôt (`js/types/tri.js`) est un exemple complet : pièces à ranger dans des bacs, groupes de boutons radio natifs, message si une pièce n'est pas rangée, résultat = nombre de pièces bien rangées.

## 6. Ajouter une animation

Les animations sont listées dans `js/animations.js` (nom, classe CSS, durée de 600 ms au plus). En ajouter une :

1. une entrée dans le registre : `pluie: Object.freeze({ classe: 'anim-pluie', duree: 500 })` ;
2. une règle CSS de même classe dans `css/style.css`, avec `animation: anim-pluie 500ms …`, désactivée dans le bloc `@media (prefers-reduced-motion: reduce)`.

Sous `prefers-reduced-motion: reduce`, l'interface n'applique aucune animation : le jeu reste identique.

## 7. Tester

`node --test tests/` vérifie le moteur, le validateur, les profils (chaque fin atteignable, en explorant les `resultatsPossibles` de votre type) et joue des parties complètes dans un navigateur sans fenêtre. Pour qu'il reste vert avec votre type, voici les fichiers de test à compléter, et rien d'autre (ni `tests/partie.mjs` ni les autres tests) :

| Quand | Fichier | Quoi |
| --- | --- | --- |
| Toujours | `tests/joueurs/<type>.mjs` | Le joueur de test du type (7.1). |
| Toujours | `tests/joueurs/index.mjs` | Une ligne qui l'enregistre (7.2). |
| Si la scène est dans un profil initial (`restaurateur`, `influenceuse`, `plombier`, `consultant`, `coiffeuse`, `galeriste`) | `tests/suites-fins.mjs` | Le résultat de votre scène dans les suites de ce profil qui y passent (7.3). |
| Si le type est utilisé dans `data/` (recommandé) | un nouveau `tests/<type>.test.mjs` | Votre scène jouée au clavier et à la souris, et l'issue retenue pour plusieurs résultats (7.4). |

Un test vérifie que chaque type de `js/types/index.js` a son joueur dans `tests/joueurs/index.mjs` : sans lui, il échoue en nommant le type et le fichier à créer.

### 7.1 Le joueur de test

Les parties jouées dans le navigateur (`jouerPartie` de `tests/partie.mjs`) passent par une **suite** d'étapes : l'id du choix pour une scène `choix`, le résultat à produire pour une scène d'un autre type. Le joueur de votre type sait produire ce résultat dans la page, avec de vrais événements (clics, touches). Il exporte par défaut `{ type, jouer(page, scene, resultat) }` ; `page` offre `cliquer(selecteur)`, `toucher(selecteur)`, `touche(nom)`, `eval(expression)` et `attendre(condition, quoi)`. Il n'a pas à attendre l'encadré ni à vérifier l'issue : `jouerPartie` s'en charge.

Pour `essai-bouton`, créer `tests/joueurs/essai-bouton.mjs` :

```js
// tests/joueurs/essai-bouton.mjs
// Joueur de test du type essai-bouton : un clic sur le bouton produit le resultat 1.
export default {
  type: 'essai-bouton',

  async jouer(page, scene, resultat) {
    await page.cliquer('#scene-jeu [data-essai="bouton"]');
  },
};
```

Le joueur du tri (`tests/joueurs/tri.mjs`) est un exemple plus complet : il range les `resultat` premières pièces dans leur bac et les autres ailleurs.

### 7.2 L'enregistrer

Ajouter **une ligne** à `tests/joueurs/index.mjs` :

```js
export { default as essaiBouton } from './essai-bouton.mjs';
```

### 7.3 Les suites figées

`tests/suites-fins.mjs` fige, pour chaque profil initial, une suite d'étapes par fin. Si votre scène s'insère dans un de ces profils, insérez son résultat à sa place dans chaque suite qui passe par elle (par exemple `1` pour `essai-bouton`, juste après le dernier choix qui mène à la scène). Sinon le test « une suite explicite par fin » échoue en nommant la suite. Un profil que vous ajoutez n'a pas besoin de suites figées : l'exploration exhaustive les calcule.

### 7.4 Un test de votre scène

Pour un type utilisé dans `data/`, ajoutez `tests/<type>.test.mjs` qui joue votre scène dans le navigateur, au clavier et à la souris, et vérifie l'issue retenue pour plusieurs résultats. Modèle : `tests/types-navigateur.test.mjs`, qui le fait pour le tri.

### 7.5 Lancer

```bash
git add js/types tests data
node outils/valider.mjs
node --test tests/
```

Le `git add` compte : le test de construction (`tests/construire.test.mjs`) vérifie que `dist/` contient exactement les fichiers suivis par git de `index.html`, `css/`, `js/` et `data/`. Un nouveau fichier non ajouté le fait échouer.

Le dépôt rejoue cette section : le test « EX-051 bis » de `tests/types-navigateur.test.mjs` copie le site et ses tests, y ajoute `essai-bouton` exactement comme décrit ici (sections 3.1 à 3.3, 7.1 et 7.2), valide les données et joue une partie complète avec `jouerPartie`, sans modifier `js/moteur.js`, `js/interface.js` ni `tests/partie.mjs`.
