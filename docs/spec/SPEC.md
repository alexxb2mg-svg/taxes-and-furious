# Taxes & Furious - specification v3.1

Titre du jeu : **Taxes & Furious** (choisi par le porteur le 12/10/2026, remplace le titre de travail "Fisc & Fiction"). Depot et projet Pages : `taxes-and-furious`. La cle `localStorage` `fiscfiction.meilleur` (EX-036) est conservee.

Jeu web humoristique : le joueur choisit un profil (un metier caricatural) et subit un controle fiscal. Scenario a choix multiples, jauges, score, plusieurs fins. Caricatures, ton decale, pour rigoler entre amis. Titre de travail, modifiable.

- La spec et `data/references.json` sont tenus par les mainteneurs ; une pull request de contenu ou de code ne les modifie pas, sauf ajout de reference justifie (voir CONTRIBUTING.md).
- Donnees juridiques : `data/references.json`, 30 references lues le 12/10/2026 dans les compilations codes.droit.org (CGI ed. 2026-09-28, derniere modification 2026-09-01 ; LPF ed. 2026-10-01 ; code du travail ed. 2026-10-08 ; SHA-256 des PDF dans le fichier).
- Version 3 (lot 3 : publication publique, architecture d'extensions, deploiement ; 12/10/2026). Versions 2.x : jeu de base, livre et fusionne. Toute modification ulterieure de la spec passe par une pull request.
- Decisions du porteur du projet (12/10/2026) : jeu fun et decale avec caricatures ; web sans IA, choix multiples, score ; tous les themes ; entreprises 100 % fictives ; le joueur choisit son profil en debut de partie ; profils inspires d'affaires reelles (sans nommer personne), de films ou de livres ; tronc commun + scenes et textes propres a chaque profil ; les profils doivent pouvoir etre enrichis, modifies et crees sans toucher au code. Les 6 profils de la section 2.2 sont acceptes par Alex ("ok").

## 1. Perimetre

Dans le perimetre :
- Un tronc commun de controle (avis, FEC, rectification) joue par tous les profils, avec des textes adaptes au profil.
- 6 profils initiaux, chacun avec ses personnages, ses chapitres metier et ses fins.
- Systeme de profils ouvert : un profil = un dossier de donnees ; en ajouter, modifier ou desactiver un ne demande aucune modification du code.
- Moteur deterministe, contenu en JSON, interface web statique, encadre "Ce que dit vraiment la loi" apres chaque choix.

Hors perimetre v2 :
- Editeur de profils dans le navigateur (lot ulterieur possible ; la v2 prepare le terrain avec un format documente, un modele et un validateur).
- IA, appel reseau a l'execution, comptes, classement en ligne, publication sur Internet.
- Toute donnee d'une entreprise ou d'un client reel, toute personne reelle nommee (ni contribuable, ni agent, ni celebrite).
- Conseil fiscal (EX-004). Son, musique.

## 2. Profils

### 2.1 Regles communes
- Un profil = un metier caricatural, une entreprise fictive, un verificateur et des seconds roles qui lui sont propres.
- Inspirations autorisees : films, livres, types d'affaires connues. Clin d'oeil oui, plagiat non : pas de nom de personnage de film, pas de replique citee mot pour mot, pas de personne reelle. Les noms ci-dessous sont provisoires et modifiables dans les donnees.
- Ton : comique de situation et travers du metier ; pas de mepris envers l'administration, ses agents ou un groupe de personnes ; tous publics (pas de vulgarite, pas d'alcool mis en scene de facon complaisante, pas de politique).
- La fiction est dans la mise en scene ; la loi est dans l'encadre et doit etre exacte.

### 2.2 Les 6 profils initiaux

| id | Profil | Ce qui coince | Verificateur et seconds roles (noms provisoires) | Inspiration | References obligatoires |
|---|---|---|---|---|---|
| `restaurateur` | Le restaurateur de "La Casserole Distraite" | caisse "magique" qui efface les tickets, especes, TVA 10 % sur place et a emporter immediat, 5,5 % sur les denrees, 20 % sur l'alcool, belle-soeur a la caisse non declaree | Mme Paulette Addition, inspectrice qui commande le menu du jour pour verifier les tickets ; le chef saucier ; la belle-soeur | film "Le Grand Restaurant" ; affaires de logiciels de caisse permissifs | R-279-MN, R-278-0B-A1, R-278, R-286, R-1770DUO, R-L8221-5 |
| `influenceuse` | L'influenceuse "@CindyFiltre" | cadeaux de marques et partenariats non declares, voyages "pro", residence a Dubai qui ne convainc personne | M. Jean-Marc Story, controleur qui la suit sur les reseaux depuis deux ans ; le manager ; le chihuahua en note de frais (gag sans explication juridique : les explications de ce profil ne disent que ce que portent R-92, R-L169 et R-1729, sans affirmer de regime fiscal propre aux influenceurs) | affaires d'influenceurs installes a l'etranger, sans nom | R-92, R-L169, R-1729 |
| `plombier` | Le plombier de "Fuite & Fils" | TVA 20 / 10 / 5,5 %, certification du client sur le devis, sous-traitance (autoliquidation), Kevin auto-entrepreneur depuis mardi, Tonton qui aide le samedi | M. Bernard Rectif, verificateur qui a une fuite chez lui et voudrait un devis ; Kevin ; Tonton Robert ; Belle-maman et sa salle de bain | situations de chantier | R-278, R-279-0B, R-279-0B-3, R-278-0BA, R-283-2N, R-L8221-1, R-L8221-5, R-L8221-6 |
| `consultant` | Le consultant en "disruption agile" | voiture de sport au plafond d'amortissement, salaire de gerant demesure, restaurants "clients" tous les midis | M. Claude Tableur, verificateur qui ne comprend aucun anglicisme ; l'expert-comptable qui demissionne en direct | film "Le Loup de Wall Street", version province | R-39-1, R-39-4, R-1729 |
| `coiffeuse` | La coiffeuse du salon "Au Bigoudi d'Or" | especes, caisse, fauteuils loues a de "fausses independantes", shampoings pour toute la famille | Mme Brigitte Frange, controleuse venue "juste pour une frange" ; les clientes qui commentent tout | film "Venus Beaute (Institut)" | R-286, R-1770DUO, R-L8221-6, R-L8221-5, R-39-1 |
| `galeriste` | Le galeriste parisien | tableaux qui disparaissent quand le controleur sonne, oeuvre "exposee au public" dans sa chambre, maison de campagne passee en charges | M. Lucien Poney, controleur fan de foot qui reconnait un faux a 30 metres | film "Le Diner de cons" (la scene du controleur fiscal) | R-238BAB, R-39-4, R-1729 |

