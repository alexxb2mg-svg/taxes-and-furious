// Moteur de jeu pur (EX-010) : aucune interface, aucun reseau, aucun stockage.
// Toutes les donnees (textes, personnages, fins) viennent des JSON de data/.
// Les fonctions ne modifient jamais leurs arguments et renvoient des objets geles.

export const JAUGES = ['redressement', 'patience', 'stress'];
export const ROLES_TRONC = ['verificateur', 'comptable', 'joueur', 'narrateur'];
export const ROLES_GENERIQUES = ['comptable', 'joueur'];
// Controleur emblematique (EX-157) : role reserve a communs/personnages.json, absent des scenes.
export const ROLE_EMBLEME = 'embleme';
export const OPERATEURS = ['<', '<=', '>', '>=', '=='];
export const ID_FIN_PATIENCE = 'fin-patience';
export const TYPE_DEFAUT = 'choix';
export const JAUGES_DEFAUT = Object.freeze({ redressement: 0, patience: 70, stress: 30 });

const PREFIXE_TRONC = 'tronc:';
const PREFIXE_PROFIL = 'profil:';

// Lien etat -> scenario, non enumerable : l'etat reste une donnee simple
// (comparable par deepStrictEqual, serialisable) mais choisir() retrouve le scenario.
const SCENARIO = Symbol('scenario');

function copie(valeur) {
  return valeur === undefined ? undefined : structuredClone(valeur);
}

function geler(objet) {
  if (objet && typeof objet === 'object' && !Object.isFrozen(objet)) {
    Object.freeze(objet);
    for (const cle of Object.keys(objet)) geler(objet[cle]);
  }
  return objet;
}

function erreur(message) {
  return new Error(`moteur : ${message}`);
}

/** Borne une jauge : redressement >= 0, patience et stress dans 0..100 (EX-011). */
export function borner(jauge, valeur) {
  const v = Math.round(Number(valeur) || 0);
  if (jauge === 'redressement') return Math.max(0, v);
  return Math.min(100, Math.max(0, v));
}

function personnageNarrateur() {
  return { id: 'narrateur', role: 'narrateur', nom: null, description: null, portrait: null, repli: null, illustration: null };
}

/** Portrait SVG de repli d'un portrait illustre `.webp` : meme nom, extension `.svg` ; sinon null (EX-152). */
export function portraitRepli(chemin) {
  return typeof chemin === 'string' && /\.webp$/i.test(chemin) ? chemin.replace(/\.webp$/i, '.svg') : null;
}

function personnagePublic(p, dossier) {
  const portrait = p.portrait ? `${dossier}/${p.portrait}` : null;
  return {
    id: p.id,
    role: p.role,
    nom: p.nom,
    description: p.description ?? null,
    portrait,
    repli: portraitRepli(portrait),
    // Illustration en pied, en situation (EX-156) : facultative, null si absente.
    illustration: typeof p.illustration === 'string' && p.illustration !== '' ? `${dossier}/${p.illustration}` : null,
  };
}

/**
 * Controleur fiscal emblematique (EX-157) : personnage de role `embleme` de communs/personnages.json,
 * chemins relatifs a la racine des donnees ; null s'il n'est pas declare. Il ne joue dans aucune scene.
 */
export function embleme(communs) {
  const p = Array.isArray(communs?.personnages) ? communs.personnages.find((x) => x?.role === ROLE_EMBLEME) : undefined;
  return p ? geler(personnagePublic(p, 'communs')) : null;
}

/** Chemin d'un decor relatif a la racine des donnees, ou null (EX-150). */
function cheminDecor(dossier, rel) {
  return typeof rel === 'string' && rel !== '' ? `${dossier}/${rel}` : null;
}

/** Decor de l'ecran titre (EX-150) : `titre` de communs/decors.json, ou null. */
export function decorTitre(decors) {
  return cheminDecor('communs', decors?.titre);
}

