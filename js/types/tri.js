// Type de scene "tri" (EX-112) : "Le tri des justificatifs". Le joueur range chaque piece dans un
// des 2 ou 3 bacs, puis valide ; resultat = nombre de pieces bien rangees (entier).
// Sans minuterie. Souris et toucher : un clic (ou une tape) sur le bac voulu de chaque piece.
// Clavier : Tab va d'une piece a l'autre, fleches = bac de la piece, Entree valide le tri.
// Chaque piece est un groupe de boutons radio natifs (accessibles et lus par les lecteurs d'ecran).
//
// Parametres : { "bacs": ["Deductible", "Pas deductible"],
//                "pieces": [ { "texte": "...", "bac_attendu": "Deductible", "portrait": "img/x.svg" } ] }
// `portrait` est facultatif : chemin d'un SVG relatif au dossier du profil (comme les portraits des personnages).

const MIN_PIECES = 3;
const MAX_PIECES = 8;
const MIN_BACS = 2;
const MAX_BACS = 3;

const LIBELLES = {
  consigne: 'Rangez chaque pièce dans le bon bac, puis validez le tri.',
  pieces: 'Pièces à ranger',
  bacs: 'Contenu des bacs',
  valider: 'Valider le tri',
  manque: (n) => (n === 1 ? 'Il reste 1 pièce à ranger.' : `Il reste ${n} pièces à ranger.`),
  bilan: (n, total) => `${n} pièce${n > 1 ? 's' : ''} sur ${total} dans le bon bac`,
};

const estTexte = (v) => typeof v === 'string' && v.trim() !== '';

/** Nombre de pieces bien rangees : `choix[i]` = nom du bac choisi pour la piece i (ou null). */
export function compter(parametres, choix) {
  return parametres.pieces.reduce((n, p, i) => n + (choix[i] === p.bac_attendu ? 1 : 0), 0);
}