Tronc commun, joue par tous : references R-L47, R-L10, R-L52, R-L169, R-L176, R-L47A, R-1729D, R-L57, R-L11, R-L59, R-1651, R-1727, R-1729, R-L62.

## 3. Mecanique de jeu

- Ecrans : titre -> choix du profil -> partie -> fin.
- Trois jauges, affichees en permanence :
  - `redressement` : montant cumule en euros (entier, >= 0), part de 0.
  - `patience` : patience du verificateur, entier 0..100, part de 70 (un profil peut changer la valeur de depart).
  - `stress` : stress du joueur, entier 0..100, part de 30 (idem).
- Chaque scene propose 2 a 4 choix. Chaque choix applique ses effets (deltas bornes), affiche la reaction du personnage puis l'explication.
- Chaque choix porte `juste` (bon reflexe au regard de la loi). Au moins un choix `juste` par scene.
- Parcours d'un profil : liste ordonnee de chapitres, du tronc (`tronc:<id>`) et du profil (`profil:<id>`). Chaque chapitre du tronc y figure une fois, dans l'ordre du tableau `chapitres` de `tronc.json` (pour `data/` : avis, fec, rectification ; les donnees de test peuvent avoir d'autres ids) ; les chapitres du profil s'intercalent librement ; chaque chapitre du profil figure au plus une fois.
- Scene d'entree d'un chapitre : la premiere du tableau `scenes`. Depuis elle, tout chemin de `suivant` aboutit a `null` (pas de cycle).
- Fin anticipee : des que `patience` atteint 0, la partie s'arrete et la fin retenue est toujours la fin commune d'id `fin-patience`, sans evaluer les autres fins ; l'etat porte `anticipee: true` (sinon `false`).
- Fin normale : apres la derniere scene du parcours, fins evaluees dans l'ordre : fins du profil, puis fins communes hors `fin-patience` ; la premiere dont toutes les conditions sont vraies est retenue ; la derniere fin commune est sans condition, donc une fin est toujours trouvee. Au moins 2 fins propres par profil.
- Score final : redressement total, bons reflexes / scenes jouees, titre de la fin.
- Aucun hasard : memes profil et choix = meme resultat.

## 4. Format des donnees

```
data/
  references.json              tenu par les mainteneurs
  tronc.json                   chapitres communs + fins communes
  profils/index.json           ["restaurateur", "influenceuse", ...]  ordre de l'ecran de choix
  profils/<id>/profil.json     fiche, personnages, parcours, chapitres metier, fins
  profils/<id>/variantes.json  textes du tronc reecrits pour ce profil (facultatif)
  profils/<id>/img/*.svg       portraits
  profils/_modele/             modele a copier, absent de index.json
  communs/personnages.json     personnages generiques comptable et joueur
  communs/img/*.svg            leurs portraits
```

`tronc.json` :
```json
{ "titre": "Taxes & Furious",
  "references_obligatoires": ["R-L47", "..."],
  "jauges_initiales": { "redressement": 0, "patience": 70, "stress": 30 },
  "chapitres": [ { "id": "avis", "titre": "L'avis de verification", "scenes": [ SCENE ] } ],
  "fins": [ FIN ] }
```
SCENE :
```json
{ "id": "avis-s1", "personnage": "verificateur", "texte": "...",
  "choix": [ { "id": "avis-s1-a", "texte": "...", "juste": true,
    "effets": { "redressement": 0, "patience": 5, "stress": -10 },
    "reaction": "...", "explication": "Ce que dit vraiment la loi : ...",
    "references": ["R-L47"], "suivant": "avis-s2" } ] }
```
`suivant` = id d'une scene du meme chapitre ou `null` (fin du chapitre). Dans le tronc, `personnage` est un role : `verificateur`, `comptable`, `joueur`, `narrateur`.
FIN : `{ "id": "...", "titre": "...", "texte": "...", "conditions": [ { "jauge": "patience", "op": "<=", "valeur": 0 } ] }`, operateurs `<`, `<=`, `>`, `>=`, `==`.

`profil.json` :
```json
{ "id": "plombier", "actif": true, "nom": "Le plombier", "entreprise": "Fuite & Fils",
  "accroche": "phrase de l'ecran de choix", "inspiration": "texte libre, non affiche",
  "jauges_initiales": { "patience": 60 },
  "personnages": [ { "id": "rectif", "role": "verificateur", "nom": "M. Bernard Rectif",
                     "description": "...", "portrait": "img/rectif.svg" } ],
  "parcours": ["tronc:avis", "profil:tva", "tronc:fec", "profil:kevin", "tronc:rectification"],
  "references_obligatoires": ["R-278", "..."],
  "chapitres": [ CHAPITRE ], "fins": [ FIN ] }
```
Roles du tronc : `verificateur` est obligatoirement porte par un personnage du profil (avec portrait). `comptable` et `joueur` sont facultatifs : s'ils ne sont portes par aucun personnage du profil, le moteur utilise le personnage generique de `data/communs/personnages.json` (`comptable` = "Votre expert-comptable", `joueur` = "Vous", portraits `data/communs/img/comptable.svg` et `joueur.svg`). `narrateur` n'a pas de portrait : l'interface l'affiche en encadre narratif. Dans les chapitres du profil, `personnage` est un id de personnage du profil ou `narrateur`.

`variantes.json` : `{ "<id scene du tronc>": { "texte": "...", "choix": { "<id choix>": { "texte": "...", "reaction": "..." } } } }`. Seuls `texte` et `reaction` sont surchargeables ; effets, `juste`, explication et references restent ceux du tronc (la loi ne change pas selon le metier).

## 5. Exigences

### Donnees et contenu

**EX-001 - Fiction uniquement.** Aucun nom, adresse, SIRET, numero de facture ou montant tire d'une entreprise ou d'un client reel ; aucune personne reelle nommee.
*Verification* : `node outils/verifier-termes.mjs` (EX-101) sort 0 ; temoins dans EX-101. Noms de personnages et d'entreprises : recherche web de chaque nom complet a la relecture, aucun ne designe une personne ou une entreprise connue.

**EX-002 - References juridiques tenues par les mainteneurs.** Toute affirmation juridique cite un identifiant de `data/references.json`. Une notion juridique nouvelle (y compris pour un nouveau profil) s'appuie sur l'article lu dans le texte officiel ; la reference est ajoutee dans la meme pull request et relue par un mainteneur.
*Verification* : le validateur echoue sur un identifiant inconnu ; toute pull request qui modifie `data/references.json` cite la source officielle de chaque ajout.

**EX-003 - Chiffres exacts.** Le validateur extrait de chaque `explication` les nombres en chiffres (virgule decimale et espace de milliers acceptes) suivis de `%`, `pour cent`, `€`, `euros`, `EUR`, `jours`, `mois` ou `ans`, normalises en `<nombre> <unite>` (`10%` = `10 pour cent` = `10 %`, `7500 €` = `7 500 euros` = `7 500 EUR` = `7 500 €`, espace insecable = espace, casse ignoree), et verifie qu'ils figurent dans les `valeur` des references citees par ce choix. Les chiffres d'une explication s'ecrivent en chiffres : le validateur rejette un nombre en lettres (un a dix, douze, quinze, vingt, trente, quarante, cinquante, soixante, cent, mille) suivi d'une de ces unites. Montants fictifs libres dans `texte` et `reaction`.
*Verification* : temoins : "TVA a 7 %" citant R-279-0B echoue ; "0,20 % par mois" citant R-1727 passe ; "0,2 %" citant R-1727 echoue ; "amende de 50 000 €" et "amende de 50 000 euros" citant R-1729D echouent ; "amende de 5 000 euros" citant R-1729D passe ; "10 pour cent" citant R-278 echoue ; "trois mois" echoue.

**EX-004 - Avertissement.** Ecran titre et ecran de fin : "Jeu humoristique. Ce n'est pas un conseil fiscal. Textes verifies au <date_verification de references.json au format JJ/MM/AAAA>." (ex. 12/10/2026)
*Verification* : test d'interface qui lit le texte dans le DOM des deux ecrans, date comprise.

**EX-005 - Couverture.** `references_obligatoires` de `tronc.json` est egal a la liste "Tronc commun" de la section 2.2, et les chapitres du tronc les citent toutes. Chaque profil cite toutes ses `references_obligatoires` dans ses propres chapitres (les variantes ne portent pas de references). Pour les 6 profils initiaux, `references_obligatoires` est egal a la colonne de la section 2.2. Tronc : 3 chapitres, 3 a 6 scenes chacun. Profil : 1 a 3 chapitres propres, 2 a 6 scenes chacun.
*Verification* : validateur (manques listes par profil) ; la relecture compare les 6 listes au tableau.

**EX-006 - Ton.** Regles de la section 2.1.
*Verification* : relecture de tous les textes, liste des scenes relues par profil.

**EX-007 - Affichage de la source.** L'encadre "Ce que dit vraiment la loi" affiche, pour chaque reference citee, `article` et `resume` lus dans `references.json` au chargement.
*Verification* : test d'interface comparant le texte affiche au JSON pour une scene.

### Moteur

**EX-010 - Moteur pur.** `js/moteur.js`, module ES sans DOM, `window`, reseau ni stockage. Expose au minimum `assembler(tronc, profil, variantes)` (renvoie le scenario complet du profil : parcours deroule, variantes appliquees, roles resolus en personnages), `nouvellePartie(scenarioAssemble)`, `choisir(etat, idChoix)` (nouvel etat, ancien intact), `estTerminee(etat)`, `fin(etat, scenarioAssemble)`.
*Verification* : `node --test tests/` ; `grep -n -E "document|window|fetch|localStorage" js/moteur.js` vide.

**EX-011 - Jauges bornees** (0..100, redressement >= 0) pour toute sequence de choix.
*Verification* : test exhaustif sur le scenario de demonstration + scenario aux deltas extremes (+/-1000).

**EX-012 - Fin anticipee** a patience 0, meme au milieu d'un chapitre : fin `fin-patience`, `anticipee: true`, meme si une fin de profil serait satisfaite.
*Verification* : test unitaire avec un choix `patience: -100, redressement: +1000000` en premiere scene et une fin de profil `redressement >= 1` : fin retenue = `fin-patience`.

**EX-013 - Determinisme.**
*Verification* : deux parties identiques, `deepStrictEqual` des etats finaux.

**EX-014 - Fins ordonnees** (profil puis communes, premiere satisfaite).
*Verification* : pour chaque profil initial, un test atteint chacune de ses fins par une suite de choix explicite.

### Profils extensibles

**EX-050 - Choix du profil.** Apres l'ecran titre, un ecran liste les profils de `profils/index.json` dont `actif` vaut vrai, dans cet ordre : portrait, nom, entreprise, accroche.
*Verification* : test d'interface : 6 cartes de profil dans l'ordre de `index.json` ; un profil passe a `actif: false` dans une copie de test disparait.

**EX-051 - Ajouter un profil sans code.** Ajouter un profil = copier `profils/_modele/` sous un nouvel id, le remplir, ajouter l'id a `index.json`. Aucune modification de `js/`, `css/`, `index.html`.
*Verification* : test automatise qui, dans une copie temporaire du site, cree un profil `essai-ajout` a partir du modele, l'ajoute a l'index, passe le validateur, le joue jusqu'a une fin dans le navigateur headless, et verifie que `js/`, `css/`, `index.html` de la copie sont identiques a l'original (hash).

**EX-052 - Modifier et enrichir.** Un profil peut changer ses jauges de depart, ajouter personnages, chapitres et fins, reecrire les textes du tronc via `variantes.json`, etre desactive. Une variante ne peut viser qu'une scene ou un choix existant du tronc.
*Verification* : temoins negatifs du validateur : variante vers une scene inconnue, variante qui tente de surcharger `effets` ou `explication`, role `verificateur` non porte par un personnage du profil, parcours sans un chapitre du tronc.

**EX-053 - Modele et guide.** `data/profils/_modele/` est un profil minimal valide (1 chapitre, 2 scenes, 2 fins, textes "A remplacer"). `docs/CREER_UN_PROFIL.md` explique pas a pas : copier, renommer, remplir, valider, tester, avec un exemple. Les messages du validateur sont en francais et nomment fichier, id et champ fautifs.
*Verification* : `node outils/valider.mjs --profil _modele` passe ; un temoin d'erreur montre un message du type `profils/x/profil.json : scene "x-s2", champ "suivant" : scene "x-s9" introuvable`.

**EX-054 - Profil defaillant isole.** Si un profil de l'index ne se charge pas ou est invalide a l'execution, l'ecran de choix montre les autres et un message discret "1 profil indisponible" ; le jeu ne plante pas.
*Verification* : test d'interface avec un `profil.json` volontairement corrompu dans une copie : 5 profils affiches + message ; ce test seul tolere un avertissement console, pas d'erreur non interceptee.

### Format et validateur

**EX-020 - Format et validateur.** Format de la section 4. `node outils/valider.mjs [--racine <dossier>] [--profil <id>] [--sans-couverture]` : `--racine` (defaut `data/`) permet de valider une copie ou des donnees de test ; `--profil` valide un seul profil, y compris hors index (`_modele`) ; `--sans-couverture` saute uniquement EX-005 (donnees de demonstration). Controles : JSON valide ; identifiants uniques par profil assemble ; 2 a 4 choix ; au moins un `juste` ; references existantes ; `suivant` valides, aucun cycle, aucune scene inatteignable depuis la scene d'entree ; parcours conforme a la section 3 (tronc complet, dans l'ordre, sans doublon) ; role `verificateur` porte ; personnages generiques presents ; variantes valides ; portraits presents sur disque ; fins : `fin-patience` presente dans le tronc avec la seule condition `patience <= 0`, derniere fin commune sans condition, au moins 2 fins par profil ; `index.json` coherent avec les dossiers (dossier hors index = avertissement, sauf `_modele` ; id d'index sans dossier = erreur) ; EX-003 ; EX-005. Code 0 si valide, 1 sinon, un message par erreur.
*Verification* : `node --test tests/` avec un temoin negatif par regle dans `tests/donnees-invalides/`.

**EX-021 - Contenu separe du code.** Aucun texte de scene, de choix, de fin ni nom de personnage dans `js/`.
*Verification* : `grep -n -i -E "rectif|addition|tableur|frange|poney|story|cindy" js/*.js` vide.

### Interface

**EX-030 - Statique sans dependance.** Aucune dependance tierce, aucun CDN ni police distante, aucune requete hors origine locale.
*Verification* : `grep -rn -E "https?://" index.html css js | grep -v -E "http://www\.w3\.org/(2000/svg|1999/xlink)"` vide ; le test d'interface echoue sur toute requete hors origine.

**EX-031 - Lanceur.** `python lancer.py` sert sur `http://127.0.0.1:8796/` ; `--lan` ecoute sur toutes les interfaces et affiche l'adresse LAN ; `--port` ; message clair si le port est pris. Stdlib uniquement, aucun chemin utilisateur en dur.
*Verification* : `curl` 200 sur `/`, `/data/tronc.json`, `/data/profils/index.json` ; `--port 8797` repond sur 8797 ; second lancement sur un port occupe : code de sortie non nul et message contenant "port" ; `--lan` : la sortie affiche une adresse IPv4 autre que 127.0.0.1.

**EX-032 - Test d'interface automatise.** chrome-headless-shell de Playwright, chemin calcule (`ls -d "$LOCALAPPDATA"/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe | sort -V | tail -1`), jamais de navigateur visible, aucune dependance npm. Le test echoue si le navigateur est introuvable. Couvre : titre + avertissement, choix de profil, partie complete, jauges affichees = etat du moteur, encadre loi, 0 erreur console, 0 requete externe.
*Verification* : commande unique documentee dans le README, 0 test saute.

**EX-033 - Ecrans.** Titre ; choix du profil ; scene (portrait du personnage qui parle, texte, choix, jauges) ; encadre apres choix (reaction + "Ce que dit vraiment la loi" + article + Suivant) ; fin (titre, score, bons reflexes, avertissement, Rejouer / Changer de profil).
*Verification* : captures headless de chaque ecran en 1280x800 et 375x740.

**EX-034 - Caricatures.** Un portrait SVG dessine dans le depot par personnage nomme de chaque profil (pas d'image telechargee ni de visage d'une personne reelle), `role="img"` et `aria-label` = nom du personnage.
*Verification* : validateur (portraits presents) ; test d'interface (`aria-label` sur chaque portrait affiche).

**EX-035 - Mobile et clavier.** Jouable a 375 px sans defilement horizontal ; choix de profil et choix de scene atteignables au clavier avec focus visible.
*Verification* : test d'interface en 375x740 (`scrollWidth <= 375`) et une scene jouee au clavier.

**EX-036 - Meilleur score par profil.** Cle unique `fiscfiction.meilleur` dans `localStorage`, valeur JSON `{ "<id profil>": <plus petit redressement d'une partie terminee avec `anticipee: false`> }`, affiche sur la carte du profil. Seule donnee stockee.
*Verification* : test d'interface : deux parties sur deux profils, contenu de la cle verifie, aucune autre cle.

### Depot

**EX-040 - Organisation git.** Branche `main` protegee : toute modification passe par une pull request dont la verification `tests` est verte. Aucun push force ni reset dur.
*Verification* : protection de branche (EX-121).

**EX-041 - README.** Lancer, tester (commandes exactes), lien vers `docs/CREER_UN_PROFIL.md`.
*Verification* : les commandes sont executees telles quelles depuis un clone propre.

## 6. Risques

- Chiffres juridiques faux ou perimes : EX-002/EX-003, references verifiees sur le texte officiel puis relues.
- Humour qui derape ou nom qui tombe sur une personne reelle : EX-001, EX-006.
- Profil ajoute plus tard avec une notion juridique non verifiee : EX-002 (source officielle obligatoire, relue par un mainteneur).
- Port 8796 pris : `--port`.

## 7. Lot 3 - publication publique, extensions, deploiement

Decisions du porteur du projet (12/10/2026) : publier le code en public sur GitHub dans un depot neuf a historique neuf ; nettoyer tout ce qui est prive ; ajouter une licence ; rendre le jeu extensible a des pans entiers d'experience (mini-jeux, animations...) ; deployer sur Cloudflare Pages a partir de GitHub (production sur `main`, apercu par pull request).
Decision des mainteneurs : code sous licence MIT ; contenu (`data/`, textes, portraits SVG) sous CC BY 4.0. Les resumes d'articles de loi decrivent des textes officiels, qui ne sont pas protegeables.

### 7.1 Etat des lieux (audit du 12/10/2026, commit `b8a2e28`)
- Sain : aucun secret, aucune dependance tierce, aucune requete externe a l'execution ; auteur git = adresse noreply GitHub ; contenu fictif verifie (EX-001).
- A nettoyer avant publication : la spec et le controle EX-001 contiennent des noms d'entreprise reels (la liste des termes interdits elle-meme) et un chemin de poste local ; le guide et le README renvoient a l'outillage de travail interne ; le test d'interface ne trouve le navigateur que sous Windows (`LOCALAPPDATA`), donc pas en integration continue Linux ; 4 worktrees de travail locaux (non suivis par git).
- Modulaire pour le contenu (profils = donnees, EX-051) ; pas encore pour l'experience de jeu : une scene ne connait qu'un type (choix multiples) et `js/interface.js` rend tout. Ajouter un mini-jeu ou une animation demande aujourd'hui de modifier le coeur.

### 7.2 Exigences publication

**EX-100 - Contenu publiable.** Les fichiers suivis ne contiennent ni nom d'entreprise ou de personne reelle hors des references juridiques, ni chemin de poste (`C:\Users\...`, nom d'utilisateur), ni adresse e-mail, ni renvoi a l'outillage de travail interne. Le guide et le README parlent de "contributeurs" et de "pull request".
*Verification* : `node outils/verifier-termes.mjs` (EX-101) sort 0 ; `git grep -n -i -E "kanban|carte kanban|C:\\\\Users|AppData|@gmail|@[a-z0-9-]+\.(fr|com)"` vide, hors `docs/spec/` pour le seul mot "carte" au sens "carte de profil" ; relecture de README et guides. `docs/spec/SPEC.md` contient le motif de recherche lui-meme et est exempte de ce grep.

