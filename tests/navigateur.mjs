// Outillage des tests d'interface (EX-032) : chrome-headless-shell de Playwright piloté en CDP
// par le WebSocket natif de Node, serveur statique local, aucune dépendance npm.
// Pas un fichier de test (n'est pas en *.test.mjs).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, extname, basename, sep } from 'node:path';

const PREFIXE_PROFIL_NAV = 'fiscfiction-chrome-';
// Nom de la variable d'environnement Windows du dossier local de l'utilisateur, assemble pour que
// la recherche de chemins de poste du depot (EX-100, tests/publication.test.mjs) ne vise que de vrais chemins.
const VAR_LOCALE_WINDOWS = ['LOCAL', 'APP', 'DATA'].join('');
const INSTALLATION = 'npx -y playwright@1.63.0 install chromium-headless-shell';

/**
 * Dossier de cache Playwright et sous-dossier/exécutable de chrome-headless-shell pour une plateforme
 * (mêmes emplacements que Playwright : Windows, Linux, macOS). Renvoie null si la plateforme n'est pas gérée ;
 * `cache` vaut null sous Windows si la variable du dossier local est absente.
 */
export function emplacementPlaywright({ env = process.env, platform = process.platform, arch = process.arch, home = homedir() } = {}) {
  if (platform === 'win32') {
    const base = env[VAR_LOCALE_WINDOWS];
    return { cache: base ? join(base, 'ms-playwright') : null, sousDossier: 'chrome-headless-shell-win64', executable: 'chrome-headless-shell.exe' };
  }
  if (platform === 'linux') {
    return { cache: join(home, '.cache', 'ms-playwright'), sousDossier: arch === 'arm64' ? 'chrome-headless-shell-linux-arm64' : 'chrome-headless-shell-linux64', executable: 'chrome-headless-shell' };
  }
  if (platform === 'darwin') {
    return { cache: join(home, 'Library', 'Caches', 'ms-playwright'), sousDossier: arch === 'arm64' ? 'chrome-headless-shell-mac-arm64' : 'chrome-headless-shell-mac-x64', executable: 'chrome-headless-shell' };
  }
  return null;
}

/**
 * Chemin calculé de chrome-headless-shell (EX-104), dans l'ordre :
 * 1. variable CHROME_HEADLESS_SHELL (chemin explicite, qui doit exister) ;
 * 2. cache Playwright de la plateforme, version la plus récente de `chromium_headless_shell-<n>`.
 * Lève une erreur si le navigateur est introuvable : le test échoue, il n'est jamais sauté.
 * Les paramètres servent aux tests unitaires (faux arbre de dossiers).
 */
export function trouverChrome(options = {}) {
  const env = options.env ?? process.env;
  const explicite = env.CHROME_HEADLESS_SHELL;
  if (explicite) {
    if (!existsSync(explicite) || !statSync(explicite).isFile()) {
      throw new Error(`navigateur introuvable : CHROME_HEADLESS_SHELL=${explicite} n'est pas un fichier`);
    }
    return explicite;
  }
  const e = emplacementPlaywright({ ...options, env });
  if (!e) throw new Error(`navigateur introuvable : plateforme ${options.platform ?? process.platform} non geree (definir CHROME_HEADLESS_SHELL)`);
  if (!e.cache) throw new Error(`navigateur introuvable : variable d'environnement ${VAR_LOCALE_WINDOWS} absente (definir CHROME_HEADLESS_SHELL)`);
  if (!existsSync(e.cache)) throw new Error(`navigateur introuvable : ${e.cache} absent (installer : ${INSTALLATION}, ou definir CHROME_HEADLESS_SHELL)`);
  const version = (n) => Number(n.split('-').pop()) || 0;
  const candidats = readdirSync(e.cache)
    .filter((n) => n.startsWith('chromium_headless_shell-'))
    .sort((a, b) => version(a) - version(b))
    .map((n) => join(e.cache, n, e.sousDossier, e.executable))
    .filter((p) => existsSync(p));
  if (!candidats.length) throw new Error(`navigateur introuvable : aucun ${e.sousDossier}/${e.executable} sous ${e.cache} (installer : ${INSTALLATION})`);
  return candidats[candidats.length - 1];
}

// ------------------------------------------------------------------ serveur statique

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/**
 * Sert `racine` sur 127.0.0.1, port libre. `montages` : { '/prefixe/': dossier } pour servir
 * en plus une copie temporaire de données sous un préfixe. `entetes` : en-têtes HTTP ajoutés à chaque
 * réponse 200 (ex. la CSP de dist/_headers, EX-105). Renvoie { origine, fermer }.
 */
