/**
 * Téléphone — onglet « Aujourd'hui » : deux cartes moyennes de même taille
 * (prochain repas, PC d'Léo pour les parents), puis les autres repas du
 * jour (passés effacés) et le batch du jour. Pas d'agenda.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, CookingPot, Monitor } from "lucide-react";
import { heuresRepasValides, type Profil } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useActivePlan,
  useHouseholds,
  usePlanBatchSessions,
  usePlanRecettes,
  usePlanSlots,
  useProfils,
  type BatchSessionWithId,
  type MealPlanSlotWithId,
} from "../lib/queries";
import { estParent } from "../lib/personnes";
import {
  millisecondesAvantMinute,
  resumeAujourdhui,
  type AutreRepas,
  type ProchainRepas,
} from "../lib/aujourdhui";
import { useInvitationEnAttente } from "../lib/invitationContext";
import { titreRepas } from "../lib/repasCuisine";
import ProfilBadge from "../components/ProfilBadge";
import { LoadingState } from "../components/states";

/** Heure courante, recalculée chaque minute. */
function useMaintenant(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Aligné sur les minutes pleines : « dans 1 h 30 » change pile à la minute.
    let id: number;
    const planifier = () => {
      id = window.setTimeout(() => {
        setNow(new Date());
        planifier();
      }, millisecondesAvantMinute(new Date()));
    };
    planifier();
    return () => window.clearTimeout(id);
  }, []);
  return now;
}

const CARTE = "rounded-2xl bg-ebony-card border border-hairline overflow-hidden flex flex-col";