**EX-101 - Termes interdits sans les publier.** `outils/verifier-termes.mjs` cherche, dans tous les fichiers suivis et non suivis hors `.git/`, `.worktrees/`, `node_modules/` et `dist/`, les termes d'un fichier local non suivi `.termes-prives.txt` (un terme par ligne, `#` = commentaire), insensible a la casse et aux accents (normalisation NFD, diacritiques retires des deux cotes). `.termes-prives.txt` est dans `.gitignore`. Fichier absent : le script le dit et sort 0 (contributeurs externes) ; variable `TERMES_PRIVES_OBLIGATOIRE=1` : absence = echec. Le fichier local est cree par le mainteneur sur son poste.
*Verification* : tests `node --test` avec un `.termes-prives.txt` temporaire contenant "Societe Exemple" : un fichier non suivi "SOCIÉTÉ EXEMPLE" est trouve, "Societe Exemplaire" aussi (sous-chaine assumee), un fichier sans le terme passe ; `git check-ignore .termes-prives.txt` repond ; `git ls-files | grep termes-prives` vide.

**EX-102 - Licence.** `LICENSE` (texte MIT officiel, titulaire "Les contributeurs de Fisc & Fiction", annee 2026) et `LICENSE-CONTENU.md` (CC BY 4.0 : resume, lien vers le texte officiel, perimetre `data/` et portraits) ; le README a une section Licence qui explique le partage.
*Verification* : comparaison du corps de `LICENSE` au texte MIT de opensource.org (hors ligne de titulaire) ; relecture.

