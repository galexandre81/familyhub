import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChefHat,
  Clock,
  Flame,
  Heart,
  Loader2,
  Minus,
  Plus,
  Star,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useRecette } from "../../lib/queries";
import { useRateRecette } from "../../lib/mutations";

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
  planId,
  slotId,
  onClose,
}: {
  householdId: string;
  recetteId: string;
  initialPortions: number;
  /** Si défini : note la recette ET le slot. Sinon, juste la recette. */
  planId?: string;
  slotId?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: recette, isLoading } = useRecette(householdId, recetteId);
  const [portions, setPortions] = useState<number>(initialPortions);

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
        className="relative tile-card max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
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
                <h2 className="text-2xl font-serif leading-tight">
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
              <button
                onClick={onClose}
                className="text-cream-mute hover:text-cream p-1 -m-1 shrink-0"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Portion picker + actions */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-wood-dark bg-bordure/10">
              <span className="text-xs text-cream-mute uppercase tracking-widest">
                Portions :
              </span>
              <button
                onClick={() => setPortions((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded border border-wood-dark hover:bg-bordure flex items-center justify-center"
                aria-label="Moins de portions"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-semibold tabular-nums w-8 text-center">
                {portions}
              </span>
              <button
                onClick={() => setPortions((p) => Math.min(30, p + 1))}
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

              <NotationPanel
                householdId={householdId}
                recetteId={recette.id}
                planId={planId}
                slotId={slotId}
                currentNote={recette.notation ?? null}
                isFavorite={recette.statut === "favorite"}
                ratedBy={user?.uid}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Panneau "Comment c'était ?" — 5 étoiles + commentaire optionnel.
 * Note ≥ 4 → la recette passe automatiquement en favorite.
 */
function NotationPanel({
  householdId,
  recetteId,
  planId,
  slotId,
  currentNote,
  isFavorite,
  ratedBy,
}: {
  householdId: string;
  recetteId: string;
  planId?: string;
  slotId?: string;
  currentNote: number | null;
  isFavorite: boolean;
  ratedBy?: string;
}) {
  const rate = useRateRecette();
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  function submit(rating: 1 | 2 | 3 | 4 | 5) {
    setPicked(rating);
    rate.mutate(
      {
        householdId,
        recetteId,
        rating,
        planId,
        slotId,
        ratedBy,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 4000);
        },
      },
    );
  }

  const display = hover ?? picked ?? currentNote ?? 0;

  return (
    <section className="mt-2 pt-5 border-t border-wood-dark">
      <h3 className="eyebrow mb-2 flex items-center gap-2">
        <Star size={12} className="text-brass" />
        Comment c'était ?
        {isFavorite && (
          <span className="ml-1 text-brass flex items-center gap-1 normal-case tracking-normal text-[10px]">
            <Heart size={10} fill="currentColor" /> dans tes favoris
          </span>
        )}
      </h3>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => submit(n as 1 | 2 | 3 | 4 | 5)}
            disabled={rate.isPending}
            className="p-1 -m-1 disabled:opacity-50"
            aria-label={`Note ${n} étoile${n > 1 ? "s" : ""}`}
          >
            <Star
              size={28}
              className={
                n <= display
                  ? "text-brass fill-brass"
                  : "text-cream-mute hover:text-brass transition"
              }
            />
          </button>
        ))}
        {rate.isPending && (
          <Loader2 size={14} className="animate-spin text-cream-mute ml-2" />
        )}
        {saved && (
          <span className="ml-3 text-sage text-xs flex items-center gap-1">
            <Check size={12} />
            {(picked ?? 0) >= 4
              ? "Enregistré · ajouté aux favoris ❤"
              : "Enregistré"}
          </span>
        )}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire optionnel (ex: trop salé, à refaire, super pour les enfants…)"
        rows={2}
        maxLength={500}
        className="input !py-2 text-sm"
      />
      <p className="text-[10px] text-cream-mute mt-1">
        {planId && slotId
          ? "Tap sur une étoile pour enregistrer. Note ≥ 4 → la recette est ajoutée à tes favoris."
          : "Note libre (sans contexte de slot)."}
      </p>
    </section>
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
