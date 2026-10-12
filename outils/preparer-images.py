#!/usr/bin/env python3
"""Preparation des illustrations du jeu (EX-155) : conversion WebP, redimensionnement,
detourage des portraits et controle des poids d'EX-153.

Outil local : il demande Pillow (pip install pillow), qui n'est PAS une dependance du jeu
(le jeu reste statique, sans dependance). Usage :

  python outils/preparer-images.py decor <image> <sortie.webp> [--largeur 1600]
      Recadre au format 16:9 (centre), redimensionne a la largeur demandee (1280 a 1600 px),
      encode en WebP a la meilleure qualite qui tient sous 250 Ko.

  python outils/preparer-images.py portrait <image> <sortie.webp> [--tolerance 24] [--marge 0.04]
      Detoure le fond blanc par remplissage depuis les 4 coins (les blancs entoures par le
      personnage restent opaques : pas de seuil global), recadre sur le personnage, le centre
      dans un carre transparent de 512 px, encode en WebP sous 80 Ko.

  python outils/preparer-images.py verifier [<dossier de donnees>]
      Controle d'EX-153 sur tous les .webp du dossier (data/ par defaut) : decor (dossier
      decors/) <= 250 Ko et 1280 a 1600 px de large, portrait (dossier img/) carre 512 px
      <= 80 Ko, total <= 6 Mo. Code de sortie 1 au premier ecart.
"""

import argparse
import io
import sys
from pathlib import Path

RACINE_DEPOT = Path(__file__).resolve().parent.parent

# EX-153 (memes valeurs que outils/valider.mjs).
DECOR_MAX_OCTETS = 250 * 1024
DECOR_LARGEUR_MIN = 1280
DECOR_LARGEUR_MAX = 1600
PORTRAIT_COTE = 512
PORTRAIT_MAX_OCTETS = 80 * 1024
TOTAL_MAX_OCTETS = 6 * 1024 * 1024
QUALITES = (90, 86, 82, 78, 74, 70, 65, 60, 55, 50, 45, 40)


def charger_pillow():
    try:
        from PIL import Image, ImageChops, ImageDraw, ImageFilter, features
    except ImportError:
        sys.exit("preparer-images : Pillow est requis (pip install pillow) ; outil local, pas une dependance du jeu.")
    if not features.check("webp"):
        sys.exit("preparer-images : Pillow est installe sans prise en charge du WebP.")
    return Image, ImageChops, ImageDraw, ImageFilter


def encoder_sous_plafond(image, plafond, **options):
    """WebP a la meilleure qualite de QUALITES qui tient sous `plafond` octets ; (octets, qualite)."""
    for q in QUALITES:
        tampon = io.BytesIO()
        image.save(tampon, "WEBP", quality=q, method=6, **options)
        if tampon.tell() <= plafond:
            return tampon.getvalue(), q
    raise SystemExit(f"preparer-images : impossible de descendre sous {plafond // 1024} Ko (qualite {QUALITES[-1]} essayee)")


def ecrire(sortie, octets):
    sortie = Path(sortie)
    if sortie.suffix.lower() != ".webp":
        raise SystemExit(f"preparer-images : la sortie doit etre un fichier .webp ({sortie})")
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_bytes(octets)


# ------------------------------------------------------------------ decor

