/**
 * NextDNS pour le contrôle parental : la logique, sans Firebase ni réseau
 * (tout est injecté, donc testable). La fonction appelable (nextdns.ts) ne
 * fait que brancher les vraies dépendances.
 *
 * Deux garanties portées par ce fichier, pas par la discipline :
 *   1. seul un PARENT du foyer de l'appareil passe (même règle que
 *      firestore.rules et que estParent dans le hub) ;
 *   2. la clé NextDNS, qui ouvre tout le compte, ne sert qu'à une liste FERMÉE
 *      de routes (ROUTES) : lire les sites et le quota, ajouter ou retirer un
 *      site des listes. Jamais modifier ni supprimer un profil.
 *
 * Noms de champs et chemins : genere/schema.ts (copie générée du module).
 */
import {
  ACTION_NEXTDNS,
  CHAMP_CONFIG,
  CHAMP_PRIVE_NEXTDNS,
  CHAMP_RAPPORT,
  CHAMP_SITE,
  FRAICHEUR_RAPPORT_MS,
  QUOTA_GRATUIT_NEXTDNS,
} from "./genere/schema";
import { normaliserDomaine } from "./genere/domaine";

export const BASE_NEXTDNS = "https://api.nextdns.io";
const PROFIL = "[A-Za-z0-9]{2,32}";
const DOMAINE = "[a-z0-9.-]{1,253}";

/** Les seules routes que la fonction appelle. Tout le reste est refusé avant l'envoi. */
const ROUTES: Array<{ methode: string; motif: RegExp }> = [
  { methode: "GET", motif: /^\/profiles$/ },
  { methode: "GET", motif: new RegExp(`^/profiles/${PROFIL}/analytics/(domains|status)$`) },
  { methode: "GET", motif: new RegExp(`^/profiles/${PROFIL}/(allowlist|denylist)$`) },
  { methode: "POST", motif: new RegExp(`^/profiles/${PROFIL}/(allowlist|denylist)$`) },
  { methode: "DELETE", motif: new RegExp(`^/profiles/${PROFIL}/(allowlist|denylist)/${DOMAINE}$`) },
];

export class RefusNextdns extends Error {
  constructor(
    public raison: "non-connecte" | "pas-parent" | "appareil-inconnu" | "pas-relie" | "demande-invalide" | "refus-nextdns",
    message: string,
  ) {
    super(message);
  }
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Appel NextDNS borné à ROUTES. Une réponse 200 peut porter `errors` : c'est un échec. */
export async function appelNextdns(
  f: Fetch,
  cle: string,
  base: string,
  methode: "GET" | "POST" | "DELETE",
  chemin: string,
  requete: Record<string, string> = {},
  corps?: unknown,
): Promise<unknown> {
  if (!ROUTES.some((r) => r.methode === methode && r.motif.test(chemin))) {
    throw new RefusNextdns("demande-invalide", `Route NextDNS non autorisée : ${methode} ${chemin}`);
  }
  const qs = new URLSearchParams(requete).toString();
  const reponse = await f(`${base}${chemin}${qs ? `?${qs}` : ""}`, {
    method: methode,
    headers: { "X-Api-Key": cle, ...(corps ? { "Content-Type": "application/json" } : {}) },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });
  // Retirer un site absent d'une liste n'est pas une erreur.
  if (methode === "DELETE" && reponse.status === 404) return null;
  const json = (reponse.status === 204 ? {} : await reponse.json().catch(() => ({}))) as {
    data?: unknown;
    errors?: unknown[];
  };
  if (!reponse.ok || (Array.isArray(json.errors) && json.errors.length > 0)) {
    throw new RefusNextdns("refus-nextdns", `NextDNS a refusé ${methode} ${chemin} (${reponse.status})`);
  }
  return json.data ?? null;
}

/** Même règle que firestore.rules / estParent : rôle parent, ou foyer ancien sans rôles. */
export function estParentDuFoyer(foyer: { membres?: unknown; roles?: unknown } | null, uid: string): boolean {
  if (!foyer || !Array.isArray(foyer.membres) || !foyer.membres.includes(uid)) return false;
  const roles = foyer.roles;
  if (typeof roles === "object" && roles !== null && !Array.isArray(roles)) {
    return (roles as Record<string, unknown>)[uid] === "parent";
  }
  return true;
}

/**
 * Minuit, et le 1er du mois à minuit, à Zurich, en instant UTC (la fonction
 * tourne en UTC). Les jours de changement d'heure, à une heure près.
 */
export function debutsZurich(maintenant: Date): { jour: string; debutJour: Date; debutMois: Date } {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(maintenant)
      .map((p) => [p.type, p.value]),
  );
  const commeUtc = Date.UTC(+parties.year, +parties.month - 1, +parties.day, +parties.hour, +parties.minute, +parties.second);
  const decalage = commeUtc - Math.floor(maintenant.getTime() / 1000) * 1000;
  const minuitLocal = (j: number) => new Date(Date.UTC(+parties.year, +parties.month - 1, j) - decalage);
  return {
    jour: `${parties.year}-${parties.month}-${parties.day}`,
    debutJour: minuitLocal(+parties.day),
    debutMois: minuitLocal(1),
  };
}