/**
 * Assemble le scenario complet d'un profil (EX-010) : parcours deroule,
 * variantes appliquees, roles du tronc resolus en personnages.
 * @param {object} tronc contenu de tronc.json
 * @param {object} profil contenu de profils/<id>/profil.json
 * @param {object} [variantes] contenu de profils/<id>/variantes.json
 * @param {object} [communs] contenu de communs/personnages.json ({ personnages: [...] }) :
 *   personnages generiques des roles comptable et joueur non portes par le profil.
 * @param {object} [decors] contenu de communs/decors.json : { "chapitres": { "<id tronc>": "decors/x.webp" }, "titre": ... }
 * Les chemins de portrait et de decor renvoyes sont relatifs a la racine des donnees
 * (ex. "profils/<id>/img/<fichier>.svg", "communs/img/comptable.svg", "communs/decors/archives.webp").
 * Decor d'une scene (EX-150) : `decor` de la scene, sinon `decors["<id chapitre>"]` du profil, sinon le
 * decor par defaut du tronc (communs/decors.json), sinon aucun (null). Le moteur transmet le chemin ;
 * l'interface l'affiche.
 */
export function assembler(tronc, profil, variantes = {}, communs = { personnages: [] }, decors = { chapitres: {}, titre: null }) {
  if (!tronc || !Array.isArray(tronc.chapitres)) throw erreur('tronc sans tableau "chapitres"');
  if (!profil || typeof profil.id !== 'string') throw erreur('profil sans "id"');
  const dossierProfil = `profils/${profil.id}`;
  const personnagesProfil = Array.isArray(profil.personnages) ? profil.personnages : [];
  const generiques = Array.isArray(communs?.personnages) ? communs.personnages : [];

  // Roles du tronc -> personnages.
  const parRole = {};
  for (const role of ROLES_TRONC) {
    if (role === 'narrateur') {
      parRole[role] = personnageNarrateur();
      continue;
    }
    const porte = personnagesProfil.find((p) => p.role === role);
    if (porte) {
      parRole[role] = personnagePublic(porte, dossierProfil);
    } else if (ROLES_GENERIQUES.includes(role)) {
      // Personnage generique de communs/personnages.json ; sans communs (appel a 3 arguments),
      // le role reste resolu mais sans nom ni portrait : passer `communs` pour l'affichage.
      const g = generiques.find((p) => p.role === role);
      parRole[role] = g
        ? personnagePublic(g, 'communs')
        : { id: role, role, nom: null, description: null, portrait: null, repli: null, illustration: null };
    } else {
      throw erreur(`profil "${profil.id}" : role "${role}" porte par aucun personnage`);
    }
  }
  const parId = Object.fromEntries(personnagesProfil.map((p) => [p.id, personnagePublic(p, dossierProfil)]));

  // Decors (EX-150) : chapitre du profil, puis defaut du tronc (chapitres du tronc seulement).
  const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const decorsProfil = estObjet(profil.decors) ? profil.decors : {};
  const decorsTronc = estObjet(decors?.chapitres) ? decors.chapitres : {};
  const decorChapitre = (id, duTronc) => cheminDecor(dossierProfil, decorsProfil[id])
    ?? (duTronc ? cheminDecor('communs', decorsTronc[id]) : null);

  const chapitresTronc = new Map(tronc.chapitres.map((c) => [c.id, c]));
  const chapitresProfil = new Map((profil.chapitres ?? []).map((c) => [c.id, c]));
  const parcours = Array.isArray(profil.parcours) ? profil.parcours : [];
  if (parcours.length === 0) throw erreur(`profil "${profil.id}" : parcours vide`);

  const chapitres = parcours.map((entree) => {
    if (typeof entree === 'string' && entree.startsWith(PREFIXE_TRONC)) {
      const id = entree.slice(PREFIXE_TRONC.length);
      const ch = chapitresTronc.get(id);
      if (!ch) throw erreur(`profil "${profil.id}" : chapitre du tronc "${id}" introuvable`);
      const decor = decorChapitre(id, true);
      return {
        id: entree,
        origine: 'tronc',
        titre: ch.titre,
        decor,
        scenes: ch.scenes.map((s) => ({ ...sceneTronc(s, variantes?.[s.id], parRole), decor: cheminDecor('communs', s.decor) ?? decor })),
      };
    }
    if (typeof entree === 'string' && entree.startsWith(PREFIXE_PROFIL)) {
      const id = entree.slice(PREFIXE_PROFIL.length);
      const ch = chapitresProfil.get(id);
      if (!ch) throw erreur(`profil "${profil.id}" : chapitre du profil "${id}" introuvable`);
      const decor = decorChapitre(id, false);
      return {
        id: entree,
        origine: 'profil',
        titre: ch.titre,
        decor,
        scenes: ch.scenes.map((s) => ({ ...sceneProfil(s, parId, profil.id), decor: cheminDecor(dossierProfil, s.decor) ?? decor })),
      };
    }
    throw erreur(`profil "${profil.id}" : entree de parcours "${entree}" invalide (attendu "tronc:<id>" ou "profil:<id>")`);
  });

  const finsTronc = Array.isArray(tronc.fins) ? tronc.fins : [];
  const finPatience = finsTronc.find((f) => f.id === ID_FIN_PATIENCE);
  if (!finPatience) throw erreur(`fin commune "${ID_FIN_PATIENCE}" absente du tronc`);

  const jauges = { ...JAUGES_DEFAUT };
  for (const source of [tronc.jauges_initiales, profil.jauges_initiales]) {
    for (const j of JAUGES) if (source && source[j] !== undefined) jauges[j] = borner(j, source[j]);
  }

  return geler({
    titre: tronc.titre ?? null,
    profil: {
      id: profil.id,
      nom: profil.nom ?? null,
      entreprise: profil.entreprise ?? null,
      accroche: profil.accroche ?? null,
    },
    jauges_initiales: jauges,
    personnages: { roles: parRole, profil: parId },
    chapitres,
    // Ordre d'evaluation de la section 3 : fins du profil, puis communes hors fin-patience.
    fins: [...(profil.fins ?? []), ...finsTronc.filter((f) => f.id !== ID_FIN_PATIENCE)].map(copie),
    finPatience: copie(finPatience),
  });
}