export default function Aujourdhui() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households, isLoading: householdsLoading } = useHouseholds(user?.uid);
  const invitation = useInvitationEnAttente();
  const household = households?.find((h) => h.id === householdId);
  const { data: plan, isLoading: planLoading } = useActivePlan(householdId);
  const { data: slots, isLoading: slotsLoading } = usePlanSlots(householdId, plan?.id);
  const { data: recettes, isLoading: recettesLoading } = usePlanRecettes(householdId, slots);
  const { data: batchSessions } = usePlanBatchSessions(householdId, plan?.id);
  const { data: profils } = useProfils(householdId);
  const now = useMaintenant();

  const heuresRepas = household?.parametres?.heuresRepas;
  const resume = useMemo(
    () =>
      resumeAujourdhui(
        slots ?? [],
        recettes ?? {},
        batchSessions ?? [],
        now,
        heuresRepasValides(heuresRepas),
      ),
    [slots, recettes, batchSessions, now, heuresRepas],
  );

  const parent = !!household && !!user && estParent(household, user.uid);
  const profilsParId = useMemo(
    () => Object.fromEntries((profils ?? []).map((p) => [p.id, p])),
    [profils],
  );

  if (householdsLoading || invitation.enCours) return <LoadingState />;
  if (!householdId) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-12">
        <p className="text-lg text-cream">Rejoins ou crée ton foyer sur l'ordinateur</p>
        {invitation.resultat && !invitation.resultat.ok && (
          <p className="text-base text-cream-mute">{invitation.resultat.message}</p>
        )}
      </div>
    );
  }
  if (planLoading) return <LoadingState />;
  /* Tant que le repas et ses recettes chargent, on n'affirme pas qu'il n'y a plus rien. */
  const repasEnChargement = !!plan && (slotsLoading || recettesLoading);

  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-serif text-2xl text-cream">
        Aujourd'hui <span className="text-base text-cream-mute">· {date}</span>
      </h1>

      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 auto-rows-fr gap-4">
        {plan ? (
          <CarteProchainRepas
            chargement={repasEnChargement}
            planId={plan.id}
            prochain={resume.prochain}
            profilsParId={profilsParId}
          />
        ) : (
          <section className={`${CARTE} p-4 justify-center`}>
            <p className="text-base text-cream">Pas de menu en cours — il se prépare sur l'ordinateur</p>
          </section>
        )}
        {parent && <CartePcLéo />}
      </div>

      {resume.autresDuJour.length > 0 && (
        <section aria-labelledby="autres-repas">
          <h2 id="autres-repas" className="text-base text-cream-mute mb-2">
            Les autres repas du jour
          </h2>
          <ul className="flex flex-col gap-2">
            {resume.autresDuJour.map((r) => (
              <LigneRepas key={r.slot.id} repas={r} />
            ))}
          </ul>
        </section>
      )}

      {resume.batchsDuJour.length > 0 && (
        <ul aria-label="Batch du jour" className="flex flex-col gap-2">
          {resume.batchsDuJour.map((b) => (
            <li key={b.id}>
              <CarteBatch batch={b} recettes={recettes ?? {}} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteProchainRepas({
  chargement,
  planId,
  prochain,
  profilsParId,
}: {
  chargement: boolean;
  planId: string;
  prochain?: ProchainRepas<MealPlanSlotWithId>;
  profilsParId: Record<string, Profil>;
}) {
  if (chargement) {
    return (
      <section className={`${CARTE} p-4 justify-center`} aria-busy="true">
        <p className="text-base text-cream-mute">Chargement du prochain repas…</p>
      </section>
    );
  }
  if (!prochain) {
    return (
      <section className={`${CARTE} p-4 justify-center`}>
        <p className="text-base text-cream">Plus de repas prévu dans ce menu.</p>
      </section>
    );
  }

  const { slot } = prochain;
  const moment = [prochain.jourTexte, titreRepas(slot.repas, undefined), prochain.heureTexte]
    .filter(Boolean)
    .join(" · ");
  const presents = slot.profilsPresents
    .filter((id) => profilsParId[id])
    .map((id) => ({ ...profilsParId[id], id }));
  const invites = slot.invitesNoms?.length ?? 0;
  const pourcent = Math.round(prochain.remplissage * 100);

  return (
    <section className={CARTE} aria-label="Prochain repas">
      <div className="bg-[rgb(var(--c-maintenant))] text-[rgb(var(--c-bordure))] px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight">{moment}</h2>
          <span className="text-base whitespace-nowrap">{prochain.dans}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Temps avant le repas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pourcent}
          className="mt-2 h-2 rounded-full bg-[rgb(var(--c-bordure)/0.2)] overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-[rgb(var(--c-bordure))] transition-[width] duration-700"
            style={{ width: `${pourcent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-4">
        <div className="min-h-0">
          <p className="text-lg text-cream leading-snug line-clamp-1">{prochain.plat ?? "Repas prévu"}</p>
          {prochain.accompagnements.length > 0 && (
            <p className="text-[15px] text-cream-mute leading-snug line-clamp-1">
              avec {prochain.accompagnements.join(", ")}
            </p>
          )}
        </div>

        {(presents.length > 0 || invites > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap" aria-label="Pour qui">
            {presents.map((p) => (
              <span key={p.id} title={p.nom}>
                <ProfilBadge
                  initiale={p.initiale}
                  couleur={p.couleur}
                  couleurPersonne={p.couleurPersonne}
                  size="sm"
                />
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

        <Link
          to={`/menu/${planId}/${slot.id}/cuisine`}
          className="mt-auto min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold bg-brass text-ebony"
        >
          <ChefHat size={20} aria-hidden="true" />
          Cuisiner
        </Link>
      </div>
    </section>
  );
}

function CartePcLéo() {
  return (
    <section className={`${CARTE} p-4 gap-3`} aria-label="PC d'Léo">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-cream">
        <Monitor size={20} aria-hidden="true" />
        PC d'Léo
      </h2>
      <p className="flex-1 flex items-center text-base text-cream-mute">
        Bientôt : couper ou remettre le wifi du PC d'Léo
      </p>
    </section>
  );
}

function LigneRepas({ repas }: { repas: AutreRepas<MealPlanSlotWithId> }) {
  const nom = titreRepas(repas.slot.repas, undefined);
  return (
    <li
      className={
        "rounded-xl bg-ebony-card border border-hairline px-4 py-3 " +
        (repas.passe ? "opacity-50" : "")
      }
    >
      <div
        className={
          "flex items-baseline justify-between gap-2 text-base text-cream " +
          (repas.passe || repas.annule ? "line-through decoration-1 decoration-cream-mute/60" : "")
        }
      >
        <span className="font-semibold">{nom}</span>
        <span className="text-cream-mute whitespace-nowrap">{repas.heureTexte}</span>
      </div>
      <p className="text-[15px] text-cream-mute line-clamp-1">
        {repas.annule ? "Annulé" : repas.noms.join(", ")}
      </p>
    </li>
  );
}

function CarteBatch({
  batch,
  recettes,
}: {
  batch: BatchSessionWithId;
  recettes: Record<string, { nom: string } | undefined>;
}) {
  const noms = batch.recetteIds.map((id) => recettes[id]?.nom).filter(Boolean).join(", ");
  const heures = Math.floor(batch.dureeEstimeeMinutes / 60);
  const minutes = batch.dureeEstimeeMinutes % 60;
  const duree =
    batch.dureeEstimeeMinutes > 0
      ? heures > 0
        ? `${heures} h${minutes ? ` ${String(minutes).padStart(2, "0")}` : ""}`
        : `${minutes} min`
      : null;
  return (
    <section
      className={"rounded-xl bg-ebony-card border border-hairline px-4 py-3 " + (batch.done ? "opacity-50" : "")}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-cream">
        <CookingPot size={20} aria-hidden="true" />
        Batch cooking aujourd'hui
        {duree && <span className="font-normal text-cream-mute">· {duree}</span>}
        {batch.done && <span className="font-normal text-cream-mute">· fait</span>}
      </h2>
      {noms && <p className="text-[15px] text-cream-mute line-clamp-2">{noms}</p>}
    </section>
  );
}
