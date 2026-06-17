import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChefHat,
  Clock,
  Flame,
  Minus,
  Plus,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useRecette } from "../../lib/queries";
import {
  useDownvoteRecette,
  useUpvoteRecette,
} from "../../lib/mutations";
import { PORTIONS_MAX, PORTIONS_MIN } from "../../lib/recipeConstants";

const RAYON_LABELS: Record<string, string> = {
  "frais-fruits-legumes": "Fruits & légumes",
  "frais-laitier": "Crèmerie",
  "frais-boucherie": "Boucherie",
  "frais-poissonnerie": "Poissonnerie",
  "sec-epicerie": "Épicerie",
  "surgele": "Surgelé",
  "boulangerie": "Boulangerie",
  "autre": "Autre",
};

/**
 * Modal in-place qui affiche le détail d'une recette (titre, ingrédients
 * groupés par rayon, étapes numérotées). Accessible depuis /menu sans
 * naviguer hors de la page — match l'expérience iPad recipe-mode.
 *
 * Pour le mode cuisine plein écran (avec timers), un bouton « Mode
 * cuisine » mène vers /livre-recettes/:id/cuisine?portions=N.
 */
export default function RecetteDetailModal({
  householdId,
  recetteId,
  initialPortions,
  onClose,
}: {
  householdId: string;
  recetteId: string;
  initialPortions: number;
  /** @deprecated kept for back-compat — pas utilisé depuis simplification notation. */
  planId?: string;
  /** @deprecated kept for back-compat — pas utilisé depuis simplification notation. */
  slotId?: string;
  onClose: () => void;
}) {
  const { data: recette, isLoading } = useRecette(householdId, recetteId);
  const upvote = useUpvoteRecette();
  const downvote = useDownvoteRecette();
  const [portions, setPortions] = useState<number>(initialPortions);
  /** Ref sur la carte modale pour le focus trap et le focus initial. */
  const cardRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Fermer avec Échap
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Bloque le scroll du body en arrière-plan
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Gestion du focus : focus le bouton Fermer à l'ouverture, restaure le
  // focus sur l'élément précédemment actif à la fermeture.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus initial sur la croix (différé pour laisser le DOM se monter).
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Focus trap : maintient le focus à l'intérieur de la modale au Tab.
  function handleTrapKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = card.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !card.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !card.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const ratio = recette ? portions / (recette.portions || 1) : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recette-modal-titre"
        className="relative tile-card max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTrapKeyDown}
      >
        {isLoading && (
          <div className="p-12 text-center text-cream-mute">Chargement…</div>
        )}

        {!isLoading && !recette && (
          <div className="p-8 text-center">
            <p className="mb-4">Recette introuvable.</p>
            <button onClick={onClose} className="btn-secondary">
              Fermer
            </button>
          </div>
        )}

        {recette && (
          <>
            {/* Header sticky */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-wood-dark">
              <div className="flex-1">
                <h2
                  id="recette-modal-titre"
                  className="text-2xl font-serif leading-tight"
                >
                  {recette.nom}
                </h2>
                {recette.description && (
                  <p className="text-cream-mute text-sm mt-1 italic">
                    {recette.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-cream-mute">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {recette.tempsPrepMinutes + recette.tempsCuissonMinutes} min
                    <span className="opacity-60">
                      (prep {recette.tempsPrepMinutes} + cuisson{" "}
                      {recette.tempsCuissonMinutes})
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame size={12} />
                    Diff. {recette.difficulte}/3
                  </span>
                  {recette.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="text-brass">
                      · {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => downvote.mutate({ householdId, recetteId })}
                  disabled={downvote.isPending}
                  className={`p-2 rounded-md border transition ${
                    recette.excluded
                      ? "border-copper bg-copper/15 text-copper"
                      : "border-wood-dark text-cream-mute hover:text-copper hover:border-copper"
                  }`}
                  title={
                    recette.excluded
                      ? "Recette exclue (ne sera plus piochée)"
                      : "Exclure cette recette"
                  }
                  aria-label="Exclure"
                >
                  <ThumbsDown size={18} />
                </button>
                <button
                  onClick={() => upvote.mutate({ householdId, recetteId })}
                  disabled={upvote.isPending}
                  className={`p-2 rounded-md border transition ${
                    recette.statut === "favorite" && !recette.excluded
                      ? "border-brass bg-brass/15 text-brass"
                      : "border-wood-dark text-cream-mute hover:text-brass hover:border-brass"
                  }`}
                  title={
                    recette.statut === "favorite" && !recette.excluded
                      ? "Dans tes favoris"
                      : "Marquer comme favori"
                  }
                  aria-label="Favori"
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  ref={closeBtnRef}
                  onClick={onClose}
                  className="text-cream-mute hover:text-cream p-1 ml-1"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Portion picker + actions */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-wood-dark bg-bordure/10">
              <span className="text-xs text-cream-mute uppercase tracking-widest">
                Portions :
              </span>
              <button
                onClick={() => setPortions((p) => Math.max(PORTIONS_MIN, p - 1))}
                className="w-8 h-8 rounded border border-wood-dark hover:bg-bordure flex items-center justify-center"
                aria-label="Moins de portions"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-semibold tabular-nums w-8 text-center">
                {portions}
              </span>
              <button
                onClick={() => setPortions((p) => Math.min(PORTIONS_MAX, p + 1))}
                className="w-8 h-8 rounded border border-wood-dark hover:bg-bordure flex items-center justify-center"
                aria-label="Plus de portions"
              >
                <Plus size={14} />
              </button>
              {portions !== recette.portions && (
                <button
                  onClick={() => setPortions(recette.portions)}
                  className="text-xs text-brass underline"
                >
                  réinit. ({recette.portions})
                </button>
              )}
              <Link
                to={`/livre-recettes/${recette.id}/cuisine?portions=${portions}`}
                className="btn-primary text-xs flex items-center gap-1 ml-auto"
                onClick={onClose}
              >
                <ChefHat size={14} />
                Mode cuisine
              </Link>
            </div>

            {/* Body scrollable : ingrédients + étapes */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="eyebrow mb-2">Ingrédients</h3>
                <ul className="space-y-1">
                  {recette.ingredients.map((ing, i) => (
                    <li
                      key={`${ing.libelle}-${i}`}
                      className="flex items-baseline gap-2 text-sm py-1 border-b border-wood-dark/30"
                    >
                      <span className="font-medium tabular-nums shrink-0 min-w-[80px]">
                        {scaleQuantite(ing.quantite, ratio)} {ing.unite}
                      </span>
                      <span className="flex-1">
                        {ing.libelle}
                        <span className="text-cream-mute text-xs ml-2">
                          · {RAYON_LABELS[ing.rayon] ?? ing.rayon}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="eyebrow mb-2">Étapes</h3>
                <ol className="space-y-3">
                  {[...recette.etapes]
                    .sort((a, b) => a.ordre - b.ordre)
                    .map((e, i) => (
                      <li key={e.ordre} className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-brass/15 text-brass text-sm font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 text-sm leading-relaxed">
                          {e.description}
                          {e.dureeMinutes != null && e.dureeMinutes > 0 && (
                            <span className="ml-2 text-xs text-cream-mute">
                              · {e.dureeMinutes} min
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              </section>

            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Multiplie une quantité textuelle par un ratio. Tolère les non-numériques
 * (qsp, "1 botte", etc.) qu'on garde tels quels.
 */
function scaleQuantite(q: string | number, ratio: number): string {
  const s = String(q ?? "").trim();
  if (!s) return "";
  const cleaned = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return s;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return s;
  const scaled = n * ratio;
  const rounded = Math.round(scaled * 10) / 10;
  return rounded === Math.round(rounded)
    ? String(Math.round(rounded))
    : String(rounded);
}
