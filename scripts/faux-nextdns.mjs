#!/usr/bin/env node
/**
 * Faux NextDNS local, pour essayer l'écran « PC des enfants » avec les
 * émulateurs sans compte ni clé réels. Répond aux seules routes que la
 * fonction nextdnsAppareil appelle, garde ses listes en mémoire, et refuse
 * toute requête sans la clé d'essai. Mode d'emploi : docs/controle-parental/SIMULATEUR.md.
 *
 *   node scripts/faux-nextdns.mjs [--port 7777] [--requetes 48000]
 *
 * `--requetes` fixe le nombre de requêtes du mois (246000 déclenche l'alerte de quota).
 */
import { createServer } from "node:http";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, t) => (a.startsWith("--") ? [...acc, [a.slice(2), t[i + 1]]] : acc), []),
);
const PORT = Number(args.port ?? 7777);
const REQUETES = Number(args.requetes ?? 48_000);
export const CLE_ESSAI = "cle-emulateur";

const listes = { allowlist: new Set(["index-education.net"]), denylist: new Set(["jeu-en-ligne.example"]) };
const VISITES = [
  ["google.com", 120],
  ["youtube.com", 64],
  ["index-education.net", 41],
  ["wikipedia.org", 23],
  ["scratch.mit.edu", 12],
  ["khanacademy.org", 9],
];
const BLOQUES = [
  ["jeu-en-ligne.example", 7],
  ["tiktok.com", 3],
];

const site = ([domain, queries]) => ({ domain, root: domain, queries });

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const repondre = (status, corps) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(corps === undefined ? "" : JSON.stringify(corps));
    console.log(`${req.method} ${url.pathname}${url.search} → ${status}`);
  };
  if (req.headers["x-api-key"] !== CLE_ESSAI) return repondre(403, { errors: [{ code: "forbidden" }] });

  let corps = "";
  req.on("data", (c) => (corps += c));
  req.on("end", () => {
    const p = url.pathname;
    let m;
    if (req.method === "GET" && p === "/profiles") return repondre(200, { data: [{ id: "essaiPc", name: "PC des enfants" }] });
    if (req.method === "GET" && /\/analytics\/status$/.test(p)) {
      return repondre(200, { data: [{ status: "default", queries: Math.round(REQUETES * 0.9) }, { status: "blocked", queries: REQUETES - Math.round(REQUETES * 0.9) }] });
    }
    if (req.method === "GET" && /\/analytics\/domains$/.test(p)) {
      const bloques = url.searchParams.get("status") === "blocked";
      const base = bloques ? BLOQUES.filter(([d]) => !listes.allowlist.has(d)) : VISITES.filter(([d]) => !listes.denylist.has(d));
      return repondre(200, { data: base.map(site) });
    }
    if ((m = /^\/profiles\/\w+\/(allowlist|denylist)$/.exec(p))) {
      if (req.method === "GET") return repondre(200, { data: [...listes[m[1]]].map((id) => ({ id, active: true })) });
      if (req.method === "POST") {
        const { id } = JSON.parse(corps || "{}");
        if (!id) return repondre(200, { errors: [{ code: "invalid" }] });
        listes[m[1]].add(id);
        return repondre(200, { data: { id, active: true } });
      }
    }
    if (req.method === "DELETE" && (m = /^\/profiles\/\w+\/(allowlist|denylist)\/(.+)$/.exec(p))) {
      return listes[m[1]].delete(m[2]) ? repondre(204) : repondre(404, { errors: [{ code: "notFound" }] });
    }
    return repondre(404, { errors: [{ code: "notFound" }] });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Faux NextDNS sur http://127.0.0.1:${PORT} (${REQUETES} requêtes ce mois-ci)`));
