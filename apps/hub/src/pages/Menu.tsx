import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  FileEdit,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useAllPlans,
  useDraftPlan,
  useHouseholds,
  usePlanBatchSessions,
  usePlanRecettes,
  usePlanSlots,
  useProfils,
  type BatchSessionWithId,
  type RecetteWithId,
} from "../lib/queries";
import {
  useDeleteMealPlan,
  useRefreshHouseholdDisplays,
  useToggleBatchSessionDone,
} from "../lib/mutations";
import { useListeCourses } from "../lib/useListeCourses";
import { useEstTelephone } from "../lib/useEstTelephone";
import MealPlanGrid from "../components/menu/MealPlanGrid";
import SectionCoursesPc from "../components/courses/SectionCoursesPc";
import RecetteDetailModal from "../components/menu/RecetteDetailModal";
import { ErrorState } from "../components/states";
import { messageEcransMisAJour } from "../lib/rafraichissementGroupe";

export default function Menu() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const {
    data: allPlans,
    isLoading: loadingPlans,
    isError: plansError,
    refetch: refetchPlans,
  } = useAllPlans(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);

  /**
   * Index du plan affiché dans `allPlans` (0 = plus récent = actif si présent).
   * Réinitialisé quand la liste change (nouveau plan créé, etc.).
   */
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = Math.min(selectedIdx, Math.max(0, (allPlans?.length ?? 1) - 1));
  const currentPlan = allPlans?.[safeIdx];
  const isArchived = currentPlan?.statut === "archived";

  const { data: slots } = usePlanSlots(householdId, currentPlan?.id);
  const { data: recettesById } = usePlanRecettes(householdId, slots);
  const { data: batchSessions } = usePlanBatchSessions(householdId, currentPlan?.id);
  const { data: households } = useHouseholds(user?.uid);
  const parametresFoyer = households?.find((h) => h.id === householdId)?.parametres;
  const courses = useListeCourses(householdId, currentPlan?.id, { placardFoyer: parametresFoyer?.placard });
  const estTelephone = useEstTelephone();
  const deletePlan = useDeleteMealPlan();

  /** Modal in-place pour voir la recette sans naviguer hors de /menu. */
  const [openRecette, setOpenRecette] = useState<{
    id: string;
    portions: number;
    slotId?: string;
  } | null>(null);

  const profilsById = useMemo(
    () => Object.fromEntries((profils ?? []).map((p) => [p.id, p])),
    [profils],
  );

  const canPrev = !!allPlans && safeIdx < allPlans.length - 1;
  const canNext = safeIdx > 0;

  if (!householdId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl flex items-center gap-3">
          <ChefHat size={26} className="text-brass" aria-hidden="true" />
          Menu de la semaine
        </h1>
        <div className="flex items-center gap-2">
          {draftPlan && (
            <Link to="/menu/nouveau" className="btn-secondary text-sm flex items-center gap-2">
              <FileEdit size={14} />
              Reprendre le brouillon
            </Link>
          )}
          {!draftPlan && (
            <Link to="/menu/nouveau" className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} />
              Nouveau plan
            </Link>
          )}
        </div>
      </div>

      {loadingPlans && <p className="text-cream-mute">Chargement…</p>}

      {plansError && (
        <ErrorState
          message="Impossible de charger tes plans de repas."
          onRetry={() => void refetchPlans()}
        />
      )}

      {!loadingPlans && !plansError && (!allPlans || allPlans.length === 0) && !draftPlan && (
        <div className="tile-card text-center py-10">
          <p className="text-lg mb-2">Aucun plan actif.</p>
          <p className="text-cream-mute text-sm mb-4">
            Lance un nouveau plan pour la semaine pour générer des recettes adaptées à la
            famille et la liste de courses associée.
          </p>
          <Link to="/menu/nouveau" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} />
            Nouveau plan
          </Link>
        </div>
      )}

      {currentPlan && slots && (
        <>
          <div className="tile-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Boutons prev/next : navigation dans l'historique */}
              <div className="flex flex-col gap-1 shrink-0 pt-1">
                <button
                  type="button"
                  onClick={() => canPrev && setSelectedIdx((i) => i + 1)}
                  disabled={!canPrev}
                  title="Semaine précédente (archivée)"
                  aria-label="Semaine précédente (archivée)"
                  className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded border border-bordure text-cream-mute hover:text-brass hover:border-brass disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => canNext && setSelectedIdx((i) => i - 1)}
                  disabled={!canNext}
                  title="Semaine suivante"
                  aria-label="Semaine suivante"
                  className="p-2.5 min-h-11 min-w-11 flex items-center justify-center rounded border border-bordure text-cream-mute hover:text-brass hover:border-brass disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="eyebrow">{isArchived ? "Plan archivé" : "Plan actif"}</p>
                  {isArchived && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-brass/40 bg-brass/10 text-brass">
                      <Archive size={10} />
                      Historique
                    </span>
                  )}
                  {allPlans && allPlans.length > 1 && (
                    <span className="text-[10px] text-cream-mute tabular-nums">
                      {safeIdx + 1} / {allPlans.length}
                    </span>
                  )}
                </div>
                <p className="text-lg mt-1">
                  Semaine du{" "}
                  {currentPlan.dateDebut instanceof Date
                    ? currentPlan.dateDebut.toLocaleDateString("fr-FR")
                    : new Date(
                        (currentPlan.dateDebut as { seconds: number }).seconds * 1000,
                      ).toLocaleDateString("fr-FR")}
                </p>
                <p className="text-cream-mute text-xs mt-0.5">
                  {courses.articles.length} article{courses.articles.length > 1 ? "s" : ""} de courses
                  {(batchSessions && batchSessions.length > 0)
                    ? ` · ${batchSessions.length} session${batchSessions.length > 1 ? "s" : ""} batch`
                    : ""}
                </p>
                {currentPlan.commentaireImport && (
                  <p className="text-cream-mute italic font-serif text-sm mt-2 max-w-prose">
                    « {currentPlan.commentaireImport} »
                  </p>
                )}
              </div>
            </div>
            {!isArchived && (
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Supprimer définitivement ce plan ? Cette action est irréversible.",
                    )
                  )
                    return;
                  await deletePlan.mutateAsync({ householdId, planId: currentPlan.id });
                }}
                title="Supprimer le plan"
                aria-label="Supprimer le plan"
                className="text-cream-mute hover:text-copper text-sm flex items-center gap-1"
              >
                <Trash2 size={14} aria-hidden="true" />
                Supprimer
              </button>
            )}
          </div>

          {!isArchived && <RefreshDisplaysBar householdId={householdId} />}

          <MealPlanGrid
            slots={slots}
            recettesById={recettesById ?? {}}
            profilsById={profilsById as never}
            dateDebut={getDateFromTimestamp(currentPlan.dateDebut)}
            dateFin={getDateFromTimestamp(currentPlan.dateFin)}
            onOpenRecette={(id, portions, slotId) =>
              setOpenRecette({ id, portions, slotId })
            }
            // Édition inline uniquement sur le plan actif. Sur un plan
            // archivé, la grille est read-only (pas de notes, pas d'annulé).
            editableHouseholdId={isArchived ? undefined : householdId}
            editablePlanId={isArchived ? undefined : currentPlan.id}
          />

          {batchSessions && batchSessions.length > 0 && (
            <BatchSessionsSection
              householdId={householdId}
              planId={currentPlan.id}
              sessions={batchSessions}
              recettesById={recettesById ?? {}}
              onOpenRecette={(id, portions) => setOpenRecette({ id, portions })}
            />
          )}

          {/* Liste de courses : cachée sur les plans archivés (sans intérêt). Sur
              le téléphone, elle vit dans l'onglet Courses. */}
          {!isArchived && courses.liste && !courses.chargement && !estTelephone && (
            <SectionCoursesPc
              courses={courses}
              profils={profils ?? []}
              modeleDrive={parametresFoyer?.modeleRechercheDrive}
            />
          )}
          {!isArchived && courses.liste && estTelephone && (
            <Link to="/courses" className="tile-card flex items-center gap-2 text-cream">
              <ShoppingCart size={20} className="text-brass" aria-hidden="true" />
              La liste de courses est dans l'onglet Courses
            </Link>
          )}
        </>
      )}

      {openRecette && householdId && (
        <RecetteDetailModal
          householdId={householdId}
          recetteId={openRecette.id}
          initialPortions={openRecette.portions}
          planId={currentPlan?.id}
          slotId={openRecette.slotId}
          onClose={() => setOpenRecette(null)}
        />
      )}
    </div>
  );
}