**EX-103 - Fichiers de projet public.** `README.md` (pitch, capture, jouer en ligne, lancer en local, tester, contribuer, licence, avertissement EX-004), `CONTRIBUTING.md` (ajouter un profil, ajouter un type de scene, regle : toute notion juridique nouvelle s'appuie sur un article lu dans le texte officiel et ajoute a `data/references.json` dans la meme pull request, relue par un mainteneur), `.github/pull_request_template.md` (cases : validateur, tests, sources juridiques). Les captures de demonstration (`demo-*`) sont retirees ; seules restent celles des profils reels.
*Verification* : relecture ; liens internes du README verifies par script (chaque chemin relatif existe).

**EX-104 - Tests portables et integration continue.** `trouverChrome()` cherche dans l'ordre : variable `CHROME_HEADLESS_SHELL` (chemin explicite), puis le cache Playwright de la plateforme (`%LOCALAPPDATA%\ms-playwright` sous Windows, `~/.cache/ms-playwright` sous Linux, `~/Library/Caches/ms-playwright` sous macOS) avec le bon sous-dossier (`chrome-headless-shell-win64`, `-linux64`, `-mac-arm64`/`-mac-x64`) ; introuvable = echec, jamais de saut. `.github/workflows/tests.yml` : sur push et pull request, Node 26 (ou la LTS la plus recente si 26 indisponible sur `actions/setup-node`), installation de chrome-headless-shell par `npx -y playwright@<version epinglee> install chromium-headless-shell`, puis `node outils/valider.mjs` et `node --test tests/`, 0 skip. Actions epinglees par SHA de commit.
*Verification* : `node --test tests/` vert sous Windows en local ; un test unitaire de `trouverChrome()` avec un faux arbre de dossiers par plateforme ; le workflow passe sur GitHub au premier push (lien du run dans la revue de publication).

**EX-105 - Construction du site.** `node outils/construire.mjs` cree `dist/` (ignore par git) contenant uniquement `index.html`, `css/`, `js/`, `data/` sans `data/profils/_modele/`, plus `_headers` (en-tetes Cloudflare : `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`). Aucune dependance.
*Verification* : test qui construit dans un dossier temporaire, liste les fichiers (aucun `tests/`, `docs/`, `outils/`, `_modele`), sert `dist/` et joue une partie complete dans le navigateur headless avec la CSP appliquee par le serveur de test : 0 erreur console (aucun style ou script en ligne bloque).

### 7.3 Exigences architecture d'extensions

But : un contributeur ajoute un pan d'experience (mini-jeu, nouvelle mecanique, animation) dans un dossier dedie, sans modifier le coeur (`js/moteur.js`, `js/interface.js`).

**EX-110 - Types de scene.** Une scene porte un champ `type`, `"choix"` par defaut (scenes actuelles inchangees). Le moteur reste pur et deterministe : un type non `choix` se resout par `resoudre(etat, resultat)` ou `resultat` est une donnee serialisable produite par l'interface (ex. un score entier). La scene declare ses issues : `issues: [ { "si": [CONDITION sur le resultat], "juste", "effets", "reaction", "explication", "references", "suivant" } ]`, evaluees dans l'ordre, la derniere sans condition. Les regles des choix s'appliquent aux issues (EX-002, EX-003, jauges bornees, fin anticipee).
*Verification* : tests unitaires : scene `choix` inchangee (tous les tests existants verts) ; scene d'un type de test resolue avec deux resultats differents -> deux issues differentes ; resultat identique -> etat identique (EX-013).

**EX-111 - Registre de types.** `js/types/<type>.js` exporte `{ type, validerParametres(parametres) -> liste d'erreurs, rendre(scene, conteneur, terminer(resultat)) }` ; `js/types/index.js` est la seule liste a modifier pour enregistrer un type. Le validateur utilise `validerParametres` ; un type inconnu est une erreur nommant fichier, scene et type. `js/types/choix.js` porte le rendu actuel des choix.
*Verification* : test EX-051 bis : dans une copie, ajout d'un type `essai-bouton` (un bouton qui renvoie 1) par un nouveau fichier + une ligne dans `js/types/index.js`, d'une scene qui l'utilise dans un profil, validateur vert, partie jouee jusqu'a une fin en headless ; `js/moteur.js` et `js/interface.js` identiques a l'original (hash).

**EX-112 - Premier mini-jeu : "Le tri des justificatifs".** Type `tri` : le joueur range N pieces (texte court + portrait facultatif) dans 2 ou 3 bacs nommes (ex. "Deductible" / "Pas deductible") ; resultat = nombre de pieces bien rangees. Jouable a la souris, au toucher et au clavier (Tab, fleches, Entree), sans minuterie (pas de pression, accessible). Parametres : `bacs`, `pieces: [ { texte, bac_attendu } ]`, 3 a 8 pieces. Une scene `tri` est ajoutee au profil `consultant` (frais de restaurant, voiture, salaire) et une au profil `plombier`, avec issues et references existantes.
*Verification* : `validerParametres` rejette bac attendu inconnu, moins de 3 pieces ; test headless qui joue le tri au clavier et a la souris (evenements CDP reels) et verifie l'issue retenue pour 3 scores ; 375x740 sans defilement horizontal.

**EX-113 - Animations.** Champ facultatif `animation` sur une scene, une issue ou un choix, valeur prise dans `js/animations.js` (registre : nom -> classe CSS, duree max 600 ms) ; au moins `tampon` (tampon "VERIFIE" qui s'abat) et `secousse`. Sous `prefers-reduced-motion: reduce`, aucune animation n'est jouee et le jeu reste identique. Ajouter une animation = une entree de registre + une regle CSS. Valeur inconnue = erreur du validateur.
*Verification* : test headless avec emulation `prefers-reduced-motion` (CDP `Emulation.setEmulatedMedia`) : classe appliquee sans reduction, absente avec ; validateur rejette `animation: "inconnue"`.

**EX-114 - Documentation d'extension.** `docs/AJOUTER_UN_TYPE_DE_SCENE.md` : contrat d'un type, exemple complet (le type `essai-bouton` de EX-111), regles de determinisme et d'accessibilite, comment tester ; `docs/ARCHITECTURE.md` : schema des modules (moteur pur, interface, types, animations, donnees, validateur), ce qui est stable (format des donnees, contrat des types) et ce qui ne l'est pas.
*Verification* : Un relecteur suit le guide dans un clone propre et ajoute un type sans lire le code du coeur.

### 7.4 Exigences deploiement

**EX-120 - Cloudflare Pages relie a GitHub.** Projet Pages `taxes-and-furious` relie au depot GitHub public par l'integration Git de Cloudflare : commande de construction `node outils/construire.mjs`, dossier de sortie `dist`, variable `NODE_VERSION` alignee sur EX-104. Production = branche `main` ; chaque pull request recoit une URL d'apercu. Pas de jeton Cloudflare dans le depot ni dans GitHub.
*Verification* : URL de production repond 200 et joue une partie en headless ; en-tetes de EX-105 presents (`curl -sI`) ; une pull request de test montre un deploiement d'apercu dans ses verifications.

**EX-121 - Depot neuf.** Depot public `taxes-and-furious` sur le compte GitHub du porteur, cree a partir de l'arbre de `main` apres les lots 7.2 et 7.3, en un seul commit initial, avec la spec nettoyee (processus interne retire, regles conservees) (historique neuf : l'historique local, qui contient les versions de spec non nettoyees, ne part pas). Le depot local de travail est conserve tel quel. Protection de `main` : pull request obligatoire, verification `tests` obligatoire.
*Verification* : `git log --oneline` du depot public = 1 commit au depart ; `node outils/verifier-termes.mjs` avec `TERMES_PRIVES_OBLIGATOIRE=1` sur un clone frais du depot public sort 0 ; protection de branche visible par `gh api repos/<compte>/taxes-and-furious/branches/main/protection`.

**EX-122 - Titre.** Le titre affiche (`data/tronc.json` champ `titre`, `<title>` de `index.html`), le README, `CONTRIBUTING.md`, `LICENSE` (titulaire "Les contributeurs de Taxes & Furious"), `LICENSE-CONTENU.md`, le lanceur et les commentaires d'en-tete disent "Taxes & Furious" ; plus aucune occurrence de "Fisc & Fiction" ni de `fisc-et-fiction` hors `docs/spec/` (historique) et la cle `fiscfiction.meilleur`.
*Verification* : `git grep -n -i -E "fisc ?& ?fiction|fisc-et-fiction" -- . ':!docs/spec'` vide ; test d'interface : le titre de l'ecran titre vaut "Taxes & Furious".

Hors perimetre lot 3 : nom de domaine personnalise, statistiques de visite, son.

## 8. Lot 4 - profondeur de jeu et confort (retours du porteur apres la premiere partie en ligne, 12/10/2026)

Constats verifies sur `main` (17e8786) : tous les profils commencent par le chapitre `avis` du tronc ; les variantes ne reecrivent que 3 a 5 des 10 scenes du tronc, donc les premieres questions sont identiques d'un profil a l'autre ; 9 scenes du tronc sur 10 et la plupart des scenes de profil n'ont que 2 choix ; aucun moyen de revenir a l'accueil en cours de partie ; dans l'encadre apres un choix, "Ce que dit vraiment la loi" apparait deux fois (titre de l'encadre et debut de chaque `explication`) et l'explication repete souvent le resume d'article affiche juste dessous.

