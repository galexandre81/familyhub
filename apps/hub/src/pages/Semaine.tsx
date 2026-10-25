/**
 * Téléphone — onglet « Semaine » : rangée des jours du plan (le plan peut
 * commencer n'importe quel jour et durer plus de 7 jours), les 3 repas du
 * jour choisi (passés effacés, le prochain encadré avec « Cuisiner ») et
 * sa session de batch cooking s'il y en a une,
 * « Pourquoi ce menu ? » replié en bas, flèches vers les plans voisins.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, ChevronLeft, ChevronRight, Lightbulb, StickyNote } from "lucide-react";
import clsx from "clsx";
import {
  heureDuRepas,
  heuresRepasValides,
  libelleDans,
  minutesAvant,
  prochainsRepas,
  type Profil,
  type Repas,
} from "@family-hub/types";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useActivePlan,
  useAllPlans,
  useHouseholds,
  usePlanBatchSessions,
  usePlanRecettes,
  usePlanSlots,
  useProfils,
  type MealPlanSlotWithId,
} from "../lib/queries";
import { dateISOLocale } from "../lib/aujourdhui";
import { joursDuPlan, jourInitial, planVoisins, repasPasse } from "../lib/semaine";
import { titreRepas } from "../lib/repasCuisine";
import { useMaintenant } from "../lib/useMaintenant";
import CarteBatch from "../components/CarteBatch";
import ProfilBadge from "../components/ProfilBadge";
import { LoadingState } from "../components/states";

/** Nombre de plans parcourables avec les flèches. */
const PLANS_MAX = 12;