/** Type d'une scene (EX-110) : "choix" par defaut. */
export function typeDe(scene) {
  return scene?.type ?? TYPE_DEFAUT;
}

/**
 * Champs communs d'une scene assemblee : type, et selon le type `choix` (scene a choix multiples)
 * ou `parametres` + `issues` (autre type, EX-110) ; `animation` facultative (EX-113).
 */
function corpsScene(scene, choix) {
  const type = typeDe(scene);
  const corps = { id: scene.id, type };
  if (type === TYPE_DEFAUT) corps.choix = choix;
  else {
    corps.parametres = copie(scene.parametres) ?? {};
    corps.issues = copie(scene.issues);
  }
  if (scene.animation !== undefined) corps.animation = scene.animation;
  return corps;
}

function sceneTronc(scene, variante, parRole) {
  const role = scene.personnage;
  const personnage = parRole[role];
  if (!personnage) throw erreur(`scene "${scene.id}" : role "${role}" inconnu`);
  const choix = typeDe(scene) === TYPE_DEFAUT
    ? scene.choix.map((c) => {
      const v = variante?.choix?.[c.id];
      return { ...copie(c), texte: v?.texte ?? c.texte, reaction: v?.reaction ?? c.reaction };
    })
    : undefined;
  return { ...corpsScene(scene, choix), personnage, texte: variante?.texte ?? scene.texte };
}