def preparer_decor(entree, sortie, largeur=DECOR_LARGEUR_MAX):
    Image, _, _, _ = charger_pillow()
    if not DECOR_LARGEUR_MIN <= largeur <= DECOR_LARGEUR_MAX:
        raise SystemExit(f"preparer-images : largeur {largeur} hors de {DECOR_LARGEUR_MIN} a {DECOR_LARGEUR_MAX} px")
    image = Image.open(entree).convert("RGB")
    l, h = image.size
    # Recadrage 16:9 centre.
    if l * 9 > h * 16:
        nl = h * 16 // 9
        image = image.crop(((l - nl) // 2, 0, (l - nl) // 2 + nl, h))
    elif l * 9 < h * 16:
        nh = l * 9 // 16
        image = image.crop((0, (h - nh) // 2, l, (h - nh) // 2 + nh))
    hauteur = round(largeur * 9 / 16)
    image = image.resize((largeur, hauteur), Image.LANCZOS)
    octets, q = encoder_sous_plafond(image, DECOR_MAX_OCTETS)
    ecrire(sortie, octets)
    return {"sortie": str(sortie), "largeur": largeur, "hauteur": hauteur, "octets": len(octets), "qualite": q}


# ------------------------------------------------------------------ portrait

def masque_fond(image, tolerance):
    """Masque L du fond : 255 = fond (blanc relie a un coin), 0 = personnage.

    Remplissage depuis les 4 coins sur les pixels presque blancs : un blanc entoure par le
    personnage (yeux, chemise) n'est pas relie aux coins et reste opaque.
    """
    _, ImageChops, ImageDraw, _ = charger_pillow()
    rgb = image.convert("RGB")
    seuil = 255 - tolerance
    r, g, b = rgb.split()
    clair = [canal.point(lambda v: 255 if v >= seuil else 0) for canal in (r, g, b)]
    candidats = ImageChops.multiply(ImageChops.multiply(clair[0], clair[1]), clair[2])  # 255 si les 3 canaux sont clairs
    l, h = candidats.size
    for coin in ((0, 0), (l - 1, 0), (0, h - 1), (l - 1, h - 1)):
        if candidats.getpixel(coin) == 255:
            ImageDraw.floodfill(candidats, coin, 128, thresh=0)
    return candidats.point(lambda v: 255 if v == 128 else 0)


def preparer_portrait(entree, sortie, tolerance=24, marge=0.04):
    Image, ImageChops, _, ImageFilter = charger_pillow()
    image = Image.open(entree).convert("RGBA")
    fond = masque_fond(image, tolerance)
    if fond.getbbox() is None:
        raise SystemExit("preparer-images : aucun fond blanc touchant les coins (fond blanc uni attendu, charte 9.1)")
    # Alpha : 0 sur le fond ; liseré d'1 px autour du personnage adouci (pas de halo blanc dur).
    alpha_origine = image.getchannel("A")
    opaque = ImageChops.invert(fond)
    bord = ImageChops.subtract(fond.filter(ImageFilter.MaxFilter(3)), fond)  # 1 px de personnage contre le fond
    alpha = ImageChops.multiply(alpha_origine, opaque)
    alpha = ImageChops.subtract(alpha, bord.point(lambda v: 96 if v else 0))
    image.putalpha(alpha)
    boite = alpha.getbbox()
    if boite is None:
        raise SystemExit("preparer-images : image vide apres detourage")
    image = image.crop(boite)
    l, h = image.size
    cote = round(max(l, h) * (1 + 2 * marge))
    carre = Image.new("RGBA", (cote, cote), (255, 255, 255, 0))
    carre.paste(image, ((cote - l) // 2, (cote - h) // 2), image)
    carre = carre.resize((PORTRAIT_COTE, PORTRAIT_COTE), Image.LANCZOS)
    octets, q = encoder_sous_plafond(carre, PORTRAIT_MAX_OCTETS, alpha_quality=90, exact=False)
    ecrire(sortie, octets)
    return {"sortie": str(sortie), "largeur": PORTRAIT_COTE, "hauteur": PORTRAIT_COTE, "octets": len(octets), "qualite": q}


# ------------------------------------------------------------------ verification EX-153

def verifier(racine):
    Image, _, _, _ = charger_pillow()
    racine = Path(racine)
    erreurs = []
    total = 0
    fichiers = sorted(p for p in racine.rglob("*.webp") if p.is_file())
    for f in fichiers:
        rel = f.relative_to(racine).as_posix()
        taille = f.stat().st_size
        total += taille
        try:
            with Image.open(f) as im:
                if im.format != "WEBP":
                    erreurs.append(f"{rel} : pas un fichier WebP ({im.format})")
                    continue
                l, h = im.size
        except Exception as e:  # image illisible
            erreurs.append(f"{rel} : illisible ({e})")
            continue
        parties = f.relative_to(racine).parts
        if "decors" in parties:
            if taille > DECOR_MAX_OCTETS:
                erreurs.append(f"{rel} : decor de {-(-taille // 1024)} Ko (plafond {DECOR_MAX_OCTETS // 1024} Ko)")
            if not DECOR_LARGEUR_MIN <= l <= DECOR_LARGEUR_MAX:
                erreurs.append(f"{rel} : decor de {l} px de large (de {DECOR_LARGEUR_MIN} a {DECOR_LARGEUR_MAX} px)")
        elif "img" in parties:
            if taille > PORTRAIT_MAX_OCTETS:
                erreurs.append(f"{rel} : portrait de {-(-taille // 1024)} Ko (plafond {PORTRAIT_MAX_OCTETS // 1024} Ko)")
            if (l, h) != (PORTRAIT_COTE, PORTRAIT_COTE):
                erreurs.append(f"{rel} : portrait de {l}x{h} px (carre {PORTRAIT_COTE}x{PORTRAIT_COTE} attendu)")
        print(f"{rel} : {l}x{h}, {taille} octets")
    if total > TOTAL_MAX_OCTETS:
        erreurs.append(f"total des .webp : {total} octets (plafond {TOTAL_MAX_OCTETS} octets, 6 Mo)")
    for e in erreurs:
        print(e, file=sys.stderr)
    print(f"{len(fichiers)} fichier(s) .webp, total {total} octets ; {len(erreurs)} ecart(s)")
    return 1 if erreurs else 0


def principal(argv=None):
    parseur = argparse.ArgumentParser(prog="preparer-images", description="Preparation des illustrations du jeu (EX-155).")
    sous = parseur.add_subparsers(dest="commande", required=True)
    d = sous.add_parser("decor", help="decor 16:9 en WebP <= 250 Ko")
    d.add_argument("entree")
    d.add_argument("sortie")
    d.add_argument("--largeur", type=int, default=DECOR_LARGEUR_MAX)
    p = sous.add_parser("portrait", help="portrait detoure, carre 512 px, WebP <= 80 Ko")
    p.add_argument("entree")
    p.add_argument("sortie")
    p.add_argument("--tolerance", type=int, default=24, help="ecart au blanc pur accepte pour le fond (0 a 80)")
    p.add_argument("--marge", type=float, default=0.04, help="marge transparente autour du personnage (part du cote)")
    v = sous.add_parser("verifier", help="controle des poids et formats d'EX-153")
    v.add_argument("racine", nargs="?", default=str(RACINE_DEPOT / "data"))
    a = parseur.parse_args(argv)
    if a.commande == "decor":
        r = preparer_decor(a.entree, a.sortie, a.largeur)
    elif a.commande == "portrait":
        if not 0 <= a.tolerance <= 80:
            raise SystemExit("preparer-images : --tolerance de 0 a 80")
        r = preparer_portrait(a.entree, a.sortie, a.tolerance, a.marge)
    else:
        return verifier(a.racine)
    print(f"{r['sortie']} : {r['largeur']}x{r['hauteur']}, {r['octets']} octets (qualite {r['qualite']})")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
