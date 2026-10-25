/**
 * Session de batch cooking (téléphone d'abord, marche aussi sur PC) : quand,
 * combien de temps, pour quels repas, les conseils d'organisation, les
 * recettes à préparer (chacune se déplie : ingrédients et étapes, à ses
 * propres portions), « Cuisiner » (toutes les recettes en mode recette) et
 * « C'est fait ».
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChefHat, ChevronDown, Clock, Lightbulb, Timer } from "lucide-react";
import type { Recette } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  usePlanBatchSessions,
  usePlanRecettes,
  usePlanSlots,
} from "../lib/queries";
import { useToggleBatchSessionDone } from "../lib/mutations";
import { dureeTexte, jourDuBatch, repasDuBatch } from "../lib/batch";
import { etapesTriees, libelleEtape, titreRepas } from "../lib/repasCuisine";
import { useMinuteurs } from "../lib/MinuteursContext";
import ListeIngredients from "../components/recette/ListeIngredients";
import { useMaintenant } from "../lib/useMaintenant";
import { toast } from "../components/Toast";
import { LoadingState } from "../components/states";

const BOUTON = "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold";

export default function BatchCooking() {
  const { planId, batchId } = useParams<{ planId: string; batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: sessions, isLoading: sessionsLoading } = usePlanBatchSessions(householdId, planId);
  const { data: slots } = usePlanSlots(householdId, planId);
  const batch = sessions?.find((s) => s.id === batchId);
  const { data: recettes, isLoading: recettesLoading } = usePlanRecettes(householdId, batch ? [batch] : undefined);
  const toggleDone = useToggleBatchSessionDone();
  const now = useMaintenant();

  const retour = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  };

  if (!householdId || sessionsLoading) return <LoadingState />;
  if (!batch || !planId) {
    return (
      <div className="flex flex-col gap-4">
        <BoutonRetour onClick={retour} />
        <p className="text-lg text-cream">Cette session de batch cooking est introuvable.</p>
      </div>
    );
  }

  const duree = dureeTexte(batch.dureeEstimeeMinutes);
  const pourRepas = repasDuBatch(slots ?? [], batch.id);
  const basculer = () =>
    toggleDone.mutate(
      { householdId, planId, sessionId: batch.id, currentDone: batch.done },
      { onError: () => toast("Impossible d'enregistrer, réessaie avec du réseau", { type: "error" }) },
    );

  return (
    <div className="flex flex-col gap-5 pb-4">
      <BoutonRetour onClick={retour} />

      <header>
        <p className="text-base text-cream-mute">{jourDuBatch(batch.date, now)}</p>
        <h1 className="font-serif text-2xl text-cream leading-tight">Batch cooking</h1>
        {duree && (
          <p className="mt-1 flex items-center gap-2 text-base text-cream-mute">
            <Clock size={18} aria-hidden="true" />
            Environ {duree}
          </p>
        )}
      </header>

      {pourRepas.length > 0 && (
        <section aria-labelledby="batch-pour">
          <h2 id="batch-pour" className="text-base text-cream-mute mb-1">
            Ce que ça prépare
          </h2>
          <ul className="text-base text-cream space-y-0.5">
            {pourRepas.map((s) => (
              <li key={s.id}>{titreRepas(s.repas, s.date)}</li>
            ))}
          </ul>
        </section>
      )}

      {batch.notes?.trim() && (
        <section aria-labelledby="batch-conseils" className="rounded-xl bg-ebony-card border border-hairline p-4">
          <h2 id="batch-conseils" className="flex items-center gap-2 text-base font-semibold text-cream mb-2">
            <Lightbulb size={20} aria-hidden="true" className="text-brass" />
            Comment s'organiser
          </h2>
          <p className="text-base text-cream leading-relaxed whitespace-pre-line">{batch.notes.trim()}</p>
        </section>
      )}

      <section aria-labelledby="batch-recettes">
        <h2 id="batch-recettes" className="text-base text-cream-mute mb-2">
          {batch.recetteIds.length > 1 ? `Les ${batch.recetteIds.length} recettes` : "La recette"}
        </h2>
        {recettesLoading ? (
          <p className="text-base text-cream-mute">Chargement des recettes…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {batch.recetteIds.map((id) => {
              const recette = recettes?.[id];
              if (!recette) {
                return (
                  <li key={id} className="rounded-xl bg-ebony-card border border-hairline px-4 py-3 text-base text-cream-mute">
                    Recette introuvable
                  </li>
                );
              }
              return (
                <li key={id}>
                  <RecetteDepliable recette={recette} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate(`/menu/${planId}/batch/${batch.id}/cuisine`)}
          className={`${BOUTON} bg-brass text-ebony`}
        >
          <ChefHat size={20} aria-hidden="true" />
          Cuisiner tout le batch
        </button>
        <button
          type="button"
          onClick={basculer}
          disabled={toggleDone.isPending}
          aria-pressed={batch.done}
          className={`${BOUTON} border-2 ${
            batch.done ? "border-hairline text-cream-mute" : "border-brass text-cream"
          } disabled:opacity-50`}
        >
          <Check size={20} aria-hidden="true" />
          {batch.done ? "Fait — annuler" : "C'est fait"}
        </button>
      </div>
    </div>
  );
}

function BoutonRetour({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start min-h-12 -ml-2 px-2 inline-flex items-center gap-2 rounded-xl text-base text-cream-mute"
    >
      <ArrowLeft size={20} aria-hidden="true" />
      Retour
    </button>
  );
}

/** Une recette du batch : touchée, elle déplie ses ingrédients et ses étapes. */
function RecetteDepliable({ recette }: { recette: Recette }) {
  const { lancer } = useMinuteurs();
  const etapes = etapesTriees(recette.etapes);
  const lancerEtape = (description: string, minutes: number) => {
    const label = libelleEtape(description);
    if (lancer(label, minutes * 60)) toast(`Minuteur lancé : ${label}`, { type: "success" });
  };
  return (
    <details className="group rounded-xl bg-ebony-card border border-hairline">
      <summary className="flex items-center gap-3 px-4 py-3 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 min-w-0 text-base text-cream">
          {recette.nom}
          {recette.portions > 0 && <span className="text-cream-mute"> · {recette.portions} pers.</span>}
        </span>
        <ChevronDown
          size={22}
          aria-hidden="true"
          className="shrink-0 text-cream-mute transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4 space-y-4 border-t border-hairline pt-3">
        <section aria-label={`Ingrédients — ${recette.nom}`}>
          <h3 className="text-base font-semibold text-cream mb-2">Ingrédients</h3>
          <ListeIngredients recette={recette} portions={recette.portions} />
        </section>
        <section aria-label={`Étapes — ${recette.nom}`}>
          <h3 className="text-base font-semibold text-cream mb-2">Étapes</h3>
          {etapes.length === 0 ? (
            <p className="text-base text-cream-mute">Pas d'étapes détaillées pour cette recette.</p>
          ) : (
            <ol className="space-y-4">
              {etapes.map((etape, i) => (
                <li key={`${etape.ordre}-${i}`} className="flex gap-3">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-ebony border border-hairline flex items-center justify-center text-[15px] font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-base leading-relaxed text-cream">{etape.description}</p>
                    {etape.dureeMinutes && etape.dureeMinutes > 0 ? (
                      <button
                        type="button"
                        onClick={() => lancerEtape(etape.description, etape.dureeMinutes!)}
                        className="min-h-12 inline-flex items-center gap-2 rounded-xl px-4 text-base font-semibold border border-brass text-brass"
                      >
                        <Timer size={20} aria-hidden="true" />
                        Lancer {etape.dureeMinutes} min
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </details>
  );
}