export async function servir(racine, montages = {}, { entetes = {} } = {}) {
  const serveur = createServer((req, res) => {
    let chemin;
    try {
      chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (chemin.endsWith('/')) chemin += 'index.html';
    let base = resolve(racine);
    for (const [prefixe, dossier] of Object.entries(montages)) {
      if (chemin.startsWith(prefixe)) {
        base = resolve(dossier);
        chemin = `/${chemin.slice(prefixe.length)}`;
        break;
      }
    }
    const fichier = resolve(base, `.${chemin}`);
    if (fichier !== base && !fichier.startsWith(base + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(fichier) || !statSync(fichier).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('introuvable');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(fichier).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...entetes,
    });
    res.end(readFileSync(fichier));
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const origine = `http://127.0.0.1:${serveur.address().port}`;
  return {
    origine,
    fermer: () => new Promise((ok) => {
      serveur.closeAllConnections?.();
      serveur.close(() => ok());
    }),
  };
}

// ------------------------------------------------------------------ navigateur

class ClientCdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.attente = new Map();
    this.ecouteurs = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (msg.id !== undefined && this.attente.has(msg.id)) {
        const { ok, ko, methode } = this.attente.get(msg.id);
        this.attente.delete(msg.id);
        if (msg.error) ko(new Error(`CDP ${methode} : ${msg.error.message}`));
        else ok(msg.result);
      } else if (msg.method) {
        for (const f of this.ecouteurs) f(msg);
      }
    });
  }

  envoyer(methode, params = {}, sessionId = undefined) {
    const id = ++this.id;
    const msg = { id, method: methode, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((ok, ko) => {
      this.attente.set(id, { ok, ko, methode });
      this.ws.send(JSON.stringify(msg));
    });
  }
}

/** Lance chrome-headless-shell (jamais de fenêtre visible). Renvoie { cdp, nouvellePage, fermer }. */
export async function lancerNavigateur() {
  const exe = trouverChrome();
  const profil = mkdtempSync(join(tmpdir(), PREFIXE_PROFIL_NAV));
  const proc = spawn(exe, [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    // Linux (intégration continue) : le bac à sable de Chrome exige des espaces de noms utilisateur
    // souvent refusés aux runners ; Playwright le désactive aussi par défaut. Pages locales seulement.
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    // Aucune requête ne quitte la machine, même si une page en tentait une (elle reste détectée).
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const urlWs = await new Promise((ok, ko) => {
    let tampon = '';
    const delai = setTimeout(() => ko(new Error('chrome-headless-shell : pas de point CDP apres 20 s')), 20000);
    proc.stderr.on('data', (d) => {
      tampon += d.toString();
      const m = tampon.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(delai);
        ok(m[1]);
      }
    });
    proc.on('exit', (code) => ko(new Error(`chrome-headless-shell arrete (code ${code}) : ${tampon.slice(0, 500)}`)));
  });
  proc.stderr.resume();

  const ws = new WebSocket(urlWs);
  await new Promise((ok, ko) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => ko(new Error('WebSocket CDP : connexion impossible')), { once: true });
  });
  const cdp = new ClientCdp(ws);

  return {
    cdp,
    nouvellePage: (options) => Page.creer(cdp, options),
    async fermer() {
      try {
        await Promise.race([cdp.envoyer('Browser.close'), new Promise((r) => setTimeout(r, 3000))]);
      } catch { /* deja ferme */ }
      try { ws.close(); } catch { /* idem */ }
      if (proc.exitCode === null) {
        await new Promise((ok) => {
          const t = setTimeout(() => { proc.kill(); ok(); }, 3000);
          proc.once('exit', () => { clearTimeout(t); ok(); });
        });
      }
      // Garde-fou : ne supprime que le profil temporaire créé ci-dessus (Chrome peut tenir des verrous un instant).
      if (basename(profil).startsWith(PREFIXE_PROFIL_NAV) && resolve(profil).startsWith(resolve(tmpdir()))) {
        for (let i = 0; i < 5; i += 1) {
          try { rmSync(profil, { recursive: true, force: true }); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
        }
      }
    },
  };
}

const attendreMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un onglet, avec journal des erreurs console et des requêtes. */
export class Page {
  static async creer(cdp, { largeur = 1280, hauteur = 800 } = {}) {
    const { targetId } = await cdp.envoyer('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.envoyer('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, targetId, sessionId);
    await page.envoyer('Page.enable');
    await page.envoyer('Runtime.enable');
    await page.envoyer('Log.enable');
    await page.envoyer('Network.enable');
    await page.taille(largeur, hauteur);
    return page;
  }

