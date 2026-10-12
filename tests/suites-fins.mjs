// Suites de choix explicites qui atteignent chaque fin de chaque profil de data/ (C2).
// Reutilisables par les tests d'interface (C4). Generees par exploration exhaustive, puis figees ici.
// Un nombre est le resultat d'un mini-jeu (EX-110) : pour le tri (EX-112), le nombre de pieces bien rangees.
// Chaque choix ajoute au tronc (3 ou 4 choix par scene, EX-142) figure dans au moins une suite :
// il est donc joue dans le navigateur, encadre de la loi compris.
export const SUITES_FINS = {
  restaurateur: {
    'restaurateur-fin-etoile': ['avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'carte-s1-a', 'carte-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'restaurateur-fin-addition': ['avis-s1-c', 'avis-s2-b', 'avis-s3-c', 'avis-s4-c', 'caisse-s1-c', 'caisse-s2-b', 'fec-s1-a', 'fec-s2-c', 'fec-s3-a', 'carte-s1-a', 'carte-s2-a', 'rectification-s1-d', 'rectification-s2-c', 'rectification-s3-c'],
    'fin-sereine': ['avis-s1-a', 'avis-s2-c', 'avis-s3-b', 'avis-s4-b', 'caisse-s1-a', 'caisse-s2-a', 'fec-s1-c', 'fec-s2-a', 'fec-s3-a', 'carte-s1-a', 'carte-s2-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'caisse-s1-c', 'caisse-s2-b', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'carte-s1-b', 'carte-s2-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-patience': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'caisse-s1-c', 'caisse-s2-b', 'fec-s1-b'],
  },
  influenceuse: {
    'influenceuse-fin-sans-filtre': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'partenariats-s1-b', 'partenariats-s2-a', 'partenariats-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'residence-s1-a', 'residence-s2-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'influenceuse-fin-deconnexion': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'partenariats-s1-b', 'partenariats-s2-b', 'partenariats-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-c', 'residence-s1-b', 'residence-s2-a', 'rectification-s1-c', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-sereine': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'partenariats-s1-a', 'partenariats-s2-b', 'partenariats-s3-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'residence-s1-a', 'residence-s2-a', 'rectification-s1-b', 'rectification-s2-b', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'partenariats-s1-b', 'partenariats-s2-b', 'partenariats-s3-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'residence-s1-a', 'residence-s2-b', 'rectification-s1-c', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-patience': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'partenariats-s1-b', 'partenariats-s2-b', 'partenariats-s3-b'],
  },
  plombier: {
    'plombier-fin-etanche': ['ouverture-s1-a', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-a', 'devis-s2-a', 5, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'chantier-s1-a', 'chantier-s2-a', 'chantier-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'plombier-fin-kevin': ['ouverture-s1-a', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-a', 'devis-s2-a', 3, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'chantier-s1-a', 'chantier-s2-a', 'chantier-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'plombier-fin-degat-des-eaux': ['ouverture-s1-c', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-c', 'devis-s2-b', 0, 'fec-s1-a', 'fec-s2-a', 'fec-s3-b', 'chantier-s1-a', 'chantier-s2-a', 'chantier-s3-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-sereine': ['ouverture-s1-a', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-a', 'devis-s2-a', 5, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'chantier-s1-a', 'chantier-s2-a', 'chantier-s3-a', 'rectification-s1-a', 'rectification-s2-b', 'rectification-s3-a'],
    'fin-defaut': ['ouverture-s1-b', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-a', 'devis-s2-c', 5, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'chantier-s1-c', 'chantier-s2-c', 'chantier-s3-c', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-patience': ['ouverture-s1-b', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'devis-s1-a', 'devis-s2-a', 5, 'fec-s1-b', 'fec-s2-b', 'fec-s3-c', 'chantier-s1-b', 'chantier-s2-b', 'chantier-s3-b'],
  },
  consultant: {
    'consultant-fin-burn': ['kick-off-s1-a', 'kick-off-s2-a', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'train-de-vie-s1-a', 'train-de-vie-s2-a', 0, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'remuneration-s1-a', 'remuneration-s2-b', 'rectification-s1-c', 'rectification-s2-c', 'rectification-s3-b'],
    'consultant-fin-pivot': ['kick-off-s1-a', 'kick-off-s2-a', 'avis-s1-c', 'avis-s2-b', 'avis-s3-b', 'avis-s4-b', 'train-de-vie-s1-a', 'train-de-vie-s2-a', 6, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'remuneration-s1-a', 'remuneration-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'consultant-fin-dictionnaire': ['kick-off-s1-b', 'kick-off-s2-b', 'avis-s1-b', 'avis-s3-c', 'avis-s4-c', 'train-de-vie-s1-a', 'train-de-vie-s2-a', 4, 'fec-s1-c', 'fec-s2-b', 'fec-s3-c', 'remuneration-s1-a', 'remuneration-s2-a', 'rectification-s1-b', 'rectification-s2-b', 'rectification-s3-c'],
    'fin-sereine': ['kick-off-s1-a', 'kick-off-s2-a', 'avis-s1-a', 'avis-s2-c', 'avis-s3-a', 'avis-s4-a', 'train-de-vie-s1-a', 'train-de-vie-s2-a', 6, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'remuneration-s1-a', 'remuneration-s2-a', 'rectification-s1-d', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-defaut': ['kick-off-s1-a', 'kick-off-s2-a', 'avis-s1-a', 'avis-s2-a', 'avis-s3-a', 'avis-s4-a', 'train-de-vie-s1-a', 'train-de-vie-s2-c', 5, 'fec-s1-b', 'fec-s2-c', 'fec-s3-b', 'remuneration-s1-a', 'remuneration-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-patience': ['kick-off-s1-c', 'kick-off-s2-c', 'avis-s1-b', 'avis-s3-a', 'avis-s4-a', 'train-de-vie-s1-b', 'train-de-vie-s2-b', 1, 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'remuneration-s1-b', 'remuneration-s2-c'],
  },
  coiffeuse: {
    'coiffeuse-fin-brushing': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'especes-s1-b', 'especes-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'salon-s1-a', 'salon-s2-a', 'salon-s3-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'coiffeuse-fin-decoiffee': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'especes-s1-b', 'especes-s2-b', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'salon-s1-a', 'salon-s2-b', 'salon-s3-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-sereine': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'especes-s1-a', 'especes-s2-a', 'fec-s1-a', 'fec-s2-a', 'fec-s3-a', 'salon-s1-a', 'salon-s2-a', 'salon-s3-a', 'rectification-s1-b', 'rectification-s2-b', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'especes-s1-b', 'especes-s2-b', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'salon-s1-a', 'salon-s2-a', 'salon-s3-b', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-b'],
    'fin-patience': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'especes-s1-b', 'especes-s2-b', 'fec-s1-b'],
  },
  galeriste: {
    'galeriste-fin-chef-oeuvre': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'oeuvres-s1-a', 'oeuvres-s2-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'campagne-s1-a', 'campagne-s2-a', 'rectification-s1-a', 'rectification-s2-a', 'rectification-s3-a'],
    'galeriste-fin-vente-forcee': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'oeuvres-s1-b', 'oeuvres-s2-a', 'fec-s1-b', 'fec-s2-a', 'fec-s3-a', 'campagne-s1-b', 'campagne-s2-a', 'rectification-s1-c', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-sereine': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'oeuvres-s1-a', 'oeuvres-s2-a', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'campagne-s1-a', 'campagne-s2-a', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-defaut': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'oeuvres-s1-b', 'oeuvres-s2-b', 'fec-s1-a', 'fec-s2-b', 'fec-s3-a', 'campagne-s1-a', 'campagne-s2-b', 'rectification-s1-b', 'rectification-s2-a', 'rectification-s3-a'],
    'fin-patience': ['avis-s1-b', 'avis-s3-b', 'avis-s4-b', 'oeuvres-s1-b', 'oeuvres-s2-b', 'fec-s1-b'],
  },
};
