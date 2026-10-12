# Créer un profil

Un profil = un dossier de données sous `data/profils/<id>/`. Ajouter, modifier ou désactiver un profil ne demande **aucune modification** de `js/`, `css/` ni `index.html` (EX-051). Format complet : section 4 de [la spécification](spec/SPEC.md).

Ce guide s'adresse aux contributeurs : il mène d'un dossier vide à une pull request prête à être relue. Il suit un exemple complet : le profil `boulanger` (« Le boulanger », entreprise « Au Pain Perdu », vérificateur M. Gaston Levain).

Les commandes sont écrites pour un terminal POSIX (Linux, macOS, ou Git Bash sous Windows), lancées depuis la racine de votre copie du dépôt (fork). Sans terminal, les mêmes opérations se font par copier, renommer et éditer dans l'explorateur de fichiers.

## Avant de commencer : la loi s'appuie sur le texte officiel

Toute affirmation juridique d'une explication cite un identifiant de `data/references.json` (EX-002). Le validateur refuse un identifiant inconnu.

- La notion existe déjà dans `data/references.json` : on cite son identifiant, et on n'écrit rien de plus que ce que disent son `article` et son `resume`.
- La notion est nouvelle (y compris pour un nouveau profil) : on lit l'article dans le texte officiel (code général des impôts, livre des procédures fiscales, code du travail...), on l'**ajoute à `data/references.json` dans la même pull request**, et on indique dans la description de la pull request l'article, sa version en vigueur et où il a été lu. Un mainteneur relit la référence sur le texte avant la fusion (voir [CONTRIBUTING.md](../CONTRIBUTING.md)). On n'invente jamais une règle, un taux ou un délai.

