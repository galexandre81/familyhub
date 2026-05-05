import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Copy,
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
  useAddShoppingItem,
  useDeleteMealPlan,
  useMarkShoppingShared,
  useRemoveShoppingItem,
  useToggleBatchSessionDone,
  useToggleShoppingItem,
} from "../lib/mutations";
import MealPlanGrid from "../components/menu/MealPlanGrid";
import RecetteDetailModal from "../components/menu/RecetteDetailModal";

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
            onOpenRecette={(id, portions, slotId) =>
              setOpenRecette({ id, portions, slotId })
            }
          />

          {batchSessions && batchSessions.length > 0 && (
            <BatchSessionsSection
              householdId={householdId}
              planId={activePlan.id}
              sessions={batchSessions}
              recettesById={recettesById ?? {}}
              onOpenRecette={(id, portions) => setOpenRecette({ id, portions })}
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

      {openRecette && householdId && (
        <RecetteDetailModal
          householdId={householdId}
          recetteId={openRecette.id}
          initialPortions={openRecette.portions}
          planId={activePlan?.id}
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
          <ShoppingCart size={20} className="text-brass" />
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
            <li key={it.id} className="flex items-start gap-1 group">
              <button
                onClick={() => onToggle(it.id)}
                className="flex items-start gap-2 flex-1 text-left text-sm py-1 -my-1 hover:bg-bordure/20 rounded transition"
              >
                <span className="shrink-0 mt-1 sm:mt-0.5">
                  {it.checked ? (
                    <CheckCircle2 size={20} className="text-sage sm:w-4 sm:h-4" />
                  ) : (
                    <Circle size={20} className="text-cream-mute hover:text-brass transition sm:w-4 sm:h-4" />
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
                  className="text-cream-mute hover:text-copper opacity-0 group-hover:opacity-100 transition shrink-0 p-1"
                  title="Retirer cet item"
                >
                  <X size={14} />
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
