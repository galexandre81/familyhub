import { useEffect, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import {
  CLE_JOUR,
  MODES,
  PLANNING_DEFAUT,
  VALEUR,
  associerCompteAppareil,
  enregistrerAppli,
  enregistrerExecutablesInconnus,
  enregistrerLimites,
  enregistrerNomsParents,
  enregistrerPlanning,
  heureValide,
  type Appli,
  type Categorie,
  type ConfigAppareil,
  type EtatAppareil,
  type ExecutablesInconnus,
  type Plage,
  type Planning,
  type RapportNextdns,
  type Reglage,
} from "@family-hub/controle-parental";
import { db } from "../../lib/firebase";
import ListesDeSites from "./ListesDeSites";
import { envoyer, refuser } from "../../lib/controleParental/envoyer";
import { LIBELLE_CATEGORIE, NOM_PARENT_MAX, libelleMode } from "../../lib/controleParental/phrases";

/** Libellés dans l'ordre de CLE_JOUR (dimanche d'abord, comme Date.getDay). */
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
/** Affichage du lundi au dimanche. */
const ORDRE = [1, 2, 3, 4, 5, 6, 0];

const CATEGORIES = Object.entries(LIBELLE_CATEGORIE) as Array<[Categorie, string]>;

const CHAMP = "min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream";
const BOUTON_PRINCIPAL = "min-h-12 rounded-xl px-4 text-base font-semibold bg-brass text-ebony disabled:opacity-40";
const BOUTON = "min-h-12 rounded-xl px-4 text-base text-cream bg-ebony-ridge border border-hairline";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-ebony-card border border-hairline">
      <summary className="flex items-center gap-3 px-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-base font-semibold text-cream">{titre}</span>
        <ChevronDown size={22} aria-hidden="true" className="text-cream-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-3 border-t border-hairline flex flex-col gap-3">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------- planning

/** Ce qu'une plage peut faire, une seule chose à la fois (les plages combinées du PC restent lisibles). */
const EFFETS: Array<{ cle: string; libelle: string; reglage: Reglage }> = [
  { cle: "verrou", libelle: "PC verrouillé", reglage: { pc: VALEUR.pc.verrouille } },
  ...MODES.map((m) => ({ cle: m.mode as string, libelle: `Mode ${m.libelle}`, reglage: { mode: m.mode } })),
  { cle: "sans-internet", libelle: "Internet coupé", reglage: { internet: VALEUR.internet.coupe } },
];

const memeReglage = (a: Reglage, b: Reglage) => a.pc === b.pc && a.internet === b.internet && a.mode === b.mode;
const reglageDe = (p: Plage): Reglage => ({
  ...(p.pc ? { pc: p.pc } : {}),
  ...(p.internet ? { internet: p.internet } : {}),
  ...(p.mode ? { mode: p.mode } : {}),
});

/** Une plage combinée (venue du PC) en mots. */
function decrirePlage(p: Plage): string {
  const parts: string[] = [];
  if (p.pc) parts.push(p.pc === VALEUR.pc.verrouille ? "PC verrouillé" : "PC autorisé");
  if (p.mode) parts.push(`mode ${libelleMode(p.mode)}`);
  if (p.internet === VALEUR.internet.coupe) parts.push("internet coupé");
  if (p.internet === VALEUR.internet.ecole) parts.push("sites de l'école seulement");
  return parts.join(", ");
}

const NOUVELLE_PLAGE: Plage = { debut: "16:00", fin: "18:00", mode: VALEUR.mode.devoirs };

function PlanningReglage({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const [p, setP] = useState<Planning>(config.planning);
  useEffect(() => setP(config.planning), [config.planning]);
  const valide = CLE_JOUR.every((j) =>
    p[j].every((x) => heureValide(x.debut) && heureValide(x.fin) && x.debut !== x.fin),
  );
  const changer = (j: (typeof CLE_JOUR)[number], k: number, plage: Plage | null) =>
    setP({ ...p, [j]: plage ? p[j].map((x, i) => (i === k ? plage : x)) : p[j].filter((_, i) => i !== k) });

  return (
    <Bloc titre="Planning de la semaine">
      <p className="text-[15px] text-cream-mute">
        Chaque plage revient toutes les semaines. Une plage qui finit avant de commencer passe minuit (21h30 → 7h00).
        Si deux plages se chevauchent, la plus stricte gagne. Hors des plages : mode {libelleMode(config.defauts.mode)}
        {config.defauts.pc === VALEUR.pc.verrouille ? ", PC verrouillé" : ", PC autorisé"}.
      </p>
      <ul className="flex flex-col gap-4">
        {ORDRE.map((i) => {
          const j = CLE_JOUR[i];
          return (
            <li key={j} className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-cream">{JOURS[i]}</h3>
              {p[j].length === 0 && <p className="text-[15px] text-cream-mute">Aucune plage.</p>}
              {p[j].map((plage, k) => {
                const effet = EFFETS.find((e) => memeReglage(e.reglage, reglageDe(plage)));
                return (
                  <div key={k} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${JOURS[i]}, plage ${k + 1} : début`}
                      value={plage.debut}
                      onChange={(e) => changer(j, k, { ...plage, debut: e.target.value })}
                      className={CHAMP}
                    />
                    <span className="text-cream-mute" aria-hidden="true">→</span>
                    <input
                      type="time"
                      aria-label={`${JOURS[i]}, plage ${k + 1} : fin`}
                      value={plage.fin}
                      onChange={(e) => changer(j, k, { ...plage, fin: e.target.value })}
                      className={CHAMP}
                    />
                    <select
                      aria-label={`${JOURS[i]}, plage ${k + 1} : ce qui s'applique`}
                      value={effet?.cle ?? ""}
                      onChange={(e) => {
                        const choisi = EFFETS.find((x) => x.cle === e.target.value);
                        if (choisi) changer(j, k, { debut: plage.debut, fin: plage.fin, ...choisi.reglage });
                      }}
                      className={`${CHAMP} flex-1 min-w-[10rem]`}
                    >
                      {!effet && <option value="">{decrirePlage(plage)}</option>}
                      {EFFETS.map((e) => (
                        <option key={e.cle} value={e.cle}>
                          {e.libelle}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => changer(j, k, null)}
                      className="min-h-12 min-w-12 inline-flex items-center justify-center text-cream-mute"
                      aria-label={`Retirer la plage ${k + 1} du ${JOURS[i].toLowerCase()}`}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setP({ ...p, [j]: [...p[j], NOUVELLE_PLAGE] })}
                className="self-start min-h-12 inline-flex items-center gap-2 text-base text-brass"
              >
                <Plus size={18} aria-hidden="true" /> Ajouter une plage
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!valide}
          onClick={() => envoyer(enregistrerPlanning(db, config.id, p, uid), "Planning enregistré")}
          className={`${BOUTON_PRINCIPAL} flex-1`}
        >
          Enregistrer le planning
        </button>
        <button type="button" onClick={() => setP(PLANNING_DEFAUT)} className={`${BOUTON} flex-1`}>
          Planning habituel
        </button>
      </div>
    </Bloc>
  );
}

// ---------------------------------------------------------------- applis

/** Les applis connues : celles réglées ici et celles que le PC publie (catalogue). */
function ApplisReglage({ config, etat, uid }: { config: ConfigAppareil; etat: EtatAppareil | null; uid: string }) {
  const catalogue = etat?.catalogue ?? {};
  const ids = [...new Set([...Object.keys(config.applis), ...Object.keys(catalogue)])];
  const nom = (id: string) => catalogue[id]?.nom ?? id;
  const reglage = (id: string): Appli => {
    const c = catalogue[id];
    return config.applis[id] ?? { autorisee: c?.autorisee ?? true, categorie: c?.categorie ?? c?.categorieParDefaut ?? undefined };
  };
  ids.sort((a, b) => nom(a).localeCompare(nom(b), "fr"));

  return (
    <Bloc titre={`Applis (${ids.length})`}>
      {ids.length === 0 ? (
        <p className="text-base text-cream-mute">Le PC n'a pas encore envoyé la liste de ses applis.</p>
      ) : (
        <>
          <p className="text-[15px] text-cream-mute">
            La catégorie décide dans quels modes l'appli s'ouvre : « École » en Devoirs, toutes en Temps libre.
          </p>
          <ul className="flex flex-col gap-3">
            {ids.map((id) => {
              const a = reglage(id);
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <label className="flex-1 min-w-[10rem] flex items-center gap-3 min-h-12 text-base text-cream">
                    <input
                      type="checkbox"
                      checked={a.autorisee}
                      onChange={(e) =>
                        envoyer(
                          enregistrerAppli(db, config.id, id, { ...a, autorisee: e.target.checked }, uid),
                          `${nom(id)} : ${e.target.checked ? "autorisée" : "refusée"}`,
                        )
                      }
                      className="h-6 w-6 accent-[rgb(var(--c-brass))]"
                    />
                    <span className="truncate">{nom(id)}</span>
                  </label>
                  <select
                    aria-label={`Catégorie de ${nom(id)}`}
                    value={a.categorie ?? ""}
                    onChange={(e) => {
                      const categorie = e.target.value as Categorie;
                      envoyer(
                        enregistrerAppli(db, config.id, id, { ...a, categorie }, uid),
                        `${nom(id)} rangée dans « ${LIBELLE_CATEGORIE[categorie]} »`,
                      );
                    }}
                    className={CHAMP}
                  >
                    {!a.categorie && <option value="">Catégorie ?</option>}
                    {CATEGORIES.map(([valeur, libelle]) => (
                      <option key={valeur} value={valeur}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Bloc>
  );
}

// ---------------------------------------------------------------- limites

function LimitesReglage({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const depuis = (l: ConfigAppareil["limites"]) =>
    Object.fromEntries(CATEGORIES.map(([c]) => [c, { active: !!l[c], minutes: l[c] ?? 60 }])) as Record<
      Categorie,
      { active: boolean; minutes: number }
    >;
  const [l, setL] = useState(() => depuis(config.limites));
  useEffect(() => setL(depuis(config.limites)), [config.limites]);

  return (
    <Bloc titre="Limites par jour">
      <p className="text-[15px] text-cream-mute">
        Temps maximum par jour pour une catégorie d'applis. Le PC prévient 15 puis 5 minutes avant.
      </p>
      <ul className="flex flex-col gap-2">
        {CATEGORIES.map(([valeur, libelle]) => {
          const lim = l[valeur];
          return (
            <li key={valeur} className="flex flex-wrap items-center gap-3">
              <label className="flex-1 min-w-[8rem] flex items-center gap-3 min-h-12 text-base text-cream">
                <input
                  type="checkbox"
                  checked={lim.active}
                  onChange={(e) => setL({ ...l, [valeur]: { ...lim, active: e.target.checked } })}
                  className="h-6 w-6 accent-[rgb(var(--c-brass))]"
                />
                {libelle}
              </label>
              {lim.active && (
                <label className="flex items-center gap-2 text-base text-cream-mute">
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={lim.minutes}
                    onChange={(e) => setL({ ...l, [valeur]: { ...lim, minutes: Number(e.target.value) } })}
                    className={`${CHAMP} w-24`}
                  />
                  min par jour
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          const actives = CATEGORIES.filter(([c]) => l[c].active);
          if (actives.some(([c]) => !(l[c].minutes >= 5 && l[c].minutes <= 600))) {
            return refuser("Une limite doit être entre 5 et 600 minutes.");
          }
          const limites = Object.fromEntries(actives.map(([c]) => [c, l[c].minutes]));
          envoyer(enregistrerLimites(db, config.id, limites, uid), "Limites enregistrées");
        }}
        className={BOUTON_PRINCIPAL}
      >
        Enregistrer les limites
      </button>
    </Bloc>
  );
}

// ---------------------------------------------------------------- noms montrés à l'enfant

function NomsParents({
  config,
  parents,
  uid,
}: {
  config: ConfigAppareil;
  parents: Array<{ uid: string; libelle: string }>;
  uid: string;
}) {
  const [noms, setNoms] = useState(config.nomsParents);
  useEffect(() => setNoms(config.nomsParents), [config.nomsParents]);
  return (
    <Bloc titre="Nom montré sur le PC">
      <p className="text-[15px] text-cream-mute">
        Quand un parent décide, le PC l'écrit : « Temps libre jusqu'à 18h, par Papa ». Sans nom : « Un parent ».
      </p>
      {parents.map((p) => (
        <label key={p.uid} className="flex flex-col gap-1 text-[15px] text-cream-mute">
          {p.libelle}
          <input
            value={noms[p.uid] ?? ""}
            maxLength={NOM_PARENT_MAX}
            placeholder="Ex. Papa, Maman"
            onChange={(e) => setNoms({ ...noms, [p.uid]: e.target.value })}
            className={CHAMP}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => {
          const propres = Object.fromEntries(
            Object.entries(noms)
              .map(([u, n]) => [u, n.trim()] as const)
              .filter(([, n]) => n),
          );
          envoyer(enregistrerNomsParents(db, config.id, propres, uid), "Noms enregistrés");
        }}
        className={BOUTON_PRINCIPAL}
      >
        Enregistrer les noms
      </button>
    </Bloc>
  );
}

// ---------------------------------------------------------------- programmes inconnus, compte du PC

function ProgrammesInconnus({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const options: Array<{ valeur: ExecutablesInconnus; libelle: string }> = [
    { valeur: VALEUR.executablesInconnus.signaler, libelle: "Les laisser, et me le signaler" },
    { valeur: VALEUR.executablesInconnus.fermer, libelle: "Les fermer tout de suite" },
  ];
  return (
    <Bloc titre="Programmes inconnus">
      <p className="text-[15px] text-cream-mute">
        Un programme lancé hors des applis installées (une clé USB, un téléchargement).
      </p>
      {options.map((o) => (
        <label key={o.valeur} className="flex items-center gap-3 min-h-12 text-base text-cream">
          <input
            type="radio"
            name="programmes-inconnus"
            checked={config.executablesInconnus === o.valeur}
            onChange={() => envoyer(enregistrerExecutablesInconnus(db, config.id, o.valeur, uid), "Réglage enregistré")}
            className="h-6 w-6 accent-[rgb(var(--c-brass))]"
          />
          {o.libelle}
        </label>
      ))}
    </Bloc>
  );
}

function CompteDuPc({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const [saisie, setSaisie] = useState(config.compteAppareil ?? "");
  return (
    <Bloc titre="Compte du PC">
      <p className="text-[15px] text-cream-mute">
        L'identifiant du compte que le PC utilise pour se connecter (procédure : docs/controle-parental/COMPTE-APPAREIL.md).
        Le vider coupe le PC de Family Hub ; il garde alors ses dernières règles.
      </p>
      <input value={saisie} onChange={(e) => setSaisie(e.target.value.trim())} aria-label="Identifiant du compte du PC" className={CHAMP} />
      <button
        type="button"
        onClick={() => {
          if (!window.confirm(saisie ? "Relier le PC à ce compte ?" : "Couper le PC de Family Hub ?")) return;
          envoyer(associerCompteAppareil(db, config.id, saisie, uid), saisie ? "Compte du PC enregistré" : "PC coupé de Family Hub");
        }}
        className={BOUTON}
      >
        Enregistrer
      </button>
    </Bloc>
  );
}

/** Réglages : réservés au fondateur du foyer (masqués à l'écran pour les autres parents). */
export default function Reglages({
  config,
  etat,
  uid,
  parents,
  rapport,
}: {
  config: ConfigAppareil;
  etat: EtatAppareil | null;
  uid: string;
  parents: Array<{ uid: string; libelle: string }>;
  rapport: RapportNextdns | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <PlanningReglage config={config} uid={uid} />
      <ApplisReglage config={config} etat={etat} uid={uid} />
      <LimitesReglage config={config} uid={uid} />
      <NomsParents config={config} parents={parents} uid={uid} />
      <Bloc titre="Sites toujours bloqués ou autorisés">
        <ListesDeSites appareilId={config.id} rapport={rapport} />
      </Bloc>
      <ProgrammesInconnus config={config} uid={uid} />
      <CompteDuPc config={config} uid={uid} />
    </div>
  );
}
