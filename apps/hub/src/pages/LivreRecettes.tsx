import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
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
import { ErrorState, LoadingState } from "../components/states";
import { useEstTelephone } from "../lib/useEstTelephone";
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
  nbTelephone: "livre.nbTelephone",
} as const;

/** Carte du nouveau design (PC). */
const CARTE_PC = "rounded-2xl bg-ebony-card border border-hairline p-4";

/** Téléphone : nombre de cartes rendues d'un coup (puis « Voir plus »). */
const PAS_TELEPHONE = 40;
const AUCUN_FRIGO: string[] = [];

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
  const telephone = useEstTelephone();

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
  /** Téléphone : cartes affichées (rendu progressif, 588 recettes d'un coup = lent). */
  const [nbTelephone, setNbTelephone] = useState(() => {
    const n = parseInt(ssGet(SS.nbTelephone) ?? "", 10);
    return Number.isFinite(n) && n > PAS_TELEPHONE ? n : PAS_TELEPHONE;
  });
  /* Sur téléphone ni filtre ni frigo (pas d'interface pour les changer) : les recettes actives. */
  const filtreEffectif: FilterMode = telephone ? "tous" : filter;
  const frigoEffectif = telephone ? AUCUN_FRIGO : frigo;

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
  useEffect(() => {
    ssSet(SS.nbTelephone, String(nbTelephone));
  }, [nbTelephone]);

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
    if (filtreEffectif === "favoris") list = list.filter((r) => r.statut === "favorite" && !r.excluded);
    else if (filtreEffectif === "exclus") list = list.filter((r) => r.excluded);
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
    const frigoNorm = frigoEffectif.map((f) => deburr(f.toLowerCase().trim())).filter(Boolean);
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
  }, [recettes, search, filtreEffectif, frigoEffectif]);

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

  if (!householdId) return null;

  if (telephone) {
    return (
      <LivreTelephone
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setNbTelephone(PAS_TELEPHONE);
        }}
        recettes={filtered.map((f) => f.recette)}
        chargement={isLoading}
        erreur={isError}
        livreVide={!!recettes && recettes.length === 0}
        onRetry={() => void refetch()}
        nb={nbTelephone}
        onVoirPlus={() => setNbTelephone((n) => n + PAS_TELEPHONE)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl text-cream leading-tight flex items-center gap-3">
        <BookOpen size={28} className="text-brass" aria-hidden="true" />
        Livre de recettes
      </h1>

      <div className={`${CARTE_PC} flex flex-wrap items-center gap-3`}>
        <label className="flex items-center gap-2 flex-1 min-w-[240px] min-h-12 rounded-xl bg-ebony border border-hairline px-3 focus-within:border-brass">
          <Search size={20} className="text-cream-mute shrink-0" aria-hidden="true" />
          <span className="sr-only">Chercher une recette</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher par nom, étiquette, style…"
            className="flex-1 min-w-0 bg-transparent text-base text-cream placeholder:text-cream-mute outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="min-h-10 min-w-10 -mr-2 inline-flex items-center justify-center rounded-lg text-cream-mute hover:text-cream"
              aria-label="Effacer la recherche"
            >
              <XIcon size={18} aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="flex items-center gap-2" role="group" aria-label="Filtrer">
          <Filter size={18} className="text-cream-mute" aria-hidden="true" />
          {(["tous", "favoris", "exclus"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              aria-pressed={filter === mode}
              className={`min-h-11 px-4 rounded-xl text-[15px] font-semibold transition ${
                filter === mode
                  ? "bg-brass text-ebony"
                  : "border border-hairline text-cream-mute hover:text-cream"
              }`}
            >
              {mode === "tous" ? "Actives" : mode === "favoris" ? "Favorites" : "Exclues"}
              <span className="ml-1.5 font-normal opacity-70 tabular-nums">{counts[mode]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recherche par frigo */}
      <div className={`${CARTE_PC} flex flex-col gap-3`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-cream">
          <Refrigerator size={20} className="text-brass" aria-hidden="true" />
          Que faire avec ce qu'on a ?
        </h2>
        <p className="text-[15px] text-cream-mute leading-snug">
          Tape ce que tu as au frigo (un ingrédient à la fois, valide avec
          Entrée). Le livre te propose les recettes qui utilisent au moins
          un de ces ingrédients, triées par nombre de correspondances.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {frigo.map((f, i) => (
            <span
              key={`${f}-${i}`}
              className="inline-flex items-center gap-1 pl-3 pr-1 min-h-9 rounded-full bg-ebony-ridge text-cream text-[15px]"
            >
              {f}
              <button
                type="button"
                onClick={() => removeFrigo(i)}
                className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-full text-cream-mute hover:text-cream"
                aria-label={`Retirer ${f}`}
              >
                <XIcon size={16} aria-hidden="true" />
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
            aria-label="Ingrédient du frigo"
            placeholder={
              frigo.length === 0
                ? "ex : tomates, mozzarella, basilic…"
                : "+ ajouter"
            }
            className="flex-1 min-w-[200px] min-h-11 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream placeholder:text-cream-mute outline-none focus:border-brass"
          />
          {frigo.length > 0 && (
            <button
              type="button"
              onClick={() => setFrigo([])}
              className="min-h-11 px-3 rounded-xl text-[15px] text-cream-mute hover:text-cream underline"
            >
              Vider
            </button>
          )}
        </div>
        {frigo.length > 0 && (
          <p className="text-[15px] text-cream-mute">
            {filtered.length} recette{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""} avec au moins un ingrédient du frigo.
          </p>
        )}
      </div>

      {isLoading && <LoadingState />}

      {isError && (
        <ErrorState
          message="Impossible de charger le livre de recettes."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className={`${CARTE_PC} text-center py-10 text-base text-cream-mute`}>
          {recettes && recettes.length === 0 ? (
            <>
              <p className="mb-2 text-cream">Aucune recette dans le livre pour l'instant.</p>
              <p>
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

/** Carte du livre (PC) : nom, description, repères, actions. */
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
  const details = [
    tt > 0 ? `${tt} min` : null,
    recette.portions ? `${recette.portions} pers.` : null,
    recette.seedTags?.proteinePrincipale && recette.seedTags.proteinePrincipale !== "aucune"
      ? recette.seedTags.proteinePrincipale
      : null,
    recette.seedTags?.styleCulinaire,
  ].filter(Boolean);
  const ACTION =
    "min-h-10 min-w-10 inline-flex items-center justify-center gap-1 rounded-lg transition disabled:opacity-40";

  return (
    <div className={`${CARTE_PC} flex flex-col gap-2 ${isExcluded ? "opacity-60" : ""}`}>
      {showFrigoBadge && (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-ebony-ridge px-2 py-0.5 font-semibold text-brass">
            <Refrigerator size={14} aria-hidden="true" />
            {frigoMatched} du frigo utilisé{frigoMatched > 1 ? "s" : ""}
          </span>
          {frigoMissing > 0 && <span className="text-cream-mute">{frigoMissing} à acheter</span>}
        </p>
      )}
      <Link
        to={`/livre-recettes/${recette.id}`}
        className="flex flex-col gap-1 rounded-lg hover:opacity-90 transition"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-serif text-lg text-cream leading-tight flex-1">{recette.nom}</span>
          {isFav && (
            <>
              <Heart size={18} className="text-brass shrink-0 mt-0.5" fill="currentColor" aria-hidden="true" />
              <span className="sr-only">favorite</span>
            </>
          )}
        </span>
        {recette.description && (
          <span className="text-[15px] text-cream-mute leading-snug line-clamp-3">{recette.description}</span>
        )}
      </Link>

      {(recette.tags.length > 0 || recette.estBatch) && (
        <div className="flex flex-wrap gap-1">
          {recette.estBatch && (
            <span className="text-[13px] font-semibold text-brass bg-ebony-ridge px-2 py-0.5 rounded-full">
              Batch
            </span>
          )}
          {recette.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[13px] text-cream-mute bg-ebony-ridge px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      {details.length > 0 && <p className="text-[15px] text-cream-mute">{details.join(" · ")}</p>}

      <div className="flex items-center justify-end gap-1 pt-2 mt-auto border-t border-hairline">
        {!isExcluded && (
          <>
            <button
              type="button"
              onClick={onUpvote}
              disabled={busy}
              aria-pressed={isFav}
              className={`${ACTION} ${isFav ? "text-brass" : "text-cream-mute hover:text-brass"}`}
              title={isFav ? "Déjà favorite" : "Marquer favorite"}
              aria-label={isFav ? "Déjà favorite" : "Marquer favorite"}
            >
              <ThumbsUp size={18} fill={isFav ? "currentColor" : "none"} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDownvote}
              disabled={busy}
              className={`${ACTION} text-cream-mute hover:text-copper`}
              title="Exclure (ne plus piocher dans les plans)"
              aria-label="Exclure (ne plus piocher dans les plans)"
            >
              <ThumbsDown size={18} aria-hidden="true" />
            </button>
          </>
        )}
        {isExcluded && (
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className={`${ACTION} px-2 text-[15px] text-cream-mute hover:text-sage`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Restaurer
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={`${ACTION} text-cream-mute hover:text-copper`}
          title="Supprimer définitivement"
          aria-label="Supprimer définitivement"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Téléphone : une colonne, recherche collée en haut, cartes de 2 lignes,
 * pas d'actions pouce / corbeille ; toucher une carte ouvre le mode recette.
 * Rendu progressif : 40 cartes, puis « Voir plus ».
 */
function LivreTelephone({
  search,
  onSearch,
  recettes,
  chargement,
  erreur,
  livreVide,
  onRetry,
  nb,
  onVoirPlus,
}: {
  search: string;
  onSearch: (v: string) => void;
  recettes: RecetteWithId[];
  chargement: boolean;
  erreur: boolean;
  livreVide: boolean;
  onRetry: () => void;
  nb: number;
  onVoirPlus: () => void;
}) {
  const visibles = recettes.slice(0, nb);
  const reste = recettes.length - visibles.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-ebony">
        <label className="flex items-center gap-2 min-h-12 rounded-xl bg-ebony-card border border-hairline px-3">
          <Search size={20} className="text-cream-mute shrink-0" aria-hidden="true" />
          <span className="sr-only">Chercher une recette</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Chercher une recette"
            className="flex-1 min-w-0 bg-transparent text-base text-cream placeholder:text-cream-mute outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="min-h-12 min-w-12 -mr-3 inline-flex items-center justify-center text-cream-mute"
              aria-label="Effacer la recherche"
            >
              <XIcon size={20} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      {chargement && <LoadingState />}
      {erreur && <ErrorState message="Impossible de charger le livre de recettes." onRetry={onRetry} />}
      {!chargement && !erreur && recettes.length > 0 && (
        <p className="text-[15px] text-cream-mute" aria-live="polite">
          {recettes.length} recette{recettes.length > 1 ? "s" : ""}
          {search.trim() ? ` trouvée${recettes.length > 1 ? "s" : ""}` : ""}
        </p>
      )}
      {!chargement && !erreur && recettes.length === 0 && (
        <p className="py-8 text-center text-base text-cream-mute">
          {livreVide ? "Aucune recette dans le livre pour l'instant." : "Aucune recette ne correspond."}
        </p>
      )}

      {visibles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visibles.map((r) => {
            const fav = r.statut === "favorite" && !r.excluded;
            const temps = r.tempsPrepMinutes + r.tempsCuissonMinutes;
            const details = [
              temps > 0 ? `${temps} min` : null,
              r.portions ? `${r.portions} pers` : null,
              r.seedTags?.styleCulinaire,
            ].filter(Boolean);
            return (
              <li key={r.id}>
                <Link
                  to={`/livre-recettes/${r.id}/cuisine`}
                  className="min-h-12 flex flex-col justify-center rounded-xl bg-ebony-card border border-hairline px-4 py-2"
                >
                  <span className="flex items-center gap-2 text-base text-cream leading-snug">
                    <span className="line-clamp-1 flex-1">{r.nom}</span>
                    {fav && (
                      <>
                        <Heart size={16} className="text-brass shrink-0" fill="currentColor" aria-hidden="true" />
                        <span className="sr-only">favori</span>
                      </>
                    )}
                  </span>
                  {details.length > 0 && (
                    <span className="text-[15px] text-cream-mute leading-snug line-clamp-1">
                      {details.join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {reste > 0 && (
        <button
          type="button"
          onClick={onVoirPlus}
          className="min-h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-hairline text-base text-cream"
        >
          <ChevronDown size={20} aria-hidden="true" />
          Voir plus ({reste})
        </button>
      )}
    </div>
  );
}
