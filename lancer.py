#!/usr/bin/env python3
"""Lanceur de Taxes & Furious (EX-031) : sert le dossier du jeu en HTTP local.

    python lancer.py               http://127.0.0.1:8796/
    python lancer.py --port 8797   autre port
    python lancer.py --lan         ecoute sur toutes les interfaces, affiche l'adresse LAN

Bibliotheque standard uniquement ; le dossier servi est celui de ce fichier.
"""
import argparse
import errno
import functools
import http.server
import socket
import sys
from pathlib import Path

PORT_DEFAUT = 8796
RACINE = Path(__file__).resolve().parent

TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".md": "text/plain; charset=utf-8",
}


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    # Types fixes : sous Windows, le registre peut annoncer text/plain pour .js,
    # ce qui empeche le navigateur de charger les modules ES.
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):  # noqa: A002 - signature imposee
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


class Serveur(http.server.ThreadingHTTPServer):
    # Sous Windows, SO_REUSEADDR permet a un second serveur de prendre un port deja ecoute :
    # on le desactive et on demande l'usage exclusif, pour detecter un port pris.
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def adresse_lan():
    """Adresse IPv4 de la machine sur le reseau local (aucun paquet n'est envoye)."""
    candidats = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # UDP : connect() ne fait que choisir l'interface
            candidats.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        candidats += socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        pass
    for ip in candidats:
        if not ip.startswith("127.") and not ip.startswith("0."):
            return ip
    return None


def lire_arguments(argv):
    p = argparse.ArgumentParser(description="Lance Taxes & Furious sur un serveur HTTP local.")
    p.add_argument("--port", type=int, default=PORT_DEFAUT, help=f"port d'ecoute (defaut {PORT_DEFAUT})")
    p.add_argument("--lan", action="store_true", help="ecouter sur toutes les interfaces (acces depuis le reseau local)")
    args = p.parse_args(argv)
    if not 1 <= args.port <= 65535:
        p.error("le port doit etre compris entre 1 et 65535")
    return args


def main(argv=None):
    args = lire_arguments(argv)
    hote = "0.0.0.0" if args.lan else "127.0.0.1"
    gestionnaire = functools.partial(Gestionnaire, directory=str(RACINE))
    try:
        serveur = Serveur((hote, args.port), gestionnaire)
    except OSError as e:
        pris = e.errno in (errno.EADDRINUSE, errno.EACCES) or getattr(e, "winerror", None) in (10048, 10013)
        if pris:
            print(
                f"Erreur : le port {args.port} est deja utilise (ou interdit). "
                f"Fermez l'autre programme ou choisissez un autre port : python lancer.py --port {args.port + 1}",
                file=sys.stderr,
            )
        else:
            print(f"Erreur : impossible d'ecouter sur le port {args.port} : {e}", file=sys.stderr)
        return 1

    print(f"Taxes & Furious : http://127.0.0.1:{args.port}/", flush=True)
    if args.lan:
        ip = adresse_lan()
        if ip:
            print(f"Sur le reseau local : http://{ip}:{args.port}/", flush=True)
        else:
            print("Adresse LAN introuvable (machine sans reseau ?)", flush=True)
    print("Ctrl+C pour arreter.", flush=True)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        serveur.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
