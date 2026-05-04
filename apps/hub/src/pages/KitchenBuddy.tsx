import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChefHat, FileEdit, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useActivePlan,
  useDraftPlan,
  usePlanCourses,
  usePlanRecettes,
  usePlanSlots,
  useProfils,
} from "../lib/queries";
import { useDeleteMealPlan } from "../lib/mutations";
import MealPlanGrid from "../components/kitchenBuddy/MealPlanGrid";

export default function KitchenBuddy() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const { data: activePlan, isLoading: loadingActive } = useActivePlan(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);
  const { data: slots } = usePlanSlots(householdId, activePlan?.id);
  const { data: recettesById } = usePlanRecettes(householdId, slots);
  const { data: courses } = usePlanCourses(householdId, activePlan?.id);
  const deletePlan = useDeleteMealPlan();

  const profilsById = useMemo(
    () => Object.fromEntries((profils ?? []).map((p) => [p.id, p])),
    [profils],
  );

  if (!householdId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl flex items-center gap-3">
          <ChefHat size={26} className="text-brass" />
          Kitchen Buddy
        </h1>
        <div className="flex items-center gap-2">
          <Link to="/kitchen-buddy/livre" className="btn-secondary text-sm flex items-center gap-2">
            <BookOpen size={14} />
            Livre de recettes
          </Link>
          {draftPlan && (
            <Link to="/kitchen-buddy/nouveau-plan" className="btn-secondary text-sm flex items-center gap-2">
              <FileEdit size={14} />
              Reprendre le brouillon
            </Link>
          )}
          {!draftPlan && (
            <Link to="/kitchen-buddy/nouveau-plan" className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} />
              Nouveau plan
            </Link>
          )}
        </div>
      </div>

      {loadingActive && <p className="text-cream-mute">Chargement…</p>}

      {!loadingActive && !activePlan && !draftPlan && (
        <div className="tile-card text-center py-10">
          <p className="text-lg mb-2">Aucun plan actif.</p>
          <p className="text-cream-mute text-sm mb-4">
            Lance un nouveau plan pour la semaine pour générer des recettes adaptées à la
            famille et la liste de courses associée.
          </p>
          <Link to="/kitchen-buddy/nouveau-plan" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} />
            Nouveau plan
          </Link>
        </div>
      )}

      {activePlan && slots && (
        <>
          <div className="tile-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Plan actif</p>
              <p className="text-lg mt-1">
                Semaine du{" "}
                {activePlan.dateDebut instanceof Date
                  ? activePlan.dateDebut.toLocaleDateString("fr-FR")
                  : new Date(
                      (activePlan.dateDebut as { seconds: number }).seconds * 1000,
                    ).toLocaleDateString("fr-FR")}
              </p>
              <p className="text-cream-mute text-xs mt-0.5">
                {courses?.length ?? 0} item{(courses?.length ?? 0) > 1 ? "s" : ""} de courses
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Archiver ce plan actif ? (suppression complète)")) return;
                await deletePlan.mutateAsync({ householdId, planId: activePlan.id });
              }}
              className="text-cream-mute hover:text-copper text-sm flex items-center gap-1"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          </div>

          <MealPlanGrid
            slots={slots}
            recettesById={recettesById ?? {}}
            profilsById={profilsById as never}
            dateDebut={getDateFromTimestamp(activePlan.dateDebut)}
          />
        </>
      )}
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
