/**
 * Fiche d'une recette du livre (design « Alpage + Veillée »).
 *
 * Téléphone d'abord : une colonne, gros textes, cibles de 48 px ; en haut le
 * bouton « Cuisiner » (mode recette), puis les portions, les ingrédients
 * (rangés par rayon, quantités ajustées) et les étapes. Favorite / exclure en
 * boutons avec un mot, « Supprimer » relégué tout en bas.
 * PC (≥ 768 px) : même contenu, ingrédients à gauche et étapes à droite.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  CookingPot,
  Flame,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ThumbsDown,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useRecette } from "../lib/queries";
import {
  useDeleteRecette,
  useDownvoteRecette,
  useRestoreRecette,
  useUpvoteRecette,
} from "../lib/mutations";
import { PORTIONS_MAX, PORTIONS_MIN, clampPortions } from "../lib/recipeConstants";
import { etapesTriees, quantiteAjustee } from "../lib/repasCuisine";
import { ingredientsParRayon } from "../lib/ficheRecette";
import { LoadingState } from "../components/states";
import { toast } from "../components/Toast";

const BOUTON =
  "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition disabled:opacity-40";
const CARTE = "rounded-2xl bg-ebony-card border border-hairline p-4 md:p-5";
const ERREUR_RESEAU = "Impossible d'enregistrer, réessaie avec du réseau";

export default function RecetteDetail() {
  const { recetteId } = useParams<{ recetteId: string }>();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recette, isLoading } = useRecette(householdId, recetteId);
  const navigate = useNavigate();
  const upvote = useUpvoteRecette();
  const downvote = useDownvoteRecette();
  const restore = useRestoreRecette();
  const del = useDeleteRecette();

  const [searchParams] = useSearchParams();
  const portionsFromUrl = (() => {
    const raw = searchParams.get("portions");
    if (!raw) return null;
    const n = parseInt(raw, 10);
    // Clampe la valeur d'URL dans [MIN, MAX] pour rester cohérent avec le +/-.
    return Number.isFinite(n) && n > 0 ? clampPortions(n) : null;
  })();
  const [portions, setPortions] = useState<number | null>(portionsFromUrl);

  // Resync de l'état si l'URL change après le montage (ex: navigation interne).
  useEffect(() => {
    setPortions(portionsFromUrl);
    // portionsFromUrl est dérivé de searchParams ; on dépend de sa valeur.
  }, [portionsFromUrl]);

  const groupes = useMemo(() => (recette ? ingredientsParRayon(recette.ingredients) : []), [recette]);

  /** Retour : page précédente (livre, menu…), sinon le livre. */
  const retour = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/livre-recettes");
  };

  if (isLoading) return <LoadingState />;
  if (!recette || !householdId) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg text-cream">Recette introuvable.</p>
        <Link
          to="/livre-recettes"
          className={`${BOUTON} self-start bg-ebony-card border border-hairline text-cream`}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Retour au livre
        </Link>
      </div>
    );
  }

  const targetPortions = portions ?? (recette.portions || 4);
  const tempsTotal = recette.tempsPrepMinutes + recette.tempsCuissonMinutes;
  const isFav = recette.statut === "favorite" && !recette.excluded;
  const isExcluded = !!recette.excluded;
  const ref = { householdId, recetteId: recette.id };
  const surErreur = { onError: () => toast(ERREUR_RESEAU, { type: "error" }) };
  const etapes = etapesTriees(recette.etapes);
  const pastilles = [
    recette.seedTags?.styleCulinaire,
    recette.seedTags?.proteinePrincipale !== "aucune" ? recette.seedTags?.proteinePrincipale : undefined,
    recette.seedTags?.repas,
    ...recette.tags,
  ].filter((t): t is string => !!t);

  const supprimer = async () => {
    if (!confirm(`Supprimer définitivement "${recette.nom}" ?`)) return;
    try {
      await del.mutateAsync(ref);
      navigate("/livre-recettes");
    } catch {
      toast(ERREUR_RESEAU, { type: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-4 md:max-w-5xl md:gap-6">
      <button
        type="button"
        onClick={retour}
        className="self-start min-h-12 -ml-2 px-2 inline-flex items-center gap-2 rounded-xl text-base text-cream-mute hover:text-cream"
      >
        <ArrowLeft size={20} aria-hidden="true" />
        Retour
      </button>

      {/* Titre, description, repères */}
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl text-cream leading-tight">
            {recette.nom}
            {isFav && (
              <>
                <Heart
                  size={22}
                  className="inline-block align-baseline ml-2 text-brass"
                  fill="currentColor"
                  aria-hidden="true"
                />
                <span className="sr-only"> (favorite)</span>
              </>
            )}
          </h1>
          {recette.description && (
            <p className="mt-1 text-base text-cream-mute leading-relaxed">{recette.description}</p>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base text-cream">
          {tempsTotal > 0 && (
            <li className="inline-flex items-center gap-2">
              <Clock size={18} aria-hidden="true" className="text-cream-mute" />
              {tempsTotal} min
              <span className="text-[15px] text-cream-mute">
                (préparation {recette.tempsPrepMinutes}, cuisson {recette.tempsCuissonMinutes})
              </span>
            </li>
          )}
          <li className="inline-flex items-center gap-2">
            <Flame size={18} aria-hidden="true" className="text-cream-mute" />
            Difficulté {recette.difficulte}/3
          </li>
          {recette.estBatch && (
            <li className="inline-flex items-center gap-2">
              <CookingPot size={18} aria-hidden="true" className="text-brass" />
              Batch cooking
            </li>
          )}
        </ul>
        {pastilles.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Étiquettes">
            {pastilles.map((t, i) => (
              <li
                key={`${t}-${i}`}
                className="rounded-full bg-ebony-ridge px-3 py-1 text-[15px] leading-tight text-cream"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </header>

      {isExcluded && (
        <div className={`${CARTE} flex flex-wrap items-center justify-between gap-3`}>
          <p className="flex items-center gap-2 text-base text-cream">
            <ThumbsDown size={20} aria-hidden="true" className="text-cream-mute" />
            Exclue : n'est plus proposée dans les plans.
          </p>
          <button
            type="button"
            onClick={() => restore.mutate(ref, surErreur)}
            disabled={restore.isPending}
            className={`${BOUTON} border-2 border-brass text-cream`}
          >
            <RotateCcw size={20} aria-hidden="true" />
            Restaurer
          </button>
        </div>
      )}

      {/* Action principale + portions */}
      <section aria-label="Cuisiner" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2" role="group" aria-label="Portions">
          <Users size={20} aria-hidden="true" className="text-cream-mute" />
          <span className="text-base text-cream-mute">Portions</span>
          <button
            type="button"
            onClick={() => setPortions(Math.max(PORTIONS_MIN, targetPortions - 1))}
            disabled={targetPortions <= PORTIONS_MIN}
            className={`${BOUTON} px-0 w-12 bg-ebony-card border border-hairline text-cream`}
            aria-label="Une portion de moins"
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <span className="min-w-16 text-center text-lg font-semibold tabular-nums text-cream" aria-live="polite">
            {targetPortions} pers.
          </span>
          <button
            type="button"
            onClick={() => setPortions(Math.min(PORTIONS_MAX, targetPortions + 1))}
            disabled={targetPortions >= PORTIONS_MAX}
            className={`${BOUTON} px-0 w-12 bg-ebony-card border border-hairline text-cream`}
            aria-label="Une portion de plus"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          {recette.portions > 0 && targetPortions !== recette.portions && (
            <button
              type="button"
              onClick={() => setPortions(null)}
              className="min-h-12 px-2 text-[15px] text-cream-mute underline"
            >
              Remettre {recette.portions}
            </button>
          )}
        </div>
        <Link
          to={`/livre-recettes/${recette.id}/cuisine?portions=${targetPortions}`}
          className={`${BOUTON} w-full md:w-auto md:px-6 bg-brass text-ebony text-lg`}
        >
          <ChefHat size={22} aria-hidden="true" />
          Cuisiner
        </Link>
      </section>

      {!isExcluded && (
        <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
          <button
            type="button"
            onClick={() => upvote.mutate(ref, surErreur)}
            disabled={upvote.isPending}
            aria-pressed={isFav}
            className={`${BOUTON} border-2 ${isFav ? "border-brass text-brass" : "border-hairline text-cream"}`}
          >
            <Heart size={20} aria-hidden="true" fill={isFav ? "currentColor" : "none"} />
            {isFav ? "Favorite" : "J'aime"}
          </button>
          <button
            type="button"
            onClick={() => downvote.mutate(ref, surErreur)}
            disabled={downvote.isPending}
            title="Ne plus proposer cette recette dans les plans"
            className={`${BOUTON} border-2 border-hairline text-cream`}
          >
            <ThumbsDown size={20} aria-hidden="true" />
            Exclure
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 md:grid md:grid-cols-5 md:items-start md:gap-6">
        {/* Ingrédients */}
        <section aria-labelledby="fiche-ingredients" className={`${CARTE} md:col-span-2 flex flex-col gap-4`}>
          <h2 id="fiche-ingredients" className="text-lg font-semibold text-cream">
            Ingrédients · {targetPortions} pers.
          </h2>
          {groupes.length === 0 ? (
            <p className="text-base text-cream-mute">Aucun ingrédient indiqué.</p>
          ) : (
            groupes.map((g) => (
              <div key={g.rayon}>
                <h3 className="text-[15px] font-semibold text-cream-mute mb-1">{g.libelle}</h3>
                <ul className="space-y-1">
                  {g.items.map((ing, i) => (
                    <li key={`${ing.libelle}-${i}`} className="flex gap-3 text-base leading-snug text-cream">
                      <span className="shrink-0 min-w-20 text-right font-semibold tabular-nums">
                        {quantiteAjustee(ing.quantite, recette.portions, targetPortions)}
                        {ing.unite ? ` ${ing.unite}` : ""}
                      </span>
                      <span className="min-w-0">{ing.libelle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Étapes */}
        <section aria-labelledby="fiche-etapes" className={`${CARTE} md:col-span-3 flex flex-col gap-4`}>
          <h2 id="fiche-etapes" className="text-lg font-semibold text-cream">
            Étapes
          </h2>
          {etapes.length === 0 ? (
            <p className="text-base text-cream-mute">Pas d'étapes détaillées pour cette recette.</p>
          ) : (
            <ol className="space-y-4">
              {etapes.map((etape, i) => (
                <li key={`${etape.ordre}-${i}`} className="flex gap-3">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-ebony border border-hairline flex items-center justify-center text-base font-semibold text-cream">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base md:text-lg leading-relaxed text-cream">{etape.description}</p>
                    {etape.dureeMinutes && etape.dureeMinutes > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-[15px] text-cream-mute">
                        <Clock size={16} aria-hidden="true" />
                        {etape.dureeMinutes} min
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="pt-4 border-t border-hairline">
        <button
          type="button"
          onClick={() => void supprimer()}
          disabled={del.isPending}
          className={`${BOUTON} text-copper hover:bg-copper/10`}
        >
          <Trash2 size={20} aria-hidden="true" />
          Supprimer la recette
        </button>
      </div>
    </div>
  );
}
