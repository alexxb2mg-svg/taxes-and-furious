# Contribuer à Taxes & Furious

Merci de votre intérêt. Toute contribution passe par une pull request vers `main`, relue par un mainteneur. Les tests (`.github/workflows/tests.yml`) doivent être verts avant la fusion.

En ouvrant une pull request, vous acceptez que votre contribution soit publiée sous les licences du dépôt : MIT pour le code ([LICENSE](LICENSE)), CC BY 4.0 pour le contenu ([LICENSE-CONTENU.md](LICENSE-CONTENU.md)).

## La règle juridique

La fiction est dans la mise en scène ; la loi est dans l'encadré « Ce que dit vraiment la loi » et doit être exacte.

- Toute affirmation juridique d'une explication cite un identifiant de `data/references.json`. Le validateur refuse un identifiant inconnu.
- Si la notion existe déjà dans `data/references.json`, on cite son identifiant et on n'écrit rien de plus que ce que disent son `article`, son `resume` et ses `valeur`.
- **Toute notion juridique nouvelle s'appuie sur un article lu dans le texte officiel** (code général des impôts, livre des procédures fiscales, code du travail...) **et est ajoutée à `data/references.json` dans la même pull request**. Indiquez dans la description de la pull request l'article, sa version en vigueur et où vous l'avez lu. Un mainteneur relit la référence sur le texte avant la fusion. On n'invente jamais une règle, un taux, un montant ou un délai.
- Les chiffres d'une explication (`%`, `pour cent`, `€`, `euros`, `EUR`, `jours`, `mois`, `ans`) s'écrivent en chiffres et doivent figurer dans les `valeur` des références citées par ce choix. Les montants des textes et réactions sont libres : c'est de la fiction.
- Une explication dit ce qui s'applique au cas joué. Elle ne commence pas par « Ce que dit vraiment la loi » (l'interface affiche déjà ce titre ; le validateur refuse) et ne recopie pas le résumé de l'article, affiché juste dessous : au-delà de 60 % de mots communs (mots de 4 lettres et plus, sans casse ni accents) avec le `resume` d'une référence citée, le validateur avertit, et la pull request doit en rester à 0 avertissement.

Une entrée de `data/references.json` ressemble à ceci (reprenez la forme des entrées existantes) :

```json
{
  "id": "R-L10",
  "source": "lpf",
  "article": "Article L. 10 du LPF",
  "version": "LOI n°2015-1785 du 29 décembre 2015 - art. 86",
  "valeur": [],
  "resume": "Les dispositions de la charte des droits et obligations du contribuable vérifié sont opposables à l'administration.",
  "statut": "verifie"
}
```

Si la référence change la date de vérification (`date_verification`) ou une édition de `sources`, mettez-les à jour dans la même pull request : le jeu affiche cette date.

## Le ton

- Comique de situation et travers du métier. Pas de mépris envers l'administration, ses agents ou un groupe de personnes. Tous publics : pas de vulgarité, pas d'alcool mis en scène de façon complaisante, pas de politique.
- Entreprises et personnages 100 % fictifs : aucune personne réelle, aucune entreprise réelle, aucun nom, adresse, numéro SIRET ou numéro de facture réel. Les clins d'œil à des films, livres ou types d'affaires sont bienvenus ; les noms de personnages de films et les répliques citées mot pour mot ne le sont pas.
- Portraits : soit un SVG dessiné dans le dépôt (formes simples), soit une illustration WebP qui respecte la direction artistique (section 9.1 de `docs/spec/SPEC.md`) ; jamais une image téléchargée, jamais le visage d'une personne réelle. Un portrait WebP garde son SVG de même nom comme repli.

## Illustrations : décors et portraits (`outils/preparer-images.py`)

Les décors et portraits illustrés sont des fichiers WebP rangés dans les données :

- un décor : `data/communs/decors/<nom>.webp` (tronc, écran titre) ou `data/profils/<id>/decors/<nom>.webp` (profil), 16:9, de 1280 à 1600 px de large, 250 Ko au plus ;
- un portrait : `data/profils/<id>/img/<perso>.webp` ou `data/communs/img/<perso>.webp`, carré de 512 px, fond transparent, 80 Ko au plus ; à côté, le SVG de même nom sert de repli ;
- au total, 6 Mo au plus pour tous les `data/**/*.webp`.

Où le décor s'affiche (le validateur vérifie que le fichier existe, qu'il est en `.webp` et que le chapitre existe) :

```json
// data/communs/decors.json : décors par défaut des chapitres du tronc, et de l'écran titre
{ "chapitres": { "avis": "decors/bureau-verificateur.webp" }, "titre": "decors/couverture.webp" }

// data/profils/<id>/profil.json : décor d'un chapitre du profil ou du tronc, pour ce profil
"decors": { "ouverture": "decors/salle.webp", "fec": "decors/cuisine.webp" }

// une scène peut surcharger le décor de son chapitre (exception justifiée)
{ "id": "...", "decor": "decors/cuisine.webp", ... }
```

Ordre : décor de la scène, puis du chapitre dans le profil, puis décor par défaut du tronc, puis aucun (fond uni). Les chemins sont relatifs au dossier du fichier qui les déclare (`data/communs/` pour le tronc, `data/profils/<id>/` pour un profil).

Les images se préparent avec `outils/preparer-images.py`. C'est un outil local : il demande Python 3 et Pillow, qui n'est **pas** une dépendance du jeu (le jeu reste statique, sans dépendance). Installation vérifiée par empreintes, une fois :