Toute evolution passe par une pull request sur `main` ; la verification `tests` doit etre verte.

### 8.1 Confort et lisibilite

**EX-130 - Retour a l'accueil.** Pendant une partie (ecran de scene et encadre apres choix), un bouton "Accueil" visible en permanence (en-tete), atteignable au clavier. Il ouvre une confirmation accessible (`<dialog>` natif, focus place dans la boite, Echap = annuler) : "Quitter la partie ? Elle ne sera pas enregistree." avec "Quitter" et "Continuer la partie". "Quitter" ramene a l'ecran titre (avertissement EX-004 visible) sans modifier le meilleur score ; "Continuer" referme sans rien changer. Sur l'ecran de fin, "Accueil" ramene directement a l'ecran titre (rien a perdre).
*Verification* : test d'interface : en pleine partie, Accueil puis Continuer -> meme scene, memes jauges ; Accueil puis Quitter -> ecran titre, cle `fiscfiction.meilleur` inchangee ; Echap ferme la boite ; parcours au clavier ; 375x740 sans defilement horizontal ; aucune erreur CSP (pas de style ni script en ligne).

**EX-131 - Encadre de la loi sans doublon.** Le titre "Ce que dit vraiment la loi" n'apparait qu'une fois (titre de l'encadre). Les champs `explication` ne commencent plus par ce libelle. L'explication dit ce qui s'applique AU CAS JOUE (une ou deux phrases) ; le resume de l'article, affiche dessous avec son numero, reste la reference generale. Les deux ne doivent pas reprendre la meme phrase.
*Verification* : `git grep -c "Ce que dit vraiment la loi" -- data` = 0 ; le validateur rejette une explication qui commence par ce libelle (temoin) ; test d'interface : le libelle apparait 1 fois dans l'encadre ; le validateur signale (avertissement) une explication dont plus de 60 % des mots (hors mots de moins de 4 lettres) figurent dans le resume d'une reference citee, et `node outils/valider.mjs` sur `data/` sort 0 avertissement de ce type.

### 8.2 Profondeur de jeu

**EX-140 - Ouverture propre a chaque profil.** Chaque profil commence par un chapitre a lui (1 a 2 scenes : la situation du metier avant l'arrivee du controle), avant `tronc:avis`. Le validateur exige que la premiere entree du parcours d'un profil soit `profil:<id>`.
*Verification* : validateur (temoin : parcours qui commence par `tronc:`) ; test : les textes de la premiere scene des 6 profils sont tous differents.

**EX-141 - Tronc entierement habille.** Chaque profil fournit une variante pour CHAQUE scene du tronc (texte de scene et reaction de chaque choix), dans son univers et avec ses personnages. Les effets, `juste`, explications et references restent ceux du tronc.
*Verification* : validateur : pour un profil de `index.json`, toute scene du tronc sans variante = erreur, tout choix du tronc sans `reaction` de variante = erreur (le modele `_modele` et les donnees de test peuvent etre exemptes par une option documentee) ; test : pour chaque scene du tronc, les 6 textes affiches sont deux a deux differents.

**EX-142 - Plus de choix.** Toute scene de type `choix` (tronc et profils) propose 3 ou 4 choix, dont au moins un `juste` et au moins un mauvais reflexe credible (pas seulement l'absurde) ; les mauvais choix ont des effets differents entre eux (pas deux choix aux effets identiques dans une scene). La limite du format reste 2 a 4 (EX-020) pour les profils externes ; la regle 3 a 4 s'applique a `data/`.
*Verification* : test sur `data/` : nombre de choix par scene dans [3, 4] ; aucune paire de choix d'une meme scene avec effets identiques ; validateur toujours vert.

**EX-143 - Profondeur.** Chaque profil compte au moins 2 chapitres propres en plus de l'ouverture (EX-140) et au moins 3 fins propres, dont une atteignable seulement par un choix fait dans un chapitre de profil (consequence differee : une issue ou un choix pose un effet que seule une fin du profil exploite, par ex. via un seuil de jauge). Parcours total par profil : 16 a 24 scenes.
*Verification* : test : comptage chapitres/fins/scenes par profil ; pour chaque profil, une suite de choix atteint chaque fin propre (exploration existante) ; REVIEWER relit le ton (section 2.1) et la justesse juridique de chaque nouvelle explication (references existantes uniquement ; besoin d'une notion nouvelle = demande a SPEC avec l'article).

Hors perimetre lot 4 : nouveaux profils, nouveaux mini-jeux, son.

## 9. Lot 5 - identite graphique illustree (demande du porteur, 12/10/2026)

But : donner au jeu une identite visuelle forte et coherente : un decor illustre par lieu (bureau du verificateur, restaurant, villa d'influenceuse...) et des personnages illustres, generes par IA (Gemini) puis selectionnes et integres a la main. Les portraits SVG actuels, juges trop generiques, sont remplaces et ne restent qu'en repli.

### 9.1 Direction artistique (fait foi pour toute image)

- Style : bande dessinee franco-belge, ligne claire, contours noirs nets, aplats, ombres simples ; palette chaude facon papier kraft (ocres, rouge brique, vert bouteille, creme) ; lumiere de fin d'apres-midi ; humour de situation dans les details du decor.
- Preambule commun a TOUS les prompts (copie exacte, puis la description propre a l'image) : "Illustration pour un jeu web humoristique francais sur le controle fiscal, style bande dessinee franco-belge (ligne claire), couleurs chaudes facon papier kraft, aplats, contours noirs nets."
- Decors : format horizontal 16:9, sans personnage, sans texte lisible (pas de marque, pas de logo, pas de nom propre ; un mot generique flou est tolere), centre de l'image calme et degage (le jeu pose dessus un panneau de texte).
- Personnages : buste ou plein pied, de trois quarts, fond blanc uni, une expression lisible ; caricature de fonction (le verificateur, l'influenceuse...), jamais le visage d'une personne reelle ni d'une celebrite ; pas de prompt citant le nom d'une personne reelle ou d'un acteur.
- Coherence : une image de reference par personnage (fiche personnage) est jointe aux generations suivantes du meme personnage ; toutes les images d'un lot sont relues cote a cote avant integration (meme trait, meme palette).
- Ecart a la charte = image rejetee, pas retouchee a la main.

### 9.2 Inventaire

| Lieu / personnage | Usage | Fichier |
|---|---|---|
| Bureau du verificateur (piles de dossiers, tampon, thermos, calculatrice a rouleau) | chapitres `avis` et `rectification` par defaut | `data/communs/decors/bureau-verificateur.webp` |
| Salle d'archives / poste informatique avec cartons | chapitre `fec` par defaut | `data/communs/decors/archives.webp` |
| Couverture : guichet des impots facon affiche de film d'action (vitesse, flammes de papier) | ecran titre | `data/communs/decors/couverture.webp` |
| Restaurateur : salle de bistrot en fin de service ; cuisine en coup de feu | chapitres du profil | `data/profils/restaurateur/decors/*.webp` |
| Influenceuse : villa avec piscine a debordement ; studio de tournage avec anneau lumineux | idem | `data/profils/influenceuse/decors/*.webp` |
| Plombier : salle de bains en chantier ; camionnette atelier | idem | `data/profils/plombier/decors/*.webp` |
| Consultant : open space de start-up (baby-foot, post-it) ; parking avec voiture de sport | idem | `data/profils/consultant/decors/*.webp` |
| Coiffeuse : salon de quartier ; arriere-boutique (stock de shampoings) | idem | `data/profils/coiffeuse/decors/*.webp` |
| Galeriste : galerie aux murs blancs et cadres vides ; maison de campagne | idem | `data/profils/galeriste/decors/*.webp` |
| Personnages nommes de chaque profil (dont le `joueur` du profil) + generiques | portrait facon photo d'identite judiciaire (EX-152) et illustration en situation (EX-156) | `data/profils/<id>/img/<perso>.webp` et `<perso>-situation.webp`, `data/communs/img/*.webp` |
| Controleur fiscal emblematique | portrait + illustration en pied heroique (EX-157) | `data/communs/img/embleme.webp`, `embleme-situation.webp` |

### 9.3 Exigences

**EX-150 - Decors dans les donnees.** `profil.json` accepte `decors` : `{ "<id chapitre (tronc ou profil)>": "decors/<fichier>.webp" }` ; `data/communs/decors.json` donne les decors par defaut des chapitres du tronc et celui de l'ecran titre. Une scene peut surcharger avec `decor`. Ordre : decor de la scene, puis du chapitre dans le profil, puis decor par defaut du tronc, puis aucun (fond uni actuel). Le moteur reste pur : il transmet le chemin, l'interface l'affiche.
*Verification* : tests du moteur (resolution dans les 4 cas) ; validateur : fichier present, extension `.webp`, chapitre existant (temoins negatifs).

**EX-151 - Affichage lisible.** Le decor occupe le fond de l'ecran de partie (`object-fit: cover`, decoratif : `alt=""` et `aria-hidden`), le texte et les choix restent sur un panneau opaque ; contraste texte/panneau >= 4,5:1 calcule sur la couleur du panneau. Changement de decor en fondu <= 300 ms, coupe sous `prefers-reduced-motion`. Chargement : decor suivant prechargé, `decoding="async"`. Aucune image en ligne (`data:`) ni style en ligne (CSP inchangee).
*Verification* : test d'interface en 1280x800 et 375x740 : decor attendu pour une scene de chaque cas d'EX-150, panneau lisible (contraste calcule), 0 erreur CSP, 0 requete externe ; captures jointes.

**EX-152 - Portraits illustres facon photo d'identite judiciaire.** Chaque personnage nomme a un portrait `mugshot` : buste de face, regard camera, expression typique du personnage, devant une toise graduee (traits sans chiffres lisibles), tenant ou non une ardoise vierge, eclairage frontal, toujours dans le style BD de 9.1 (pas de photo realiste). Format carre 512 px, fond conserve (la toise fait partie de l'image), <= 80 Ko. Champ `portrait` du personnage (`.webp`) ; repli : `.svg` existant, puis initiales dans un disque. `role="img"` et `aria-label` = nom, inchanges.
*Verification* : validateur (presence, carre 512) ; test d'interface du repli (image 404 simulee -> SVG affiche, 0 erreur non interceptee) ; relecture REVIEWER sur planche (meme cadrage et meme toise pour tous).

**EX-156 - Personnages en situation.** Chaque personnage nomme a aussi une illustration en pied, en situation dans son univers (le restaurateur derriere son comptoir, l'influenceuse au bord de la piscine, le verificateur avec ses dossiers...), meme personnage que son portrait (portrait joint en reference a la generation). Format vertical 3:4, 768x1024, <= 150 Ko, champ `illustration` du personnage. Usage : (a) carte de profil de l'ecran de choix = illustration du personnage `joueur` du profil ; (b) premiere apparition d'un personnage dans une partie = fiche de presentation (illustration + portrait + nom + une ligne de description) avant sa replique, fermee par "Suivant" ou Echap ; (c) ecran de fin = illustration du verificateur du profil. Absente = l'interface ne montre que le portrait.
*Verification* : tests d'interface des trois usages et du cas absent ; 375x740 sans defilement horizontal ; clavier.

**EX-157 - Le joueur et le controleur emblematique.** Chaque profil declare un personnage de role `joueur` propre (le gerant caricatural du metier : le restaurateur, la coiffeuse, le galeriste... ; l'influenceuse est deja @CindyFiltre), avec portrait et illustration ; le personnage generique "Vous" reste le repli. Le jeu a un controleur fiscal emblematique, figure de la couverture et de l'ecran titre (`data/communs/personnages.json`, role `embleme`, portrait + illustration en pied heroique facon affiche de film d'action) ; il n'apparait pas dans les scenes (chaque profil garde son verificateur).
*Verification* : validateur : un `joueur` par profil de l'index (option `--exigences-lot5`), personnage `embleme` present avec ses deux images ; test d'interface : ecran titre montre l'embleme.

**EX-153 - Poids.** Decor <= 250 Ko (largeur 1024 a 1600 px), portrait <= 80 Ko, illustration en pied <= 150 Ko, total `data/**/*.webp` <= 12 Mo ; la page d'accueil ne charge que la couverture, l'embleme et les illustrations de l'ecran de choix (< 2 Mo transferes) ; les images d'une partie sont chargees a la demande.
*Verification* : test qui mesure les fichiers ; test d'interface qui somme les octets transferes a l'ecran de choix.

**EX-154 - Provenance et licence.** Les images generees sont sous la licence du contenu (CC BY 4.0) ; `LICENSE-CONTENU.md` et le README indiquent "illustrations generees avec l'aide de Gemini (Google), puis selectionnees et retouchees" ; `docs/art/PROMPTS.md` liste, pour chaque fichier, le prompt exact utilise (preambule compris) et la date. Pas de filigrane visible tiers dans les images publiees.
*Verification* : test : chaque `.webp` de `data/` a une entree dans `docs/art/PROMPTS.md` et inversement ; relecture REVIEWER des images (charte 9.1, pas de visage reel, pas de texte lisible, pas de marque).

**EX-155 - Outil de preparation.** `outils/preparer-images.mjs` ou `.py` (sans dependance ajoutee au depot ; Pillow autorise en outil local, documente) : conversion WebP, redimensionnement, detourage du fond blanc des portraits (remplissage depuis les coins, pas de seuil global qui mangerait les blancs du personnage), controle des poids d'EX-153.
*Verification* : test sur une image d'essai fournie dans `tests/donnees/art/` : sortie aux bonnes dimensions, poids sous le plafond, coins transparents et centre opaque pour un portrait.

Hors perimetre lot 5 : animation des personnages, sons, image par scene (au plus un decor par chapitre, sauf exception justifiee).