type Brut = Record<string, unknown>;

export interface Dependances {
  lireConfig: (appareilId: string) => Promise<Brut | null>;
  lireFoyer: (foyerId: string) => Promise<Brut | null>;
  lirePrive: (appareilId: string) => Promise<Brut | null>;
  lireRapport: (appareilId: string) => Promise<Brut | null>;
  ecrireRapport: (appareilId: string, rapport: Brut) => Promise<void>;
  fetch: Fetch;
  cle: string;
  base: string;
  maintenant: () => Date;
}

export interface Demande {
  appareilId?: unknown;
  action?: unknown;
  domaine?: unknown;
}

const ACTIONS = Object.values(ACTION_NEXTDNS) as string[];

function sites(data: unknown): Brut[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((d): d is Brut => typeof d === "object" && d !== null && typeof (d as Brut).domain === "string")
    .map((d) => ({ [CHAMP_SITE.domaine]: d.domain, [CHAMP_SITE.requetes]: typeof d.queries === "number" ? d.queries : 0 }));
}

function ids(data: unknown): string[] {
  return Array.isArray(data)
    ? data.filter((d): d is Brut => typeof d === "object" && d !== null).map((d) => String(d.id)).filter(Boolean)
    : [];
}

async function construireRapport(d: Dependances, profil: string): Promise<Brut> {
  const { jour, debutJour, debutMois } = debutsZurich(d.maintenant());
  const appel = (chemin: string, requete?: Record<string, string>) =>
    appelNextdns(d.fetch, d.cle, d.base, "GET", chemin, requete);
  const domaines = (status: string) =>
    appel(`/profiles/${profil}/analytics/domains`, { status, root: "true", from: debutJour.toISOString(), limit: "15" });

  const [visites, bloques, autorises, interdits, profils] = await Promise.all([
    domaines("default"),
    domaines("blocked"),
    appel(`/profiles/${profil}/allowlist`),
    appel(`/profiles/${profil}/denylist`),
    appel("/profiles"),
  ]);
  // Le quota gratuit vaut pour le COMPTE : on additionne tous ses profils.
  const parProfil = await Promise.all(
    ids(profils).map((p) => appel(`/profiles/${p}/analytics/status`, { from: debutMois.toISOString() })),
  );
  const requetesDuMois = parProfil
    .flatMap((x) => (Array.isArray(x) ? x : []))
    .reduce((s: number, e) => s + (typeof (e as Brut).queries === "number" ? ((e as Brut).queries as number) : 0), 0);

  return {
    [CHAMP_RAPPORT.jour]: jour,
    [CHAMP_RAPPORT.visites]: sites(visites),
    [CHAMP_RAPPORT.bloques]: sites(bloques),
    [CHAMP_RAPPORT.toujoursAutorises]: ids(autorises),
    [CHAMP_RAPPORT.toujoursBloques]: ids(interdits),
    [CHAMP_RAPPORT.requetesDuMois]: requetesDuMois,
    [CHAMP_RAPPORT.limiteDuMois]: QUOTA_GRATUIT_NEXTDNS,
    [CHAMP_RAPPORT.majLe]: d.maintenant(),
  };
}