```bash
python -m pip install --require-hashes -r outils/preparer-images.requirements.txt
```

Puis :

```bash
# Décor : recadrage 16:9 au centre, largeur 1280 à 1600 px (1600 par défaut), WebP sous 250 Ko
python outils/preparer-images.py decor source.png data/profils/<id>/decors/salle.webp --largeur 1600

# Portrait : détourage du fond blanc depuis les 4 coins (les blancs entourés par le personnage,
# yeux ou col, restent opaques), personnage centré dans un carré transparent de 512 px, WebP sous 80 Ko
python outils/preparer-images.py portrait fiche.png data/profils/<id>/img/<perso>.webp

# Contrôle des poids et dimensions de tous les .webp de data/ (code 1 au moindre écart)
python outils/preparer-images.py verifier
```

Le portrait source doit avoir un fond blanc uni qui touche les coins ; `--tolerance` (24 par défaut) règle l'écart au blanc pur accepté pour le fond, `--marge` la marge transparente autour du personnage. Regardez toujours le résultat sur un fond coloré avant de le garder : une image hors charte est rejetée, pas retouchée à la main. `node outils/valider.mjs` refait les mêmes contrôles de poids et de dimensions.

## Ajouter un profil

Un profil est un dossier de données sous `data/profils/<id>/` : aucune modification de `js/`, `css/` ni `index.html`. Le guide pas à pas, avec un exemple complet : [docs/CREER_UN_PROFIL.md](docs/CREER_UN_PROFIL.md).

En bref : copier `data/profils/_modele/`, renommer, remplir `profil.json` (et éventuellement `variantes.json`), valider avec `node outils/valider.mjs --profil <id>`, ajouter l'id à `data/profils/index.json`, puis `node outils/valider.mjs` et `node --test tests/`. Les tests vérifient que chaque fin du profil est atteignable et la jouent dans le navigateur sans fenêtre.

Ajoutez à la pull request les captures du profil (`node outils/captures.mjs --donnees data --profil <id>`).

### Profondeur d'un profil : `--exigences-lot4`

`node outils/valider.mjs --exigences-lot4` (combinable avec `--profil <id>`) ajoute les règles de profondeur d'un profil :

- le parcours commence par le chapitre d'ouverture du profil (`"profil:<id>"`), de 1 ou 2 scènes, avant le tronc ;
- `variantes.json` réécrit chaque scène du tronc (`texte`) et donne une `reaction` propre au profil pour chaque choix du tronc ;
- chaque scène à choix (profil et tronc) a 3 ou 4 choix, au moins un mauvais réflexe (`"juste": false`), et deux choix d'une même scène n'ont jamais exactement les mêmes effets ;
- au moins 2 chapitres propres en plus de l'ouverture, au moins 3 fins propres, et de 16 à 24 scènes sur l'ensemble du parcours (tronc compris).

Ces règles ne sont pas encore exigées par les tests automatiques : les profils existants y passent un par un. Un nouveau profil les respecte dès le départ.

## Ajouter un type de scène (mini-jeu, nouvelle mécanique)

Un type de scène s'ajoute dans son propre fichier `js/types/<type>.js`, enregistré par une ligne dans `js/types/index.js`, sans toucher à `js/moteur.js` ni à `js/interface.js` ; côté tests, un joueur de test `tests/joueurs/<type>.mjs` enregistré par une ligne dans `tests/joueurs/index.mjs`. Le jeu en contient deux : `choix` (les choix multiples) et `tri` (« Le tri des justificatifs »). Le guide pas à pas, avec un exemple complet : [docs/AJOUTER_UN_TYPE_DE_SCENE.md](docs/AJOUTER_UN_TYPE_DE_SCENE.md) ; la place de chaque module : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Pour une mécanique importante, ouvrez d'abord une issue qui décrit la mécanique, le résultat qu'elle produit et la façon d'y jouer au clavier, à la souris et au toucher. Règles :

- le moteur (`js/moteur.js`) reste pur et déterministe : aucun hasard, aucune horloge, aucun accès au DOM ni au réseau ;
- jouable au clavier, à la souris et au toucher, sans minuterie, à 375 px de large sans défilement horizontal ;
- aucune dépendance tierce, aucun style ni script en ligne (le site est servi avec une politique de sécurité du contenu stricte, voir `outils/construire.mjs`).

## Modifier le code

- Le jeu est statique et sans dépendance : pas de npm, pas de CDN, pas de police distante, aucune requête hors de l'origine du site.
- Le contenu (textes de scènes, noms de personnages) reste dans `data/`, jamais dans `js/`.
- Chaque exigence de `docs/spec/SPEC.md` porte un numéro `EX-xxx` cité dans le code et les tests ; une pull request qui change un comportement met à jour les tests correspondants.
- Un test qui a besoin du navigateur échoue s'il ne le trouve pas : on ne saute jamais un test.

## Avant d'ouvrir la pull request

Depuis la racine du dépôt :

```bash
node outils/valider.mjs
node outils/verifier-termes.mjs
node --test tests/
node outils/construire.mjs
```

Les quatre commandes doivent réussir, avec `fail 0` et `skipped 0` pour les tests. `outils/verifier-termes.mjs` cherche des termes interdits listés dans un fichier local que seuls les mainteneurs ont ; sans ce fichier, il le signale et réussit.

Le modèle de description de pull request (`.github/pull_request_template.md`) reprend ces vérifications.
