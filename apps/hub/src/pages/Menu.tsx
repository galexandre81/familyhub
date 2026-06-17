import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Download,
  FileEdit,
  Filter,
  Loader2,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useAllPlans,
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
  useAddShoppingItem,
  useDeleteMealPlan,
  useMarkShoppingShared,
  useRemoveShoppingItem,
  useToggleBatchSessionDone,
  useToggleShoppingItem,
} from "../lib/mutations";
import MealPlanGrid from "../components/menu/MealPlanGrid";
import RecetteDetailModal from "../components/menu/RecetteDetailModal";
import { ErrorState } from "../components/states";

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
  const { data: shoppingList } = usePlanShoppingList(householdId, currentPlan?.id);
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
                  {(shoppingList?.items.length ?? 0)} items de courses
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

          {/* Liste de courses : cachée sur les plans archivés (sans intérêt). */}
          {!isArchived && shoppingList && (
            <ShoppingListSection
              householdId={householdId}
              planId={currentPlan.id}
              list={shoppingList}
              uid={user?.uid ?? ""}
            />
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
  const remove = useRemoveShoppingItem();
  const add = useAddShoppingItem();
  const markShared = useMarkShoppingShared();
  const [hideChecked, setHideChecked] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">("idle");

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
  const sharedAtDate = tsToDate(list.lastSharedAt);
  const sharedLabel = sharedAtDate ? formatRelativeTime(sharedAtDate) : null;

  async function handleShare() {
    setShareState("sharing");
    const text = buildShareText(list);
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    let usedTo = "partage natif";
    let success = false;
    if (canShare) {
      try {
        await navigator.share({ title: "Liste de courses Family Hub", text });
        success = true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled, no error
          setShareState("idle");
          return;
        }
        // Fall through to clipboard fallback
      }
    }
    if (!success) {
      try {
        await navigator.clipboard.writeText(text);
        usedTo = "presse-papier";
        success = true;
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2500);
      } catch {
        setShareState("idle");
        alert(
          "Impossible de partager. Copie manuellement la liste ci-dessous :\n\n" + text,
        );
        return;
      }
    }
    if (success) {
      try {
        await markShared.mutateAsync({
          householdId,
          listId: list.id,
          planId,
          sharedTo: usedTo,
        });
      } catch {
        /* non bloquant : le share a marché côté user, juste pas tracké */
      }
      if (canShare) setShareState("idle");
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl flex items-center gap-2">
          <ShoppingCart size={20} className="text-brass" aria-hidden="true" />
          Liste de courses
          <span className="text-sm text-cream-mute font-normal">
            ({checkedCount} / {list.items.length})
          </span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="text-xs text-cream-mute hover:text-cream flex items-center gap-1"
          >
            {addOpen ? <X size={12} /> : <Plus size={12} />}
            {addOpen ? "Annuler" : "Ajouter"}
          </button>
          <button
            onClick={() => setHideChecked((v) => !v)}
            className="text-xs text-cream-mute hover:text-cream flex items-center gap-1"
          >
            <Filter size={12} />
            {hideChecked ? "Afficher cochés" : "Masquer cochés"}
          </button>
        </div>
      </div>

      {/* Bouton Envoyer aux courses — proéminent (sticky en mobile via tile-card) */}
      <ShareButton
        sharedLabel={sharedLabel}
        sharingNow={shareState === "sharing"}
        copied={shareState === "copied"}
        onShare={handleShare}
        canShare={typeof navigator !== "undefined" && typeof navigator.share === "function"}
      />

      {/* Bouton HTML — fallback fiable si Web Share rate ou si l'utilisateur
          veut juste un fichier à envoyer par mail / AirDrop / partage natif OS */}
      <button
        type="button"
        onClick={() => {
          const html = buildShareHtml(list);
          const today = new Date().toISOString().slice(0, 10);
          const blob = new Blob([html], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `liste-courses-${today}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
        className="tile-card !p-2.5 w-full flex items-center justify-center gap-2 text-sm text-cream-mute hover:text-cream transition"
      >
        <Download size={14} />
        Télécharger en HTML (mail / AirDrop)
      </button>

      {/* Hint workflow Keep — visible toujours, discret */}
      <p className="text-[11px] text-cream-mute italic">
        Astuce : envoie vers <strong>Keep</strong>, puis long-press la note dans
        Keep → <em>Afficher les cases à cocher</em>. Tu coches en faisant les
        courses, hors-ligne. Si Keep ne marche pas, le bouton HTML te donne
        un fichier autonome (checkboxes cliquables, ouvre depuis téléphone).
      </p>

      {addOpen && (
        <AddItemForm
          onAdd={(item) => {
            add.mutate({
              householdId,
              listId: list.id,
              planId,
              currentItems: list.items,
              item,
            });
            setAddOpen(false);
          }}
        />
      )}

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
            onRemove={(itemId) =>
              remove.mutate({
                householdId,
                listId: list.id,
                planId,
                itemId,
                currentItems: list.items,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function ShareButton({
  sharedLabel,
  sharingNow,
  copied,
  onShare,
  canShare,
}: {
  sharedLabel: string | null;
  sharingNow: boolean;
  copied: boolean;
  onShare: () => void;
  canShare: boolean;
}) {
  const label = copied
    ? "Liste copiée ! Colle-la dans Keep / Notes / Messages."
    : sharedLabel
      ? `Envoyée ${sharedLabel} · toucher pour renvoyer`
      : canShare
        ? "Envoyer aux courses"
        : "Copier la liste";
  const Icon = copied ? Check : sharingNow ? Loader2 : canShare ? Send : Copy;
  return (
    <button
      onClick={onShare}
      disabled={sharingNow}
      className={`tile-card !p-3 w-full flex items-center justify-center gap-3 transition ${
        sharedLabel
          ? "text-cream-mute hover:text-cream"
          : "text-brass hover:bg-bordure/30"
      } ${copied ? "ring-1 ring-sage" : ""}`}
    >
      <Icon size={18} className={sharingNow ? "animate-spin" : ""} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function AddItemForm({
  onAdd,
}: {
  onAdd: (item: {
    nom: string;
    quantite: number;
    unite: string;
    rayon: ShoppingListWithId["items"][number]["rayon"];
  }) => void;
}) {
  const [nom, setNom] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [unite, setUnite] = useState("u");
  const [rayon, setRayon] = useState<string>("autres");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    const q = parseFloat(quantite.replace(",", "."));
    onAdd({
      nom: nom.trim(),
      quantite: Number.isFinite(q) && q > 0 ? q : 1,
      unite: unite.trim() || "u",
      rayon: rayon as ShoppingListWithId["items"][number]["rayon"],
    });
  }

  return (
    <form onSubmit={submit} className="tile-card flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] uppercase tracking-widest text-cream-mute mb-1">
          Nom
        </label>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          autoFocus
          placeholder="ex: yaourts nature"
          className="input !py-2"
        />
      </div>
      <div className="w-20">
        <label className="block text-[10px] uppercase tracking-widest text-cream-mute mb-1">
          Qté
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          className="input !py-2"
        />
      </div>
      <div className="w-20">
        <label className="block text-[10px] uppercase tracking-widest text-cream-mute mb-1">
          Unité
        </label>
        <input
          type="text"
          value={unite}
          onChange={(e) => setUnite(e.target.value)}
          className="input !py-2"
        />
      </div>
      <div className="min-w-[140px]">
        <label className="block text-[10px] uppercase tracking-widest text-cream-mute mb-1">
          Rayon
        </label>
        <select
          value={rayon}
          onChange={(e) => setRayon(e.target.value)}
          className="input !py-2"
        >
          {RAYON_ORDER.map((r) => (
            <option key={r} value={r}>
              {RAYON_LABELS[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary !py-2 flex items-center gap-1">
        <Plus size={14} />
        Ajouter
      </button>
    </form>
  );
}

function RayonGroup({
  rayon,
  items,
  onToggle,
  onRemove,
}: {
  rayon: string;
  items: ShoppingListWithId["items"];
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const label = RAYON_LABELS[rayon] ?? rayon;
  const panelId = `rayon-panel-${rayon}`;

  return (
    <div className="tile-card space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-2 w-full text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-cream-mute" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="text-cream-mute" aria-hidden="true" />
        )}
        <span className="eyebrow">{label}</span>
        <span className="text-xs text-cream-mute ml-auto">
          {items.filter((i) => !i.checked).length} / {items.length}
        </span>
      </button>
      {open && (
        <ul id={panelId} className="space-y-1 pl-4">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-1 group">
              <button
                onClick={() => onToggle(it.id)}
                className="flex items-start gap-2 flex-1 text-left text-sm py-1 -my-1 hover:bg-bordure/20 rounded transition"
              >
                <span className="shrink-0 mt-1 sm:mt-0.5">
                  {it.checked ? (
                    <CheckCircle2 size={20} className="text-sage sm:w-4 sm:h-4" aria-hidden="true" />
                  ) : (
                    <Circle size={20} className="text-cream-mute hover:text-brass transition sm:w-4 sm:h-4" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={`flex-1 ${it.checked ? "line-through text-cream-mute" : ""}`}
                >
                  <span className="tabular-nums">
                    {formatQuantite(it.quantite, it.unite)}
                  </span>{" "}
                  {it.nom}
                  {it.ajoutManuel && (
                    <span className="ml-1 text-[9px] uppercase tracking-widest text-cream-mute">
                      ajouté
                    </span>
                  )}
                </span>
              </button>
              {it.ajoutManuel && (
                <button
                  onClick={() => onRemove(it.id)}
                  className="text-cream-mute hover:text-copper focus-visible:text-copper transition shrink-0 p-2.5 min-h-11 min-w-11 flex items-center justify-center"
                  title={`Retirer ${it.nom}`}
                  aria-label={`Retirer ${it.nom}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
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
  const num = Number.isInteger(q) ? String(q) : q.toFixed(1);
  return `${num} ${unite}`.trim();
}

/**
 * Convertit un Timestamp Firestore (web SDK ou shape sérialisée) en Date.
 * Renvoie null si absent ou invalide.
 */
function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === "object" && ts !== null) {
    if ("toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
      return (ts as { toDate: () => Date }).toDate();
    }
    if ("seconds" in ts) {
      return new Date((ts as { seconds: number }).seconds * 1000);
    }
  }
  return null;
}

function formatRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

/**
 * Format texte pour Web Share / Keep / Notes.
 * Cf. brief §7.4 — items non-cochés groupés par rayon.
 */
function buildShareText(list: ShoppingListWithId): string {
  const items = list.items.filter((it) => !it.checked);
  const byRayon: Record<string, typeof items> = {};
  for (const it of items) {
    const k = it.rayon || "autres";
    if (!byRayon[k]) byRayon[k] = [];
    byRayon[k].push(it);
  }
  const ordered: Array<[string, typeof items]> = [];
  for (const k of RAYON_ORDER) {
    if (byRayon[k]) ordered.push([k, byRayon[k]]);
  }
  for (const k of Object.keys(byRayon)) {
    if (!RAYON_ORDER.includes(k)) ordered.push([k, byRayon[k]]);
  }
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const lines: string[] = [];
  lines.push(`Liste de courses — ${today}`);
  lines.push("");
  for (const [rayon, list] of ordered) {
    lines.push(`▸ ${RAYON_LABELS[rayon] ?? rayon}`);
    for (const it of list) {
      const qty = formatQuantite(it.quantite, it.unite);
      lines.push(`☐ ${it.nom}${qty ? ` — ${qty}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/**
 * Génère un HTML self-contained pour la liste de courses, téléchargeable
 * en .html. Cases à cocher cliquables, groupé par rayon, CSS inline pour
 * que le fichier marche partout (mail, AirDrop, ouvert depuis téléphone).
 */
function buildShareHtml(list: ShoppingListWithId): string {
  const items = list.items.filter((it) => !it.checked);
  const byRayon: Record<string, typeof items> = {};
  for (const it of items) {
    const k = it.rayon || "autres";
    if (!byRayon[k]) byRayon[k] = [];
    byRayon[k].push(it);
  }
  const ordered: Array<[string, typeof items]> = [];
  for (const k of RAYON_ORDER) {
    if (byRayon[k]) ordered.push([k, byRayon[k]]);
  }
  for (const k of Object.keys(byRayon)) {
    if (!RAYON_ORDER.includes(k)) ordered.push([k, byRayon[k]]);
  }
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const sections = ordered
    .map(([rayon, list]) => {
      const lis = list
        .map((it) => {
          const qty = formatQuantite(it.quantite, it.unite);
          return `<li><label><input type="checkbox"> <span class="n">${esc(it.nom)}</span>${qty ? `<span class="q"> — ${esc(qty)}</span>` : ""}</label></li>`;
        })
        .join("\n");
      return `<section><h2>${esc(RAYON_LABELS[rayon] ?? rayon)}</h2><ul>${lis}</ul></section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Liste de courses — ${esc(today)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 640px; margin: 0 auto; padding: 20px 16px 80px;
         background: #FAFAF7; color: #1F1A14; line-height: 1.4; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .date { font-size: 13px; color: #6B5A47; margin-bottom: 24px; font-style: italic; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em;
       color: #B26E38; border-bottom: 1px solid #D4C7AC; padding-bottom: 4px;
       margin: 24px 0 10px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
  label { display: flex; align-items: baseline; gap: 10px; cursor: pointer;
          font-size: 16px; }
  input[type="checkbox"] { width: 20px; height: 20px; flex-shrink: 0;
                            accent-color: #B26E38; cursor: pointer; }
  input[type="checkbox"]:checked + .n { text-decoration: line-through;
                                          color: #9C8A6E; }
  .q { color: #6B5A47; font-size: 14px; }
  @media print {
    body { background: white; }
    input[type="checkbox"] { border: 1.5px solid #333; }
  }
</style>
</head>
<body>
<h1>Liste de courses</h1>
<div class="date">${esc(today)}</div>
${sections}
</body>
</html>`;
}