function heureTexte(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Semaine() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households, isLoading: householdsLoading } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);
  const { data: planActif, isLoading: planActifLoading } = useActivePlan(householdId);
  const { data: plans, isLoading: plansLoading } = useAllPlans(householdId, PLANS_MAX);
  const now = useMaintenant();

  /** Plan choisi avec les flèches ; par défaut le plan actif (sinon le plus récent). */
  const [planChoisiId, setPlanChoisiId] = useState<string | undefined>();
  const planId = planChoisiId ?? planActif?.id ?? plans?.[0]?.id;
  const plan = plans?.find((p) => p.id === planId) ?? (planActif?.id === planId ? planActif : undefined);

  const { data: slots, isLoading: slotsLoading } = usePlanSlots(householdId, plan?.id);
  const { data: batchSessions } = usePlanBatchSessions(householdId, plan?.id);
  const { data: recettes } = usePlanRecettes(householdId, slots);
  const { data: profils } = useProfils(householdId);

  const heures = heuresRepasValides(household?.parametres?.heuresRepas);
  const jours = useMemo(() => (plan ? joursDuPlan(slots ?? [], plan) : []), [plan, slots]);
  const voisins = planVoisins(plans ?? [], plan?.id);
  const prochain = prochainsRepas(slots ?? [], now, heures, 1)[0];
  const prochainId = prochain?.slot.id;
  const dansProchain = prochain ? libelleDans(minutesAvant(prochain.heure, now)) : "";

  /** Jour choisi, propre à chaque plan ; sinon aujourd'hui ou le premier jour. */
  const [choix, setChoix] = useState<{ planId?: string; jour: string }>({ jour: "" });
  const jourChoisi =
    choix.planId === plan?.id && jours.some((j) => j.dateISO === choix.jour)
      ? choix.jour
      : jourInitial(jours, now);
  const jour = jours.find((j) => j.dateISO === jourChoisi);

  const profilsParId = useMemo(
    () => Object.fromEntries((profils ?? []).map((p) => [p.id, p])),
    [profils],
  );

  /* Sans plan actif, on attend la liste des plans avant d'affirmer qu'il n'y a pas de menu. */
  if (householdsLoading || planActifLoading || (!plan && plansLoading)) return <LoadingState />;
  if (!householdId || !plan) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-12">
        <p className="text-lg text-cream">Pas de menu en cours — il se prépare sur l'ordinateur</p>
      </div>
    );
  }

  const aujourdhui = dateISOLocale(now);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <BoutonPlan
          sens="precedent"
          disabled={!voisins.precedentId}
          onClick={() => setPlanChoisiId(voisins.precedentId)}
        />
        <h1 className="font-serif text-xl text-cream text-center leading-tight">
          {premier && dernier ? (
            <>
              Menu du {premier.libelleCourt} {premier.numero}
              <span className="block text-[15px] text-cream-mute font-sans">
                au {dernier.libelleCourt} {dernier.numero}
                {plan.statut === "active" ? " · en cours" : ""}
              </span>
            </>
          ) : (
            "Menu"
          )}
        </h1>
        <BoutonPlan
          sens="suivant"
          disabled={!voisins.suivantId}
          onClick={() => setPlanChoisiId(voisins.suivantId)}
        />
      </div>

      <div role="group" aria-label="Jours du menu" className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
        {jours.map((j) => {
          const choisi = j.dateISO === jourChoisi;
          const estAujourdhui = j.dateISO === aujourdhui;
          return (
            <button
              key={j.dateISO}
              type="button"
              aria-pressed={choisi}
              aria-current={estAujourdhui ? "date" : undefined}
              onClick={() => setChoix({ planId: plan.id, jour: j.dateISO })}
              className={clsx(
                "shrink-0 min-h-14 min-w-12 px-2 rounded-xl flex flex-col items-center justify-center leading-tight border",
                choisi
                  ? /* Pas de jaune : le seul jaune de l'écran est le prochain repas. */
                    "bg-ebony-ridge text-brass border-transparent font-semibold"
                  : "bg-ebony-card text-cream border-hairline",
                !choisi && estAujourdhui && "border-brass",
              )}
            >
              <span className="text-[15px]">{j.libelleCourt}</span>
              <span className="text-lg">{j.numero}</span>
            </button>
          );
        })}
      </div>

      {slotsLoading ? (
        <LoadingState />
      ) : (
        jour && (
          <ul className="flex flex-col gap-3" aria-label="Repas du jour">
            {jour.repas.map(({ repas, slot }) => (
              <CarteRepas
                key={repas}
                repas={repas}
                slot={slot}
                planId={plan.id}
                prochain={!!slot && slot.id === prochainId}
                dans={dansProchain}
                passe={repasPasse(jour.dateISO, repas, now, heures)}
                heure={heureTexte(heureDuRepas(jour.dateISO, repas, heures))}
                recettes={recettes ?? {}}
                profilsParId={profilsParId}
              />
            ))}
          </ul>
        )
      )}

      {(batchSessions ?? [])
        .filter((b) => b.date === jourChoisi)
        .map((b) => (
          <CarteBatch key={b.id} planId={plan.id} batch={b} titre="Batch cooking ce jour-là" recettes={recettes ?? {}} />
        ))}

      {plan.commentaireImport?.trim() && (
        <details className="rounded-xl bg-ebony-card border border-hairline">
          <summary className="min-h-12 px-4 flex items-center gap-2 text-base text-cream cursor-pointer">
            <Lightbulb size={20} aria-hidden="true" className="text-brass" />
            Pourquoi ce menu ?
          </summary>
          <p className="px-4 pb-4 text-[15px] text-cream-mute whitespace-pre-line">
            {plan.commentaireImport.trim()}
          </p>
        </details>
      )}
    </div>
  );
}

function BoutonPlan({
  sens,
  disabled,
  onClick,
}: {
  sens: "precedent" | "suivant";
  disabled: boolean;
  onClick: () => void;
}) {
  const precedent = sens === "precedent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={precedent ? "Semaine précédente" : "Semaine suivante"}
      className="shrink-0 min-h-12 px-2 inline-flex items-center gap-1 rounded-xl text-[15px] text-cream-mute disabled:opacity-30"
    >
      {precedent && <ChevronLeft size={20} aria-hidden="true" />}
      {precedent ? "Avant" : "Après"}
      {!precedent && <ChevronRight size={20} aria-hidden="true" />}
    </button>
  );
}

