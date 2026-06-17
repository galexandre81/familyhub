import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Filter,
  Heart,
  Refrigerator,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useRecettes, type RecetteWithId } from "../lib/queries";
import { ErrorState } from "../components/states";
import {
  useDeleteRecette,
  useDownvoteRecette,
  useRestoreRecette,
  useUpvoteRecette,
} from "../lib/mutations";

type FilterMode = "tous" | "favoris" | "exclus";

/** Normalisation : lowercase + retire accents pour comparaison robuste. */
function deburr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[àâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/ÿ/g, "y")
    .replace(/ç/g, "c")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

/**
 * Helpers sessionStorage robustes (guard SSR / mode privé / quota).
 * On persiste recherche + filtre + frigo + scroll pour restaurer l'état
 * de la liste au retour depuis une fiche recette (UX retour arrière).
 */
const SS = {
  search: "livre.search",
  filter: "livre.filter",
  frigo: "livre.frigo",
  scrollY: "livre.scrollY",
} as const;

function ssGet(key: string): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function ssSet(key: string, value: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore (mode privé / quota) */
  }
}

export default function LivreRecettes() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recettes, isLoading, isError, refetch } = useRecettes(householdId);
  const upvote = useUpvoteRecette();
  const downvote = useDownvoteRecette();
  const restore = useRestoreRecette();
  const del = useDeleteRecette();

  // Initialisation depuis sessionStorage (restauration au retour arrière).
  const [search, setSearch] = useState(() => ssGet(SS.search) ?? "");
  const [filter, setFilter] = useState<FilterMode>(() => {
    const saved = ssGet(SS.filter);
    return saved === "favoris" || saved === "exclus" || saved === "tous"
      ? saved
      : "tous";
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Liste d'ingrédients que l'utilisateur a au frigo (chips multi-saisie). */
  const [frigo, setFrigo] = useState<string[]>(() => {
    const saved = ssGet(SS.frigo);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });
  const [frigoInput, setFrigoInput] = useState("");

  /** Vrai une fois la restauration du scroll effectuée (one-shot). */
  const scrollRestored = useRef(false);

  // Persiste recherche / filtre / frigo à chaque changement.
  useEffect(() => {
    ssSet(SS.search, search);
  }, [search]);
  useEffect(() => {
    ssSet(SS.filter, filter);
  }, [filter]);
  useEffect(() => {
    ssSet(SS.frigo, JSON.stringify(frigo));
  }, [frigo]);

  // Sauvegarde la position de scroll (window) avec un throttle léger via rAF.
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ssSet(SS.scrollY, String(window.scrollY));
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Restaure le scroll une fois la liste rendue (dépend des données chargées).
  useEffect(() => {
    if (scrollRestored.current) return;
    if (!recettes) return; // attendre que les données soient là
    const raw = ssGet(SS.scrollY);
    if (raw != null) {
      const y = parseInt(raw, 10);
      if (Number.isFinite(y) && y > 0) {
        // rAF pour laisser le layout des cartes se peindre avant de scroller.
        window.requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }
    scrollRestored.current = true;
  }, [recettes]);

  /**
   * Liste filtrée + score "frigo".
   * Si frigo est vide : pas de filtre supplémentaire, score=0.
   * Si frigo est rempli : on garde uniquement les recettes qui matchent
   *   au moins 1 ingrédient du frigo, et on trie par nb de match desc
   *   puis nb d'ingrédients manquants asc.
   */
  const filtered = useMemo(() => {
    if (!recettes) return [];
    let list = recettes;
    if (filter === "favoris") list = list.filter((r) => r.statut === "favorite" && !r.excluded);
    else if (filter === "exclus") list = list.filter((r) => r.excluded);
    else list = list.filter((r) => !r.excluded);

    if (search.trim()) {
      const q = deburr(search.toLowerCase().trim());
      list = list.filter(
        (r) =>
          deburr(r.nom.toLowerCase()).includes(q) ||
          r.tags.some((t) => deburr(t.toLowerCase()).includes(q)) ||
          (r.seedTags?.styleCulinaire &&
            deburr(r.seedTags.styleCulinaire.toLowerCase()).includes(q)),
      );
    }

    // Scoring frigo
    const frigoNorm = frigo.map((f) => deburr(f.toLowerCase().trim())).filter(Boolean);
    const scored = list.map((r) => {
      if (frigoNorm.length === 0) {
        return { recette: r, matched: 0, missing: 0 };
      }
      // Le type legacy n'a pas `optionnel` — on prend tous les ingrédients
      const recetteIngs = r.ingredients.map((i) =>
        deburr(i.libelle.toLowerCase()),
      );
      let matched = 0;
      const matchedFrigoIdx = new Set<number>();
      for (let fi = 0; fi < frigoNorm.length; fi++) {
        const f = frigoNorm[fi];
        if (!f) continue;
        const hit = recetteIngs.some((ing) => ing.includes(f) || f.includes(ing));
        if (hit) {
          matched++;
          matchedFrigoIdx.add(fi);
        }
      }
      const missing = Math.max(0, recetteIngs.length - matched);
      return { recette: r, matched, missing };
    });

    if (frigoNorm.length > 0) {
      const onlyMatches = scored.filter((s) => s.matched > 0);
      onlyMatches.sort((a, b) => {
        if (b.matched !== a.matched) return b.matched - a.matched;
        return a.missing - b.missing;
      });
      return onlyMatches;
    }
    return scored;
  }, [recettes, search, filter, frigo]);

  function addFrigo(value: string) {
    const v = value.trim();
    if (!v) return;
    if (frigo.some((f) => deburr(f.toLowerCase()) === deburr(v.toLowerCase()))) return;
    setFrigo([...frigo, v]);
    setFrigoInput("");
  }

  function removeFrigo(idx: number) {
    setFrigo(frigo.filter((_, i) => i !== idx));
  }

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

      {/* Recherche par frigo */}
      <div className="tile-card space-y-3">
        <div className="flex items-center gap-2">
          <Refrigerator size={16} className="text-brass" />
          <h2 className="text-sm uppercase tracking-widest text-cream-mute">
            Que faire avec ce qu'on a ?
          </h2>
        </div>
        <p className="text-xs text-cream-mute">
          Tape ce que tu as au frigo (un ingrédient à la fois, valide avec
          Entrée). Le livre te propose les recettes qui utilisent au moins
          un de ces ingrédients, triées par nombre de match.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {frigo.map((f, i) => (
            <span
              key={`${f}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-brass/15 text-brass border border-brass/40 rounded-sm text-xs"
            >
              {f}
              <button
                onClick={() => removeFrigo(i)}
                className="hover:text-cream"
                aria-label={`Retirer ${f}`}
              >
                <XIcon size={11} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={frigoInput}
            onChange={(e) => setFrigoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addFrigo(frigoInput);
              } else if (e.key === "Backspace" && !frigoInput && frigo.length > 0) {
                removeFrigo(frigo.length - 1);
              }
            }}
            placeholder={
              frigo.length === 0
                ? "ex: tomates, mozzarella, basilic…"
                : "+ ajouter"
            }
            className="input !py-1.5 !px-2 flex-1 min-w-[160px] text-sm"
          />
          {frigo.length > 0 && (
            <button
              onClick={() => setFrigo([])}
              className="text-xs text-cream-mute hover:text-copper underline"
            >
              vider
            </button>
          )}
        </div>
        {frigo.length > 0 && (
          <p className="text-[11px] text-cream-mute italic">
            {filtered.length} recette{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""} avec au moins un ingrédient du frigo.
          </p>
        )}
      </div>

      {isLoading && <p className="text-cream-mute">Chargement…</p>}

      {isError && (
        <ErrorState
          message="Impossible de charger le livre de recettes."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="tile-card text-center py-10 text-cream-mute">
          {recettes && recettes.length === 0 ? (
            <>
              <p className="mb-2">Aucune recette dans le livre pour l'instant.</p>
              <p className="text-sm">
                Les recettes apparaîtront ici dès que tu auras généré et importé
                un plan de repas.
              </p>
            </>
          ) : (
            <p>Aucune recette ne correspond à ce filtre.</p>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(({ recette: r, matched, missing }) => (
            <RecetteCard
              key={r.id}
              recette={r}
              busy={busyId === r.id}
              frigoMatched={frigo.length > 0 ? matched : 0}
              frigoMissing={frigo.length > 0 ? missing : 0}
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
  frigoMatched,
  frigoMissing,
  onUpvote,
  onDownvote,
  onRestore,
  onDelete,
}: {
  recette: RecetteWithId;
  busy: boolean;
  /** Nombre d'ingrédients du frigo qui matchent. 0 si pas de filtre frigo actif. */
  frigoMatched: number;
  /** Nombre d'ingrédients restants à acheter pour faire la recette. */
  frigoMissing: number;
  onUpvote: () => void;
  onDownvote: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const isFav = recette.statut === "favorite" && !recette.excluded;
  const isExcluded = !!recette.excluded;
  const tt = recette.tempsPrepMinutes + recette.tempsCuissonMinutes;
  const showFrigoBadge = frigoMatched > 0;

  return (
    <div className={`tile-card !p-4 flex flex-col gap-2 ${isExcluded ? "opacity-50" : ""}`}>
      {showFrigoBadge && (
        <div className="flex items-center gap-2 -mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-brass bg-brass/15 px-2 py-0.5 rounded-sm">
            <Refrigerator size={10} />
            {frigoMatched} du frigo utilisé{frigoMatched > 1 ? "s" : ""}
          </span>
          {frigoMissing > 0 && (
            <span className="text-[10px] uppercase tracking-widest text-cream-mute">
              · {frigoMissing} à acheter
            </span>
          )}
        </div>
      )}
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
