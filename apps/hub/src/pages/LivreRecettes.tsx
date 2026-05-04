import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Filter,
  Heart,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useRecettes, type RecetteWithId } from "../lib/queries";
import {
  useDeleteRecette,
  useDownvoteRecette,
  useRestoreRecette,
  useUpvoteRecette,
} from "../lib/mutations";

type FilterMode = "tous" | "favoris" | "exclus";

export default function LivreRecettes() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recettes, isLoading } = useRecettes(householdId);
  const upvote = useUpvoteRecette();
  const downvote = useDownvoteRecette();
  const restore = useRestoreRecette();
  const del = useDeleteRecette();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("tous");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!recettes) return [];
    let list = recettes;
    if (filter === "favoris") list = list.filter((r) => r.statut === "favorite" && !r.excluded);
    else if (filter === "exclus") list = list.filter((r) => r.excluded);
    else list = list.filter((r) => !r.excluded);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.nom.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.seedTags?.styleCulinaire?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [recettes, search, filter]);

  if (!householdId) return null;

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    if (!recettes) return { tous: 0, favoris: 0, exclus: 0 };
    return {
      tous: recettes.filter((r) => !r.excluded).length,
      favoris: recettes.filter((r) => r.statut === "favorite" && !r.excluded).length,
      exclus: recettes.filter((r) => r.excluded).length,
    };
  }, [recettes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl flex items-center gap-3">
          <BookOpen size={26} className="text-brass" />
          Livre de recettes
        </h1>
      </div>

      <div className="tile-card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-cream-mute" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher par nom, tag, style…"
            className="input !py-2 flex-1"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-cream-mute mr-1" />
          {(["tous", "favoris", "exclus"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest rounded-sm transition ${
                filter === mode
                  ? "bg-brass text-ebony"
                  : "text-cream-mute hover:text-cream"
              }`}
            >
              {mode === "tous" ? "Actives" : mode === "favoris" ? "Favorites" : "Exclues"}
              <span className="ml-1.5 opacity-60">
                {counts[mode]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-cream-mute">Chargement…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="tile-card text-center py-10 text-cream-mute">
          {recettes && recettes.length === 0 ? (
            <>
              <p className="mb-2">Aucune recette dans le livre.</p>
              <p className="text-sm">
                Lance le script de seed depuis ton PC :
                <code className="block mt-2 px-2 py-1 bg-ebony-ridge rounded text-xs text-brass">
                  cd scripts/seedRecipes && npm run seed -- --household {householdId}
                </code>
              </p>
            </>
          ) : (
            <p>Aucune recette ne correspond à ce filtre.</p>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <RecetteCard
              key={r.id}
              recette={r}
              busy={busyId === r.id}
              onUpvote={() =>
                withBusy(r.id, () => upvote.mutateAsync({ householdId, recetteId: r.id }))
              }
              onDownvote={() =>
                withBusy(r.id, () => downvote.mutateAsync({ householdId, recetteId: r.id }))
              }
              onRestore={() =>
                withBusy(r.id, () => restore.mutateAsync({ householdId, recetteId: r.id }))
              }
              onDelete={async () => {
                if (!confirm(`Supprimer définitivement "${r.nom}" ?`)) return;
                await withBusy(r.id, () => del.mutateAsync({ householdId, recetteId: r.id }));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecetteCard({
  recette,
  busy,
  onUpvote,
  onDownvote,
  onRestore,
  onDelete,
}: {
  recette: RecetteWithId;
  busy: boolean;
  onUpvote: () => void;
  onDownvote: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const isFav = recette.statut === "favorite" && !recette.excluded;
  const isExcluded = !!recette.excluded;
  const tt = recette.tempsPrepMinutes + recette.tempsCuissonMinutes;

  return (
    <div className={`tile-card !p-4 flex flex-col gap-2 ${isExcluded ? "opacity-50" : ""}`}>
      <Link to={`/livre-recettes/${recette.id}`} className="space-y-2 hover:opacity-90 transition">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg leading-tight flex-1">{recette.nom}</h3>
          {isFav && <Heart size={14} className="text-brass shrink-0 mt-1" fill="currentColor" />}
        </div>

        {recette.description && (
          <p className="text-cream-mute text-xs leading-snug line-clamp-3">{recette.description}</p>
        )}
      </Link>

      <div className="flex flex-wrap gap-1 mt-1">
        {recette.tags.slice(0, 4).map((t) => (
          <span key={t} className="text-[9px] uppercase tracking-widest text-cream-mute bg-ebony-ridge px-2 py-0.5 rounded-sm">
            {t}
          </span>
        ))}
        {recette.estBatch && (
          <span className="text-[9px] uppercase tracking-widest text-brass bg-brass-soft px-2 py-0.5 rounded-sm">
            BATCH
          </span>
        )}
      </div>

      <div className="text-[10px] text-cream-mute flex flex-wrap gap-2 mt-1">
        <span>{tt} min</span>
        <span>·</span>
        <span>{recette.portions} pers</span>
        {recette.seedTags?.proteinePrincipale && (
          <>
            <span>·</span>
            <span>{recette.seedTags.proteinePrincipale}</span>
          </>
        )}
        {recette.seedTags?.styleCulinaire && (
          <>
            <span>·</span>
            <span>{recette.seedTags.styleCulinaire}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 pt-2 border-t border-wood-dark mt-1">
        {!isExcluded && (
          <>
            <button
              onClick={onUpvote}
              disabled={busy}
              className={`p-1.5 transition ${
                isFav ? "text-brass" : "text-cream-mute hover:text-brass"
              }`}
              title={isFav ? "Déjà favorite" : "Marquer favorite"}
            >
              <ThumbsUp size={14} fill={isFav ? "currentColor" : "none"} />
            </button>
            <button
              onClick={onDownvote}
              disabled={busy}
              className="p-1.5 text-cream-mute hover:text-copper transition"
              title="Exclure (ne plus piocher dans les plans)"
            >
              <ThumbsDown size={14} />
            </button>
          </>
        )}
        {isExcluded && (
          <button
            onClick={onRestore}
            disabled={busy}
            className="p-1.5 text-cream-mute hover:text-sage transition flex items-center gap-1 text-xs"
            title="Restaurer"
          >
            <RotateCcw size={12} />
            Restaurer
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={busy}
          className="p-1.5 text-cream-mute hover:text-copper transition"
          title="Supprimer définitivement"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