function CarteRepas({
  repas,
  slot,
  planId,
  prochain,
  dans,
  passe,
  heure,
  recettes,
  profilsParId,
}: {
  repas: Repas;
  slot?: MealPlanSlotWithId;
  planId: string;
  prochain: boolean;
  /** « dans 1 h 30 » — affiché seulement sur le prochain repas. */
  dans: string;
  passe: boolean;
  heure: string;
  recettes: Record<string, { nom: string } | undefined>;
  profilsParId: Record<string, Profil>;
}) {
  const nom = titreRepas(repas, undefined);
  const noms = (slot?.recetteIds ?? []).map((id) => recettes[id]?.nom).filter((n): n is string => !!n);
  const vide = !slot || slot.recetteIds.length === 0;
  const annule = !!slot?.annule;
  const presents = (slot?.profilsPresents ?? [])
    .filter((id) => profilsParId[id])
    .map((id) => ({ ...profilsParId[id], id }));
  const invites = slot?.invitesNoms?.length ?? 0;
  const [plat, ...accompagnements] = noms;

  return (
    <li
      aria-label={prochain ? `${nom}, prochain repas` : nom}
      className={clsx(
        "rounded-xl bg-ebony-card border border-hairline overflow-hidden",
        passe && !prochain && "opacity-50",
      )}
    >
      {prochain ? (
        /* Le seul jaune de l'écran : même bandeau que la carte « prochain repas » d'Aujourd'hui. */
        <div className="bg-[rgb(var(--c-maintenant))] text-[rgb(var(--c-bordure))] px-4 py-2 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight">
            {nom} · {heure}
          </h2>
          <span className="text-base whitespace-nowrap">{dans}</span>
        </div>
      ) : (
        <div
          className={clsx(
            "px-4 pt-3 flex items-baseline justify-between gap-2 text-base text-cream",
            (passe || annule) && "line-through decoration-1 decoration-cream-mute/60",
          )}
        >
          <span className="font-semibold">{nom}</span>
          <span className="text-cream-mute whitespace-nowrap">{heure}</span>
        </div>
      )}

      <div className={clsx("px-4 pb-3 flex flex-col gap-2", prochain ? "pt-3" : "pt-1")}>
        {annule ? (
          <p className="text-[15px] text-cream-mute">Annulé</p>
        ) : vide ? (
          <p className="text-[15px] text-cream-mute">Rien de prévu</p>
        ) : (
          <div>
            <p className="text-base text-cream leading-snug line-clamp-1">{plat ?? "Repas prévu"}</p>
            {accompagnements.length > 0 && (
              <p className="text-[15px] text-cream-mute leading-snug line-clamp-1">
                avec {accompagnements.join(", ")}
              </p>
            )}
          </div>
        )}

        {!vide && (presents.length > 0 || invites > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap" aria-label="Pour qui">
            {presents.map((p) => (
              <span key={p.id} title={p.nom}>
                <ProfilBadge initiale={p.initiale} couleur={p.couleur} couleurPersonne={p.couleurPersonne} size="sm" />
                <span className="sr-only">{p.nom}</span>
              </span>
            ))}
            {invites > 0 && (
              <span className="text-[15px] text-cream-mute">
                + {invites} invité{invites > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {slot?.notes?.trim() && (
          <details>
            <summary className="min-h-12 -my-1 flex items-center gap-2 text-[15px] text-cream-mute cursor-pointer">
              <StickyNote size={18} aria-hidden="true" />
              Note
            </summary>
            <p className="pb-1 text-[15px] text-cream whitespace-pre-line">{slot.notes.trim()}</p>
          </details>
        )}

        {/* On cuisine aussi à l'avance (batch) : chaque repas avec recettes a « Cuisiner ». */}
        {slot && !vide && !annule && (
          <Link
            to={`/menu/${planId}/${slot.id}/cuisine`}
            className={clsx(
              "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold",
              prochain ? "bg-brass text-ebony" : "border border-hairline bg-ebony-ridge text-brass",
            )}
          >
            <ChefHat size={20} aria-hidden="true" />
            Cuisiner
          </Link>
        )}
      </div>
    </li>
  );
}