Les chiffres d'une explication (`%`, `pour cent`, `€`, `euros`, `EUR`, `jours`, `mois`, `ans`) s'écrivent en chiffres et doivent figurer dans les `valeur` des références citées par ce choix (EX-003). Les montants des `texte` et `reaction` sont libres (c'est de la fiction).

L'exemple n'utilise que des références existantes : R-286, R-1770DUO (caisse), R-278-0B-A1 et R-278 (TVA à 5,5 % et 20 %).

## 1. Copier le modèle

```bash
cp -r data/profils/_modele data/profils/boulanger
```

`_modele` est un profil minimal valide : 1 chapitre, 2 scènes, 2 fins, un portrait, textes « A remplacer ». Il n'est pas dans `profils/index.json`, le jeu ne l'affiche donc pas.

## 2. Renommer

L'id du profil = le nom du dossier = le champ `id` de `profil.json` (minuscules, chiffres, tirets).

```bash
mv data/profils/boulanger/img/verificateur.svg data/profils/boulanger/img/levain.svg
sed -i 's/A remplacer : nom du vérificateur/M. Gaston Levain/g' data/profils/boulanger/img/levain.svg
```

Le portrait SVG doit porter `role="img"` et un `aria-label` **exactement égal** au `nom` du personnage (EX-034) : le validateur le vérifie. Le `<title>` du SVG reprend le même nom. Dessinez ensuite votre caricature dans le SVG (formes simples, aucune image téléchargée, aucun visage d'une personne réelle).

## 3. Remplir `profil.json`

Champs (section 4 de la spec) :

| Champ | Contenu |
|---|---|
| `id` | identique au nom du dossier |
| `actif` | `true` pour afficher le profil, `false` pour le désactiver sans le supprimer |
| `nom`, `entreprise`, `accroche` | affichés sur la carte de l'écran de choix ; entreprise 100 % fictive |
| `inspiration` | texte libre, non affiché (film, livre, type d'affaire ; aucune personne réelle) |
| `jauges_initiales` | facultatif : `patience` et `stress` de départ (0 à 100) ; défaut du tronc : 70 et 30 |
| `personnages` | au moins un personnage de rôle `verificateur`, avec portrait ; les autres ont le rôle `second`. Les rôles `comptable` et `joueur` sont facultatifs : sinon le jeu utilise « Votre expert-comptable » et « Vous » de `data/communs/` |
| `parcours` | ordre des chapitres : les 3 chapitres du tronc (`tronc:avis`, `tronc:fec`, `tronc:rectification`) une fois chacun, dans cet ordre ; les chapitres du profil (`profil:<id>`) s'intercalent librement, une fois au plus |
| `references_obligatoires` | références que les chapitres du profil doivent toutes citer (le validateur vérifie la couverture) |
| `chapitres` | 1 à 3 chapitres propres, 2 à 6 scènes chacun (1 ou 2 pour un chapitre d'ouverture placé en tête du parcours) ; la scène d'entrée est la première du tableau `scenes` |
| `fins` | au moins 2 fins propres, évaluées dans l'ordre, avant les fins communes |

Une scène : `id` unique, `personnage` (id d'un personnage du profil, ou `narrateur` : encadré sans portrait), `texte`, et 2 à 4 `choix`. Un choix : `id` unique, `texte`, `juste` (au moins un `true` par scène), `effets` (deltas entiers sur `redressement`, `patience`, `stress`), `reaction`, `explication` (ce qui s'applique au cas joué, sans le titre « Ce que dit vraiment la loi », que l'interface affiche déjà en tête de l'encadré, et sans recopier le résumé de l'article cité, affiché juste dessous ; le validateur avertit au-delà de 60 % de mots communs avec ce résumé), `references` (identifiants de `data/references.json`), `suivant` (id d'une scène du même chapitre, ou `null` pour finir le chapitre ; aucun cycle, aucune scène inatteignable).

Une fin : `id`, `titre`, `texte`, `conditions` (`jauge`, `op` parmi `<`, `<=`, `>`, `>=`, `==`, `valeur`) ; toutes les conditions doivent être vraies. Si aucune fin du profil n'est satisfaite, le jeu passe aux fins communes (`fin-sereine`, puis `fin-defaut`, toujours vraie). Si la patience tombe à 0, la partie s'arrête sur `fin-patience`.

Exemple complet, `data/profils/boulanger/profil.json` :

```json
{
  "id": "boulanger",
  "actif": true,
  "nom": "Le boulanger",
  "entreprise": "Au Pain Perdu",
  "accroche": "Une caisse qui sent bon le pain chaud, un bocal de bonbons sur le comptoir et un vérificateur qui arrive avant la première fournée.",
  "inspiration": "Exemple du guide docs/CREER_UN_PROFIL.md : la boulangerie de quartier.",
  "jauges_initiales": { "patience": 70, "stress": 30 },
  "personnages": [
    {
      "id": "levain",
      "role": "verificateur",
      "nom": "M. Gaston Levain",
      "description": "Vérificateur matinal, farine sur la manche, ne croit qu'aux tickets de caisse.",
      "portrait": "img/levain.svg"
    }
  ],
  "parcours": ["tronc:avis", "profil:fournil", "tronc:fec", "tronc:rectification"],
  "references_obligatoires": ["R-286", "R-1770DUO", "R-278-0B-A1", "R-278"],
  "chapitres": [
    {
      "id": "fournil",
      "titre": "Le fournil",
      "scenes": [
        {
          "id": "fournil-s1",
          "personnage": "levain",
          "texte": "M. Gaston Levain pose sa sacoche à côté des baguettes : « Votre caisse enregistre les ventes sans facture. Vous avez de quoi prouver qu'elle est sécurisée ? »",
          "choix": [
            {
              "id": "fournil-s1-a",
              "texte": "Sortir l'attestation de l'éditeur du logiciel de caisse.",
              "juste": true,
              "effets": { "redressement": 0, "patience": 10, "stress": -10 },
              "reaction": "« Parfait. Et elle sent même le croissant. »",
              "explication": "C'est la bonne pièce : pour des baguettes payées sans facture, l'attestation de l'éditeur prouve que la caisse ne peut ni effacer ni retoucher une vente.",
              "references": ["R-286"],
              "suivant": "fournil-s2"
            },
            {
              "id": "fournil-s1-b",
              "texte": "Expliquer que la caisse est « artisanale », comme le pain.",
              "juste": false,
              "effets": { "redressement": 7500, "patience": -15, "stress": 15 },
              "reaction": "M. Levain note quelque chose. Le mot « artisanale » est souligné deux fois.",
              "explication": "« Artisanale » ne remplace pas une preuve : faute de pouvoir la montrer, le boulanger paie 7 500 € et dispose de 60 jours pour régulariser.",
              "references": ["R-1770DUO"],
              "suivant": "fournil-s2"
            }
          ]
        },
        {
          "id": "fournil-s2",
          "personnage": "narrateur",
          "texte": "Sur le comptoir, un bocal de bonbons attire le regard du vérificateur. Il demande à quel taux de TVA vous les vendez.",
          "choix": [
            {
              "id": "fournil-s2-a",
              "texte": "Au taux normal : les confiseries ne profitent pas du taux réduit.",
              "juste": true,
              "effets": { "redressement": 0, "patience": 5, "stress": -5 },
              "reaction": "M. Levain hoche la tête et repose le bocal, sans se servir.",
              "explication": "Exact : le pain profite du taux réduit de 5,5 %, mais les bonbons du bocal restent au taux normal de 20 %.",
              "references": ["R-278-0B-A1", "R-278"],
              "suivant": null
            },
            {
              "id": "fournil-s2-b",
              "texte": "À 5,5 % : le sucre, c'est de la nourriture.",
              "juste": false,
              "effets": { "redressement": 3000, "patience": -10, "stress": 10 },
              "reaction": "M. Levain sort sa calculatrice. Elle aussi semble déçue.",
              "explication": "Le sucre ne suffit pas : à côté du pain à 5,5 %, les bonbons du bocal restent au taux normal de 20 %.",
              "references": ["R-278-0B-A1", "R-278"],
              "suivant": null
            }
          ]
        }
      ]
    }
  ],
  "fins": [
    {
      "id": "boulanger-fin-doree",
      "titre": "Croûte dorée",
      "texte": "Comptes nets, caisse en règle : M. Levain repart avec une baguette, payée, ticket compris.",
      "conditions": [
        { "jauge": "redressement", "op": "<=", "valeur": 3000 },
        { "jauge": "stress", "op": "<=", "valeur": 25 }
      ]
    },
    {
      "id": "boulanger-fin-brulee",
      "titre": "Fournée brûlée",
      "texte": "Entre la caisse artisanale et les bonbons à taux réduit, l'addition a bien levé. Le four, lui, n'a rien vu.",
      "conditions": [{ "jauge": "redressement", "op": ">=", "valeur": 10000 }]
    }
  ]
}
```

### Facultatif : `variantes.json`, le tronc à la sauce du métier

`data/profils/<id>/variantes.json` réécrit des textes du tronc commun pour ce profil. Seuls `texte` (de la scène ou d'un choix) et `reaction` sont surchargeables ; effets, `juste`, explication et références restent ceux du tronc : la loi ne change pas selon le métier. Une variante ne peut viser qu'une scène ou un choix existant de `data/tronc.json`. Sans ce fichier, le profil joue les textes du tronc tels quels.

Exemple, `data/profils/boulanger/variantes.json` :

```json
{
  "avis-s1": {
    "texte": "Cinq heures du matin, entre deux fournées : le facteur dépose une lettre recommandée sur le pétrin. Avis de vérification de comptabilité.",
    "choix": {
      "avis-s1-b": {
        "texte": "La glisser sous le sac de farine.",
        "reaction": "Le sac se renverse. L'avis réapparaît, poudré de blanc, bien en évidence."
      }
    }
  }
}
```

## 4. Valider

D'abord le profil seul, avant de l'ajouter à l'index :

```bash
node outils/valider.mjs --profil boulanger
```

Résultat attendu :

```
OK : donnees valides (data, profil "boulanger") ; profils verifies : boulanger ; 0 avertissement(s)
```

`--profil` valide un seul profil, même absent de l'index, **y compris la couverture du profil** (`references_obligatoires` toutes citées, 1 à 3 chapitres, 2 à 6 scènes). Il **saute en revanche la couverture du tronc** (les références du tronc commun citées par ses chapitres) et la cohérence de `profils/index.json` : la validation complète de l'étape 5 reste obligatoire.

Chaque erreur est un message en français qui nomme le fichier, la scène ou le choix, et le champ. Exemples, avec un `suivant` mal tapé, une référence inconnue et un nom de personnage changé sans mettre à jour le portrait :

```
profils/boulanger/profil.json : scene "fournil-s1", champ "suivant" : scene "fournil-s9" introuvable dans le chapitre "fournil" (choix "fournil-s1-a")
profils/boulanger/profil.json : scene "fournil-s2", choix "fournil-s2-a", champ "references" : reference "R-999" inconnue de references.json
profils/boulanger/profil.json : personnage "levain", champ "portrait" : "profils/boulanger/img/levain.svg" : aria-label "M. Gaston Levain" different du nom (attendu "M. Gaston Levain-Brioche")
```

Une erreur en entraîne parfois d'autres (un `suivant` faux rend aussi la scène suivante inatteignable) : corrigez la première de la liste et relancez. La sortie se termine par `ECHEC : <n> erreur(s)` ; code de sortie : 0 si valide, 1 sinon.

## 5. Ajouter à l'index et revalider tout

Ajoutez l'id dans `data/profils/index.json`, à la place voulue sur l'écran de choix (l'ordre du tableau est l'ordre des cartes) :

```json
[
  "restaurateur",
  "influenceuse",
  "plombier",
  "consultant",
  "coiffeuse",
  "galeriste",
  "boulanger"
]
```

Puis :

```bash
node outils/valider.mjs
```

Résultat attendu : `OK : donnees valides (data) ; profils verifies : restaurateur, influenceuse, plombier, consultant, coiffeuse, galeriste, boulanger ; 0 avertissement(s)`. Un dossier présent mais absent de l'index donne un avertissement (le jeu l'ignore) ; un id de l'index sans dossier est une erreur.

## 6. Tester

Jouer à la main :

```bash
python lancer.py
```

puis ouvrir http://127.0.0.1:8796/ : la carte « Le boulanger » apparaît sur l'écran de choix ; jouez une partie jusqu'à une fin.

Tests automatiques (commande unique du README) :

```bash
node --test tests/
```

Ils valident `data/`, vérifient par exploration exhaustive que **chaque fin du nouveau profil est atteignable** (une fin jamais atteinte fait échouer `tests/profils.test.mjs`), puis jouent chaque fin du profil dans le navigateur sans fenêtre (`tests/interface-donnees.test.mjs`) : textes, portraits, jauges, encadré « Ce que dit vraiment la loi » et écran de fin comparés au moteur, 0 erreur console. Résultat attendu : `fail 0`, `skipped 0`.

Les 6 profils initiaux ont en plus des suites de choix figées par fin dans `tests/suites-fins.mjs` (EX-014). Pour un profil ajouté, c'est facultatif : sans suite figée, les tests trouvent eux-mêmes une partie par fin.

## 7. Ouvrir la pull request

1. Refaites les captures du profil (5 écrans, 1280x800 et 375x740, dans `docs/captures/`) :

```bash
node outils/captures.mjs --donnees data --profil boulanger
```

2. Vérifiez que les commandes de [CONTRIBUTING.md](../CONTRIBUTING.md) réussissent toutes (`node outils/valider.mjs`, `node outils/verifier-termes.mjs`, `node --test tests/`, `node outils/construire.mjs`).
3. Poussez votre branche sur votre fork et ouvrez une pull request vers `main`. Remplissez le modèle proposé : vérifications cochées, et tableau des sources juridiques si vous avez ajouté une référence.
4. Les tests tournent automatiquement sur la pull request. Un mainteneur relit le ton, la fiction et chaque explication juridique ; il peut demander des corrections avant la fusion.

## Modifier ou désactiver un profil

- Désactiver : `"actif": false` dans son `profil.json`. La carte disparaît, sans message d'erreur ; les données restent.
- Modifier : éditer `profil.json` ou `variantes.json`, puis refaire les étapes 4 à 6.
- Un profil invalide n'empêche pas les autres de se charger : l'écran de choix affiche « 1 profil indisponible » (EX-054). Le validateur dit pourquoi.