function dateDe(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * Traite une demande d'un parent. `rapport` : sert le rapport s'il a moins de
 * cinq minutes, sinon le refait. Débloquer, bloquer, retirer : modifient les
 * listes du profil, puis refait le rapport (les listes affichées suivent).
 *
 * `ecranDuFoyer` : l'appel vient de l'écran de cuisine (jeton isDisplay) de
 * ce foyer. Il n'a droit qu'au rapport, LECTURE SEULE : jamais débloquer,
 * bloquer ni retirer un site (l'enfant a accès à l'iPad).
 */
export async function traiter(
  uid: string | undefined,
  demande: Demande,
  d: Dependances,
  ecranDuFoyer?: string,
): Promise<{ fait: true }> {
  if (!uid) throw new RefusNextdns("non-connecte", "Connexion requise");
  const appareilId = typeof demande.appareilId === "string" ? demande.appareilId : "";
  const action = typeof demande.action === "string" ? demande.action : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(appareilId) || !ACTIONS.includes(action)) {
    throw new RefusNextdns("demande-invalide", "Demande invalide");
  }
  if (ecranDuFoyer !== undefined && action !== ACTION_NEXTDNS.rapport) {
    throw new RefusNextdns("pas-parent", "Réservé aux parents du foyer");
  }

  const config = await d.lireConfig(appareilId);
  if (!config) throw new RefusNextdns("appareil-inconnu", "Appareil inconnu");
  const foyerId = config[CHAMP_CONFIG.foyer];
  if (ecranDuFoyer !== undefined) {
    if (!ecranDuFoyer || foyerId !== ecranDuFoyer) throw new RefusNextdns("pas-parent", "Réservé aux parents du foyer");
  } else {
    const foyer = typeof foyerId === "string" ? await d.lireFoyer(foyerId) : null;
    if (!estParentDuFoyer(foyer, uid)) throw new RefusNextdns("pas-parent", "Réservé aux parents du foyer");
  }

  const profil = (await d.lirePrive(appareilId))?.[CHAMP_PRIVE_NEXTDNS.profil];
  if (typeof profil !== "string" || !new RegExp(`^${PROFIL}$`).test(profil)) {
    throw new RefusNextdns("pas-relie", "NextDNS n'est pas encore relié à cet appareil");
  }

  if (action === ACTION_NEXTDNS.rapport) {
    const existant = await d.lireRapport(appareilId);
    const majLe = dateDe(existant?.[CHAMP_RAPPORT.majLe]);
    const { jour } = debutsZurich(d.maintenant());
    const frais =
      majLe &&
      existant?.[CHAMP_RAPPORT.jour] === jour &&
      d.maintenant().getTime() - majLe.getTime() < FRAICHEUR_RAPPORT_MS;
    if (!frais) await d.ecrireRapport(appareilId, await construireRapport(d, profil));
    return { fait: true };
  }

  const domaine = typeof demande.domaine === "string" ? normaliserDomaine(demande.domaine) : null;
  if (!domaine) throw new RefusNextdns("demande-invalide", "Adresse de site illisible");
  const ajouter = (liste: "allowlist" | "denylist") =>
    appelNextdns(d.fetch, d.cle, d.base, "POST", `/profiles/${profil}/${liste}`, {}, { id: domaine, active: true });
  const retirer = (liste: "allowlist" | "denylist") =>
    appelNextdns(d.fetch, d.cle, d.base, "DELETE", `/profiles/${profil}/${liste}/${domaine}`);

  // Un site n'est jamais dans les deux listes à la fois.
  if (action === ACTION_NEXTDNS.debloquer) {
    await retirer("denylist");
    await ajouter("allowlist");
  } else if (action === ACTION_NEXTDNS.bloquer) {
    await retirer("allowlist");
    await ajouter("denylist");
  } else {
    await retirer("allowlist");
    await retirer("denylist");
  }
  await d.ecrireRapport(appareilId, await construireRapport(d, profil));
  return { fait: true };
}