function sceneProfil(scene, parId, idProfil) {
  const personnage = scene.personnage === 'narrateur' ? personnageNarrateur() : parId[scene.personnage];
  if (!personnage) throw erreur(`profil "${idProfil}", scene "${scene.id}" : personnage "${scene.personnage}" inconnu`);
  return { ...corpsScene(scene, copie(scene.choix)), personnage, texte: scene.texte };
}

function lier(etat, scenario) {
  Object.defineProperty(etat, SCENARIO, { value: scenario, enumerable: false });
  return Object.freeze(etat);
}

function scenarioDe(etat) {
  const s = etat?.[SCENARIO];
  if (!s) throw erreur('etat sans scenario (utiliser nouvellePartie puis choisir)');
  return s;
}

/** Nouvelle partie au debut du parcours. */
export function nouvellePartie(scenario) {
  if (!scenario?.chapitres?.length) throw erreur('scenario sans chapitre');
  const premier = scenario.chapitres[0].scenes[0];
  const jauges = { ...scenario.jauges_initiales };
  const anticipee = jauges.patience <= 0;
  return lier(
    {
      profil: scenario.profil.id,
      chapitre: anticipee ? null : 0,
      scene: anticipee ? null : premier.id,
      jauges: Object.freeze(jauges),
      scenesJouees: 0,
      bonsReflexes: 0,
      historique: Object.freeze([]),
      dernierChoix: null,
      terminee: anticipee,
      anticipee,
    },
    scenario,
  );
}

/** Scene en cours (null si la partie est terminee). */
export function sceneCourante(etat) {
  if (etat.terminee) return null;
  const scenario = scenarioDe(etat);
  return scenario.chapitres[etat.chapitre].scenes.find((s) => s.id === etat.scene) ?? null;
}

/**
 * Retrouve un choix (ou une issue d'une scene d'un autre type) par son id dans le scenario de l'etat,
 * pour afficher reaction et explication.
 */
export function trouverChoix(etat, idChoix) {
  const scenario = scenarioDe(etat);
  for (const ch of scenario.chapitres) {
    for (const s of ch.scenes) {
      const c = sorties(s).find((x) => x.id === idChoix);
      if (c) return c;
    }
  }
  return null;
}

/** Choix d'une scene a choix multiples, ou issues d'une scene d'un autre type. */
export function sorties(scene) {
  return (typeDe(scene) === TYPE_DEFAUT ? scene?.choix : scene?.issues) ?? [];
}

/** Applique un choix de la scene courante ; renvoie un nouvel etat, l'ancien reste intact. */
export function choisir(etat, idChoix) {
  if (etat.terminee) throw erreur('partie terminee : aucun choix possible');
  const scene = sceneCourante(etat);
  if (typeDe(scene) !== TYPE_DEFAUT) {
    throw erreur(`scene "${etat.scene}" de type "${typeDe(scene)}" : utiliser resoudre(etat, resultat)`);
  }
  const choix = scene?.choix.find((c) => c.id === idChoix);
  if (!choix) throw erreur(`choix "${idChoix}" absent de la scene "${etat.scene}"`);
  return appliquer(etat, choix);
}

/** Valeur serialisable en JSON sans perte (nombres finis, textes, booleens, null, tableaux, objets simples). */
function estSerialisable(v) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(estSerialisable);
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.values(v).every(estSerialisable);
  return false;
}

/**
 * Vrai si toutes les conditions `si` d'une issue sont satisfaites par le resultat (EX-110).
 * Condition : { "op": ">=", "valeur": 3 } compare le resultat ; avec "champ", compare resultat[champ].
 */
export function conditionsResultat(si, resultat) {
  return (si ?? []).every(({ champ, op, valeur }) => comparer(champ === undefined ? resultat : resultat?.[champ], op, valeur));
}

/** Issue retenue pour un resultat : la premiere dont toutes les conditions sont vraies (null si aucune). */
export function issuePour(scene, resultat) {
  return (scene?.issues ?? []).find((i) => conditionsResultat(i.si, resultat)) ?? null;
}