// ───── Mise à jour manuelle des écrans ─────────────────────────────────

/**
 * Le serveur ne recalcule le menu et la recette du jour qu'une fois par nuit
 * (les créneaux modifiés le déclenchent aussi) : ce bouton force la mise à jour
 * de tous les écrans tout de suite, météo et agenda compris.
 */
function RefreshDisplaysBar({ householdId }: { householdId: string }) {
  const refresh = useRefreshHouseholdDisplays();
  const [status, setStatus] = useState<
    { kind: "success"; message: string } | { kind: "error"; message: string } | null
  >(null);

  async function handleClick() {
    setStatus(null);
    try {
      const res = await refresh.mutateAsync({ householdId });
      setStatus({ kind: "success", message: messageEcransMisAJour(res) });
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          "La mise à jour des écrans a échoué" +
          (err instanceof Error && err.message ? ` : ${err.message}` : "."),
      });
    }
  }

  return (
    <div className="tile-card !p-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={refresh.isPending}
        className="btn-secondary text-sm flex items-center gap-2 shrink-0"
      >
        {refresh.isPending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw size={14} aria-hidden="true" />
        )}
        {refresh.isPending ? "Mise à jour…" : "Mettre à jour les écrans"}
      </button>
      <div className="flex-1 min-w-[200px]">
        <p className="text-cream-mute text-xs">
          Les écrans se mettent à jour automatiquement chaque nuit ; utilise ce bouton après
          avoir créé ou modifié un menu.
        </p>
        {status && (
          <p
            role="status"
            className={`text-sm mt-1 ${status.kind === "success" ? "text-sage" : "text-copper"}`}
          >
            {status.kind === "success" && <Check size={14} className="inline mr-1" aria-hidden="true" />}
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

function getDateFromTimestamp(ts: unknown): Date | undefined {
  if (!ts) return undefined;
  if (ts instanceof Date) return ts;
  if (typeof ts === "object" && ts && "seconds" in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  if (typeof ts === "string") return new Date(ts);
  return undefined;
}

// ───── Batch sessions section ──────────────────────────────────────────

function BatchSessionsSection({
  householdId,
  planId,
  sessions,
  recettesById,
  onOpenRecette,
}: {
  householdId: string;
  planId: string;
  sessions: BatchSessionWithId[];
  recettesById: Record<string, RecetteWithId>;
  onOpenRecette?: (recetteId: string, portions: number) => void;
}) {
  const toggleDone = useToggleBatchSessionDone();

  return (
    <section className="space-y-3">
      <h2 className="text-xl flex items-center gap-2">
        <Clock size={20} className="text-brass" aria-hidden="true" />
        Batch cooking de la semaine
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((s) => {
          const dateLabel = formatDateFr(s.date);
          const recettes = s.recetteIds
            .map((rid) => recettesById[rid])
            .filter(Boolean);
          return (
            <div
              key={s.id}
              className={`tile-card space-y-2 ${s.done ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{dateLabel}</p>
                  <p className="text-cream-mute text-xs mt-0.5">
                    Durée estimée : {s.dureeEstimeeMinutes} min
                  </p>
                </div>
                <button
                  onClick={() =>
                    toggleDone.mutate({
                      householdId,
                      planId,
                      sessionId: s.id,
                      currentDone: s.done,
                    })
                  }
                  className="shrink-0 p-2.5 -m-2.5 min-h-11 min-w-11 flex items-center justify-center"
                  title={s.done ? "Marquer non terminée" : "Marquer terminée"}
                  aria-label={s.done ? "Marquer non terminée" : "Marquer terminée"}
                  aria-pressed={s.done}
                >
                  {s.done ? (
                    <CheckCircle2 size={22} className="text-sage" aria-hidden="true" />
                  ) : (
                    <Circle size={22} className="text-cream-mute hover:text-brass transition" aria-hidden="true" />
                  )}
                </button>
              </div>
              {recettes.length > 0 && (
                <ul className="text-sm space-y-1">
                  {recettes.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="text-brass">·</span>
                      {onOpenRecette ? (
                        <button
                          type="button"
                          onClick={() => onOpenRecette(r.id, r.portions)}
                          className="hover:text-brass transition text-left"
                        >
                          {r.nom}
                        </button>
                      ) : (
                        <Link
                          to={`/livre-recettes/${r.id}`}
                          className="hover:text-brass transition"
                        >
                          {r.nom}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {s.notes && (
                <p className="text-xs text-cream-mute italic font-serif border-t border-wood-dark pt-2 mt-2">
                  {s.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ───── helpers ─────────────────────────────────────────────────────────

function formatDateFr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}
