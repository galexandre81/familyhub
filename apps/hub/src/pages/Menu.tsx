import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FileEdit,
  Filter,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useActivePlan,
  useDraftPlan,
  usePlanBatchSessions,
  usePlanRecettes,
  usePlanShoppingList,
  usePlanSlots,
  useProfils,
  type BatchSessionWithId,
  type RecetteWithId,
  type ShoppingListWithId,
} from "../lib/queries";
import {
  useDeleteMealPlan,
  useToggleBatchSessionDone,
  useToggleShoppingItem,
} from "../lib/mutations";
import MealPlanGrid from "../components/menu/MealPlanGrid";

export default function Menu() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const { data: activePlan, isLoading: loadingActive } = useActivePlan(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);
  const { data: slots } = usePlanSlots(householdId, activePlan?.id);
  const { data: recettesById } = usePlanRecettes(householdId, slots);
  const { data: batchSessions } = usePlanBatchSessions(householdId, activePlan?.id);
  const { data: shoppingList } = usePlanShoppingList(householdId, activePlan?.id);
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

      {loadingActive && <p className="text-cream-mute">Chargement…</p>}

      {!loadingActive && !activePlan && !draftPlan && (
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
                {(shoppingList?.items.length ?? 0)} items de courses
                {(batchSessions && batchSessions.length > 0)
                  ? ` · ${batchSessions.length} session${batchSessions.length > 1 ? "s" : ""} batch`
                  : ""}
              </p>
              {activePlan.commentaireImport && (
                <p className="text-cream-mute italic font-serif text-sm mt-2 max-w-prose">
                  « {activePlan.commentaireImport} »
                </p>
              )}
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

          {batchSessions && batchSessions.length > 0 && (
            <BatchSessionsSection
              householdId={householdId}
              planId={activePlan.id}
              sessions={batchSessions}
              recettesById={recettesById ?? {}}
            />
          )}

          {shoppingList && (
            <ShoppingListSection
              householdId={householdId}
              planId={activePlan.id}
              list={shoppingList}
              uid={user?.uid ?? ""}
            />
          )}
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

// ───── Batch sessions section ──────────────────────────────────────────

function BatchSessionsSection({
  householdId,
  planId,
  sessions,
  recettesById,
}: {
  householdId: string;
  planId: string;
  sessions: BatchSessionWithId[];
  recettesById: Record<string, RecetteWithId>;
}) {
  const toggleDone = useToggleBatchSessionDone();

  return (
    <section className="space-y-3">
      <h2 className="text-xl flex items-center gap-2">
        <Clock size={20} className="text-brass" />
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
                  className="shrink-0"
                  title={s.done ? "Marquer non terminée" : "Marquer terminée"}
                >
                  {s.done ? (
                    <CheckCircle2 size={22} className="text-sage" />
                  ) : (
                    <Circle size={22} className="text-cream-mute hover:text-brass transition" />
                  )}
                </button>
              </div>
              {recettes.length > 0 && (
                <ul className="text-sm space-y-1">
                  {recettes.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="text-brass">·</span>
                      <Link
                        to={`/livre-recettes/${r.id}`}
                        className="hover:text-brass transition"
                      >
                        {r.nom}
                      </Link>
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

// ───── Shopping list section ───────────────────────────────────────────

const RAYON_LABELS: Record<string, string> = {
  // Phase 3 (import claude.ai)
  "fruits-legumes": "Fruits & légumes",
  boucherie: "Boucherie",
  poissonnerie: "Poissonnerie",
  cremerie: "Crémerie",
  epicerie: "Épicerie",
  surgeles: "Surgelés",
  boulangerie: "Boulangerie",
  boissons: "Boissons",
  autres: "Autres",
  // Legacy
  "frais-fruits-legumes": "Fruits & légumes",
  "frais-laitier": "Crémerie",
  "frais-boucherie": "Boucherie",
  "frais-poissonnerie": "Poissonnerie",
  "sec-epicerie": "Épicerie",
  surgele: "Surgelés",
  autre: "Autres",
};

const RAYON_ORDER: string[] = [
  "fruits-legumes",
  "frais-fruits-legumes",
  "boulangerie",
  "boucherie",
  "frais-boucherie",
  "poissonnerie",
  "frais-poissonnerie",
  "cremerie",
  "frais-laitier",
  "epicerie",
  "sec-epicerie",
  "surgeles",
  "surgele",
  "boissons",
  "autres",
  "autre",
];

function ShoppingListSection({
  householdId,
  planId,
  list,
  uid,
}: {
  householdId: string;
  planId: string;
  list: ShoppingListWithId;
  uid: string;
}) {
  const toggle = useToggleShoppingItem();
  const [hideChecked, setHideChecked] = useState(false);

  const visible = useMemo(
    () => (hideChecked ? list.items.filter((it) => !it.checked) : list.items),
    [list.items, hideChecked],
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof list.items> = {};
    for (const it of visible) {
      const key = it.rayon || "autres";
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    // Sort by predefined order
    const ordered: Array<[string, typeof list.items]> = [];
    for (const k of RAYON_ORDER) {
      if (map[k]) ordered.push([k, map[k]]);
    }
    for (const k of Object.keys(map)) {
      if (!RAYON_ORDER.includes(k)) ordered.push([k, map[k]]);
    }
    return ordered;
  }, [visible]);

  const checkedCount = list.items.filter((i) => i.checked).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl flex items-center gap-2">
          <ShoppingCart size={20} className="text-brass" />
          Liste de courses
          <span className="text-sm text-cream-mute font-normal">
            ({checkedCount} / {list.items.length})
          </span>
        </h2>
        <button
          onClick={() => setHideChecked((v) => !v)}
          className="text-xs text-cream-mute hover:text-cream flex items-center gap-1"
        >
          <Filter size={12} />
          {hideChecked ? "Afficher cochés" : "Masquer cochés"}
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="text-cream-mute italic text-sm">Tout est coché ✨</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {grouped.map(([rayon, items]) => (
          <RayonGroup
            key={rayon}
            rayon={rayon}
            items={items}
            onToggle={(itemId) =>
              toggle.mutate({
                householdId,
                listId: list.id,
                planId,
                itemId,
                items: list.items,
                uid,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function RayonGroup({
  rayon,
  items,
  onToggle,
}: {
  rayon: string;
  items: ShoppingListWithId["items"];
  onToggle: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const label = RAYON_LABELS[rayon] ?? rayon;

  return (
    <div className="tile-card space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-cream-mute" />
        ) : (
          <ChevronRight size={14} className="text-cream-mute" />
        )}
        <span className="eyebrow">{label}</span>
        <span className="text-xs text-cream-mute ml-auto">
          {items.filter((i) => !i.checked).length} / {items.length}
        </span>
      </button>
      {open && (
        <ul className="space-y-1 pl-4">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onToggle(it.id)}
                className="flex items-start gap-2 w-full text-left text-sm group"
              >
                <span className="shrink-0 mt-0.5">
                  {it.checked ? (
                    <CheckCircle2 size={16} className="text-sage" />
                  ) : (
                    <Circle size={16} className="text-cream-mute group-hover:text-brass transition" />
                  )}
                </span>
                <span
                  className={`flex-1 ${it.checked ? "line-through text-cream-mute" : ""}`}
                >
                  <span className="tabular-nums">
                    {formatQuantite(it.quantite, it.unite)}
                  </span>{" "}
                  {it.nom}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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

function formatQuantite(q: number, unite: string): string {
  if (!q || q === 0) return "";
  // Si entier : pas de décimales
  const num = Number.isInteger(q) ? String(q) : q.toFixed(1);
  return `${num} ${unite}`.trim();
}
