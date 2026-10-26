import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CLE_JOUR,
  PLANNING_DEFAUT,
  VALEUR,
  associerCompteAppareil,
  enregistrerAppli,
  enregistrerLimites,
  enregistrerPlanning,
  heureValide,
  type Categorie,
  type ConfigAppareil,
  type Limite,
  type Planning,
  type RapportNextdns,
} from "@family-hub/controle-parental";
import { db } from "../../lib/firebase";
import ListesDeSites from "./ListesDeSites";
import { envoyer, refuser } from "../../lib/controleParental/envoyer";

/** Libellés dans l'ordre de CLE_JOUR (dimanche d'abord, comme Date.getDay). */
const SOIRS = ["Dimanche soir", "Lundi soir", "Mardi soir", "Mercredi soir", "Jeudi soir", "Vendredi soir", "Samedi soir"];
/** Affichage du lundi au dimanche. */
const ORDRE = [1, 2, 3, 4, 5, 6, 0];

export const CATEGORIES: Array<{ valeur: Categorie; libelle: string }> = [
  { valeur: VALEUR.categorie.ecole, libelle: "École" },
  { valeur: VALEUR.categorie.creation, libelle: "Création" },
  { valeur: VALEUR.categorie.jeu, libelle: "Jeu" },
  { valeur: VALEUR.categorie.autre, libelle: "Autre" },
];

const CHAMP = "min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-ebony-card border border-hairline">
      <summary className="flex items-center gap-3 px-4 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-base font-semibold text-cream">{titre}</span>
        <ChevronDown size={22} aria-hidden="true" className="text-cream-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-hairline flex flex-col gap-3">{children}</div>
    </details>
  );
}

function PlanningReglage({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const [p, setP] = useState<Planning>(config.planning);
  useEffect(() => setP(config.planning), [config.planning]);
  const valide = CLE_JOUR.every((j) => !p[j] || (heureValide(p[j]!.debut) && heureValide(p[j]!.fin)));

  return (
    <Bloc titre="Planning de la semaine">
      <p className="text-[15px] text-cream-mute">Le PC se verrouille le soir et se rouvre le matin.</p>
      <ul className="flex flex-col gap-3">
        {ORDRE.map((i) => {
          const j = CLE_JOUR[i];
          const c = p[j];
          return (
            <li key={j} className="flex flex-col gap-2">
              <label className="flex items-center gap-3 min-h-12 text-base text-cream">
                <input
                  type="checkbox"
                  checked={!!c}
                  onChange={(e) => setP({ ...p, [j]: e.target.checked ? PLANNING_DEFAUT[j] : null })}
                  className="h-6 w-6 accent-[rgb(var(--c-brass))]"
                />
                {SOIRS[i]}
                {!c && <span className="text-cream-mute">· pas de verrouillage</span>}
              </label>
              {c && (
                <div className="flex items-center gap-2 pl-9 text-base text-cream-mute">
                  de
                  <input
                    type="time"
                    aria-label={`${SOIRS[i]} : verrouillage à`}
                    value={c.debut}
                    onChange={(e) => setP({ ...p, [j]: { ...c, debut: e.target.value } })}
                    className={CHAMP}
                  />
                  à
                  <input
                    type="time"
                    aria-label={`${SOIRS[i]} : réouverture à`}
                    value={c.fin}
                    onChange={(e) => setP({ ...p, [j]: { ...c, fin: e.target.value } })}
                    className={CHAMP}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!valide}
          onClick={() => envoyer(enregistrerPlanning(db, config.id, p, uid), "Planning enregistré")}
          className="min-h-12 flex-1 rounded-xl px-4 text-base font-semibold bg-brass text-ebony disabled:opacity-40"
        >
          Enregistrer le planning
        </button>
        <button
          type="button"
          onClick={() => setP(PLANNING_DEFAUT)}
          className="min-h-12 flex-1 rounded-xl px-4 text-base text-cream bg-ebony-ridge border border-hairline"
        >
          Planning habituel
        </button>
      </div>
    </Bloc>
  );
}

function ApplisReglage({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const applis = Object.entries(config.applis).sort((a, b) => (a[1].nom ?? a[0]).localeCompare(b[1].nom ?? b[0], "fr"));
  return (
    <Bloc titre={`Applis (${applis.length})`}>
      {applis.length === 0 ? (
        <p className="text-base text-cream-mute">Le PC n'a encore envoyé aucune appli.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applis.map(([id, a]) => (
            <li key={id} className="flex flex-wrap items-center gap-2">
              <label className="flex-1 min-w-[10rem] flex items-center gap-3 min-h-12 text-base text-cream">
                <input
                  type="checkbox"
                  checked={a.autorisee}
                  onChange={(e) =>
                    envoyer(
                      enregistrerAppli(db, config.id, id, { ...a, autorisee: e.target.checked }, uid),
                      `${a.nom ?? id} : ${e.target.checked ? "autorisée" : "refusée"}`,
                    )
                  }
                  className="h-6 w-6 accent-[rgb(var(--c-brass))]"
                />
                <span className="truncate">{a.nom ?? id}</span>
              </label>
              <select
                aria-label={`Catégorie de ${a.nom ?? id}`}
                value={a.categorie}
                onChange={(e) =>
                  envoyer(
                    enregistrerAppli(db, config.id, id, { ...a, categorie: e.target.value as Categorie }, uid),
                    `${a.nom ?? id} rangée dans « ${CATEGORIES.find((c) => c.valeur === e.target.value)?.libelle} »`,
                  )
                }
                className={CHAMP}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  );
}

function LimitesReglage({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const [l, setL] = useState<Partial<Record<Categorie, Limite>>>(config.limites);
  useEffect(() => setL(config.limites), [config.limites]);
  return (
    <Bloc titre="Limites par jour">
      <p className="text-[15px] text-cream-mute">
        Temps maximum par jour pour une catégorie d'applis. Le PC prévient 15 puis 5 minutes avant.
      </p>
      <ul className="flex flex-col gap-2">
        {CATEGORIES.map(({ valeur, libelle }) => {
          const lim = l[valeur] ?? { active: false, minutes: 60 };
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
          const mauvaises = Object.values(l).some((x) => x?.active && !(x.minutes >= 5 && x.minutes <= 600));
          if (mauvaises) return refuser("Une limite doit être entre 5 et 600 minutes.");
          envoyer(enregistrerLimites(db, config.id, l, uid), "Limites enregistrées");
        }}
        className="min-h-12 rounded-xl px-4 text-base font-semibold bg-brass text-ebony"
      >
        Enregistrer les limites
      </button>
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
        className="min-h-12 rounded-xl px-4 text-base text-cream bg-ebony-ridge border border-hairline"
      >
        Enregistrer
      </button>
    </Bloc>
  );
}

/** Réglages : réservés au fondateur du foyer (masqués à l'écran pour les autres parents). */
export default function Reglages({
  config,
  uid,
  rapport,
}: {
  config: ConfigAppareil;
  uid: string;
  rapport: RapportNextdns | null;
}) {
  return (
    <section aria-labelledby="reglages" className="flex flex-col gap-2">
      <h2 id="reglages" className="text-lg font-semibold text-cream">Réglages</h2>
      <PlanningReglage config={config} uid={uid} />
      <ApplisReglage config={config} uid={uid} />
      <LimitesReglage config={config} uid={uid} />
      <Bloc titre="Sites toujours bloqués ou autorisés">
        <ListesDeSites appareilId={config.id} rapport={rapport} />
      </Bloc>
      <CompteDuPc config={config} uid={uid} />
    </section>
  );
}