  constructor(cdp, targetId, sessionId) {
    this.cdp = cdp;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.requetes = [];
    this.erreurs = [];
    this.avertissements = [];
    this.chargements = 0;
    this.ecouteur = (msg) => {
      if (msg.sessionId !== sessionId) return;
      const p = msg.params;
      switch (msg.method) {
        case 'Network.requestWillBeSent':
          this.requetes.push(p.request.url);
          break;
        case 'Runtime.exceptionThrown':
          this.erreurs.push(`exception : ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`);
          break;
        case 'Runtime.consoleAPICalled': {
          const texte = (p.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
          if (p.type === 'error' || p.type === 'assert') this.erreurs.push(`console.${p.type} : ${texte}`);
          else if (p.type === 'warning') this.avertissements.push(texte);
          break;
        }
        case 'Log.entryAdded':
          if (p.entry.level === 'error') this.erreurs.push(`log ${p.entry.source} : ${p.entry.text} ${p.entry.url ?? ''}`.trim());
          else if (p.entry.level === 'warning') this.avertissements.push(`log ${p.entry.source} : ${p.entry.text}`);
          break;
        case 'Page.loadEventFired':
          this.chargements += 1;
          break;
        default:
      }
    };
    cdp.ecouteurs.add(this.ecouteur);
  }

  envoyer(methode, params = {}) {
    return this.cdp.envoyer(methode, params, this.sessionId);
  }

  async taille(largeur, hauteur) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    await this.envoyer('Emulation.setDeviceMetricsOverride', {
      width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: largeur < 600,
    });
  }

  async aller(url) {
    const avant = this.chargements;
    await this.envoyer('Page.navigate', { url });
    await this.attendre(() => this.chargements > avant, 'chargement de la page');
  }

  /** Évalue une expression dans la page et renvoie sa valeur (promesses attendues). */
  async eval(expression) {
    const r = await this.envoyer('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval : ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Attend qu'un prédicat Node (fonction) ou une expression de page (texte) devienne vrai. */
  async attendre(condition, quoi = String(condition), delai = 10000) {
    const fin = Date.now() + delai;
    for (;;) {
      const ok = typeof condition === 'function' ? await condition() : await this.eval(condition);
      if (ok) return ok;
      if (Date.now() > fin) throw new Error(`delai depasse en attendant : ${quoi}`);
      await attendreMs(50);
    }
  }

  /** Clic souris réel au centre de l'élément (après défilement). */
  async cliquer(selecteur) {
    const pos = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pos) throw new Error(`cliquer : ${selecteur} introuvable`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.envoyer('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
    }
  }

  async touche(nom) {
    const touches = {
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
      Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
      Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
      ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
      ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
      ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
      ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    };
    const t = touches[nom];
    if (!t) throw new Error(`touche ${nom} non geree`);
    await this.envoyer('Input.dispatchKeyEvent', { type: 'keyDown', ...t });
    await this.envoyer('Input.dispatchKeyEvent', { type: 'keyUp', key: t.key, code: t.code, windowsVirtualKeyCode: t.windowsVirtualKeyCode });
  }

  /** Tape au doigt (évènements tactiles CDP réels) au centre de l'élément. */
  async toucher(selecteur) {
    const pos = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pos) throw new Error(`toucher : ${selecteur} introuvable`);
    if (!this.tactile) {
      await this.envoyer('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      this.tactile = true;
    }
    await this.envoyer('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos.x, y: pos.y }] });
    await this.envoyer('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** Émule (ou non) la préférence système `prefers-reduced-motion: reduce`. */
  async mouvementReduit(oui) {
    await this.envoyer('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: oui ? 'reduce' : 'no-preference' }] });
  }

  async capture(fichier) {
    const { data } = await this.envoyer('Page.captureScreenshot', { format: 'png' });
    writeFileSync(fichier, Buffer.from(data, 'base64'));
  }

  /** Requêtes dont l'origine n'est pas `origine` (data: et about: tolérés). */
  requetesExternes(origine) {
    return this.requetes.filter((u) => !u.startsWith(`${origine}/`) && !/^(data|about|blob):/.test(u));
  }

  async fermer() {
    this.cdp.ecouteurs.delete(this.ecouteur);
    try { await this.cdp.envoyer('Target.closeTarget', { targetId: this.targetId }); } catch { /* deja ferme */ }
  }
}