/**
 * Resout la scene courante avec le resultat produit par l'interface (EX-110), de facon pure et
 * deterministe : meme etat et meme resultat = meme nouvel etat. Scene `choix` : le resultat est l'id
 * du choix (equivaut a choisir). Autre type : premiere issue satisfaite, appliquee comme un choix
 * (jauges bornees, fin anticipee, bons reflexes).
 */
export function resoudre(etat, resultat) {
  if (etat.terminee) throw erreur('partie terminee : aucun choix possible');
  const scene = sceneCourante(etat);
  if (typeDe(scene) === TYPE_DEFAUT) return choisir(etat, resultat);
  if (!estSerialisable(resultat)) throw erreur(`scene "${etat.scene}" : resultat non serialisable (${String(resultat)})`);
  const issue = issuePour(scene, resultat);
  if (!issue) throw erreur(`scene "${etat.scene}" : aucune issue pour le resultat ${JSON.stringify(resultat)} (la derniere issue doit etre sans condition)`);
  return appliquer(etat, issue);
}

/** Effets d'un choix ou d'une issue sur l'etat, enchainement des scenes et fin anticipee (section 3). */
function appliquer(etat, choix) {
  const scenario = scenarioDe(etat);
  const idChoix = choix.id;
  const jauges = {};
  for (const j of JAUGES) jauges[j] = borner(j, etat.jauges[j] + (Number(choix.effets?.[j]) || 0));

  let chapitre = etat.chapitre;
  let suivante = choix.suivant ?? null;
  let terminee = false;
  let anticipee = false;
  if (jauges.patience <= 0) {
    // Fin anticipee (section 3, EX-012) : arret immediat, meme au milieu d'un chapitre.
    terminee = true;
    anticipee = true;
    chapitre = null;
    suivante = null;
  } else if (suivante === null) {
    chapitre += 1;
    if (chapitre >= scenario.chapitres.length) {
      terminee = true;
      chapitre = null;
    } else {
      suivante = scenario.chapitres[chapitre].scenes[0].id;
    }
  }

  return lier(
    {
      profil: etat.profil,
      chapitre,
      scene: suivante,
      jauges: Object.freeze(jauges),
      scenesJouees: etat.scenesJouees + 1,
      bonsReflexes: etat.bonsReflexes + (choix.juste === true ? 1 : 0),
      historique: Object.freeze([...etat.historique, idChoix]),
      dernierChoix: idChoix,
      terminee,
      anticipee,
    },
    scenario,
  );
}

export function estTerminee(etat) {
  return etat.terminee === true;
}

/** Vrai si toutes les conditions de la fin sont satisfaites par les jauges. */
export function conditionsSatisfaites(conditions, jauges) {
  return (conditions ?? []).every(({ jauge, op, valeur }) => comparer(jauges[jauge], op, valeur));
}

function comparer(v, op, valeur) {
  switch (op) {
    case '<': return v < valeur;
    case '<=': return v <= valeur;
    case '>': return v > valeur;
    case '>=': return v >= valeur;
    case '==': return v === valeur;
    default: throw erreur(`operateur "${op}" inconnu`);
  }
}

/** Fin retenue et score (section 3). */
export function fin(etat, scenario = scenarioDe(etat)) {
  if (!estTerminee(etat)) throw erreur('partie non terminee');
  let retenue;
  if (etat.anticipee) {
    retenue = scenario.finPatience;
  } else {
    retenue = scenario.fins.find((f) => conditionsSatisfaites(f.conditions, etat.jauges));
    if (!retenue) throw erreur('aucune fin satisfaite (la derniere fin commune doit etre sans condition)');
  }
  return Object.freeze({
    id: retenue.id,
    titre: retenue.titre,
    texte: retenue.texte,
    anticipee: etat.anticipee,
    redressement: etat.jauges.redressement,
    bonsReflexes: etat.bonsReflexes,
    scenesJouees: etat.scenesJouees,
  });
}