export default {
  type: 'tri',

  /**
   * Erreurs de parametres (textes en francais, champ nomme). `contexte.existe(rel)` (facultatif,
   * fourni par le validateur) dit si un fichier existe dans le dossier du profil.
   */
  validerParametres(parametres, contexte = {}) {
    const erreurs = [];
    if (parametres === null || typeof parametres !== 'object' || Array.isArray(parametres)) {
      return ['objet { "bacs": [...], "pieces": [...] } obligatoire'];
    }
    const { bacs, pieces } = parametres;
    for (const cle of Object.keys(parametres)) {
      if (!['bacs', 'pieces'].includes(cle)) erreurs.push(`champ "${cle}" inconnu (attendu : bacs, pieces)`);
    }
    if (!Array.isArray(bacs) || bacs.length < MIN_BACS || bacs.length > MAX_BACS || !bacs.every(estTexte)) {
      erreurs.push(`champ "bacs" : ${MIN_BACS} ou ${MAX_BACS} noms de bacs (textes non vides) attendus`);
    } else if (new Set(bacs).size !== bacs.length) {
      erreurs.push('champ "bacs" : noms de bacs en double');
    }
    if (!Array.isArray(pieces)) {
      erreurs.push(`champ "pieces" : tableau de ${MIN_PIECES} a ${MAX_PIECES} pieces obligatoire`);
      return erreurs;
    }
    if (pieces.length < MIN_PIECES || pieces.length > MAX_PIECES) {
      erreurs.push(`champ "pieces" : ${pieces.length} piece(s), il en faut de ${MIN_PIECES} a ${MAX_PIECES}`);
    }
    pieces.forEach((p, i) => {
      const ctx = `piece ${i + 1}`;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) {
        erreurs.push(`${ctx} : objet { "texte", "bac_attendu" } attendu`);
        return;
      }
      if (!estTexte(p.texte)) erreurs.push(`${ctx}, champ "texte" : texte obligatoire`);
      if (Array.isArray(bacs) && !bacs.includes(p.bac_attendu)) {
        erreurs.push(`${ctx}, champ "bac_attendu" : bac ${JSON.stringify(p.bac_attendu)} inconnu (bacs : ${bacs.join(', ')})`);
      }
      if (p.portrait !== undefined) {
        const ok = estTexte(p.portrait) && p.portrait.toLowerCase().endsWith('.svg') && !p.portrait.includes('..') && !/^([a-z]+:|\/|\\)/i.test(p.portrait);
        if (!ok) erreurs.push(`${ctx}, champ "portrait" : chemin "${p.portrait}" invalide (fichier .svg relatif au dossier du profil)`);
        else if (contexte.existe && !contexte.existe(p.portrait)) erreurs.push(`${ctx}, champ "portrait" : fichier "${p.portrait}" introuvable`);
      }
      for (const cle of Object.keys(p)) {
        if (!['texte', 'bac_attendu', 'portrait'].includes(cle)) erreurs.push(`${ctx} : champ "${cle}" inconnu`);
      }
    });
    return erreurs;
  },

  /** Resultats possibles (exploration exhaustive des tests) : 0 a N pieces bien rangees. */
  resultatsPossibles(parametres) {
    return Array.from({ length: parametres.pieces.length + 1 }, (_, i) => i);
  },

  /** Texte du resultat dans l'encadre apres le tri. */
  decrire(scene, resultat) {
    return LIBELLES.bilan(resultat, scene.parametres.pieces.length);
  },

  rendre(scene, conteneur, terminer, contexte = {}) {
    const doc = conteneur.ownerDocument;
    const el = (balise, classe, texte) => {
      const e = doc.createElement(balise);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    };
    const { bacs, pieces } = scene.parametres;
    const choix = pieces.map(() => null);
    let fini = false;

    const form = el('form', 'tri');
    form.noValidate = true;
    form.dataset.type = 'tri';
    form.append(el('p', 'consigne-choix', LIBELLES.consigne));

    // Resume des bacs : nombre de pieces rangees dans chacun.
    const resume = el('ul', 'tri-resume');
    resume.setAttribute('aria-label', LIBELLES.bacs);
    const compteurs = bacs.map((nom, j) => {
      const li = el('li', 'tri-resume-bac');
      li.dataset.bac = String(j);
      const n = el('span', 'tri-resume-nombre', '0');
      li.append(el('span', 'tri-resume-nom', nom), n);
      resume.append(li);
      return n;
    });
    form.append(resume);

    const liste = el('ol', 'tri-pieces');
    liste.setAttribute('aria-label', LIBELLES.pieces);
    const nom = `tri-${scene.id}`;
    pieces.forEach((p, i) => {
      const li = el('li', 'tri-piece');
      li.dataset.piece = String(i);
      const groupe = el('fieldset', 'tri-groupe');
      const legende = el('legend', 'tri-piece-texte');
      if (p.portrait && contexte.url) {
        const img = el('img', 'tri-piece-portrait');
        img.src = contexte.url(p.portrait);
        img.alt = '';
        img.width = 40;
        img.height = 40;
        legende.append(img);
      }
      legende.append(el('span', null, p.texte));
      groupe.append(legende);
      const ligne = el('div', 'tri-bacs');
      bacs.forEach((b, j) => {
        const label = el('label', 'tri-bac');
        label.dataset.bac = String(j);
        const radio = el('input');
        radio.type = 'radio';
        radio.name = `${nom}-${i}`;
        radio.value = String(j);
        radio.addEventListener('change', () => {
          choix[i] = b;
          li.dataset.range = String(j);
          bacs.forEach((_, k) => { compteurs[k].textContent = String(choix.filter((c) => c === bacs[k]).length); });
          if (choix.every((c) => c !== null)) manque.hidden = true;
        });
        label.append(radio, el('span', 'tri-bac-nom', b));
        ligne.append(label);
      });
      groupe.append(ligne);
      li.append(groupe);
      liste.append(li);
    });
    form.append(liste);

    const manque = el('p', 'tri-manque');
    manque.setAttribute('role', 'status');
    manque.hidden = true;
    form.append(manque);
    const valider = el('button', 'bouton bouton-principal tri-valider', LIBELLES.valider);
    valider.type = 'submit';
    form.append(valider);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      envoyer();
    });
    // Clavier : Entrée sur une pièce valide le tri (Tab et flèches sont gérés nativement par les radios).
    form.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' || ev.target?.type !== 'radio') return;
      ev.preventDefault();
      envoyer();
    });
    function envoyer() {
      if (fini) return;
      const restantes = choix.filter((c) => c === null).length;
      if (restantes > 0) {
        manque.textContent = LIBELLES.manque(restantes);
        manque.hidden = false;
        form.querySelector(`.tri-piece[data-piece="${choix.indexOf(null)}"] input`)?.focus();
        return;
      }
      fini = true;
      terminer(compter(scene.parametres, choix));
    }
    conteneur.append(form);
  },
};
