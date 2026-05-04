import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Flame,
  Heart,
  Minus,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react";
import type { RecetteIngredient } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useRecette } from "../lib/queries";
import {
  useDeleteRecette,
  useDownvoteRecette,
  useUpvoteRecette,
} from "../lib/mutations";

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

const RAYON_ORDER = [
  "frais-fruits-legumes",
  "frais-boucherie",
  "frais-poissonnerie",
  "frais-laitier",
  "boulangerie",
  "sec-epicerie",
  "surgele",
  "autre",
];

export default function RecetteDetail() {
  const { recetteId } = useParams<{ recetteId: string }>();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recette, isLoading } = useRecette(householdId, recetteId);
  const navigate = useNavigate();
  const upvote = useUpvoteRecette();
  const downvote = useDownvoteRecette();
  const del = useDeleteRecette();

  const [portions, setPortions] = useState<number | null>(null);

  const targetPortions = portions ?? recette?.portions ?? 4;
  const ratio = recette ? targetPortions / recette.portions : 1;

  const ingredientsByRayon = useMemo(() => {
    if (!recette) return [];
    const groups = new Map<string, RecetteIngredient[]>();
    for (const ing of recette.ingredients) {
      const arr = groups.get(ing.rayon) ?? [];
      arr.push(ing);
      groups.set(ing.rayon, arr);
    }
    return RAYON_ORDER.filter((r) => groups.has(r)).map((rayon) => ({
      rayon,
      label: RAYON_LABELS[rayon] ?? rayon,
      items: groups.get(rayon)!,
    }));
  }, [recette]);

  if (isLoading) return <p className="text-text-secondaire">Chargement…</p>;
  if (!recette || !householdId) {
    return (
      <div className="space-y-3">
        <p className="text-text-secondaire">Recette introuvable.</p>
        <Link to="/livre-recettes" className="btn-secondary">
          Retour au livre
        </Link>
      </div>
    );
  }

  const tempsTotal = recette.tempsPrepMinutes + recette.tempsCuissonMinutes;
  const isFav = recette.statut === "favorite" && !recette.excluded;
  const isExcluded = !!recette.excluded;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/livre-recettes" className="text-text-secondaire hover:text-text-principal">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-serif leading-tight">{recette.nom}</h1>
          {recette.description && (
            <p className="text-text-secondaire mt-1">{recette.description}</p>
          )}
        </div>
      </div>

      {/* Métadonnées */}
      <section className="tile-card flex flex-wrap items-center gap-4">
        <Meta icon={Clock} label={`${tempsTotal} min`} sub={`prep ${recette.tempsPrepMinutes} + cuisson ${recette.tempsCuissonMinutes}`} />
        <Meta icon={Flame} label={`Diff. ${recette.difficulte}/3`} />
        {recette.estBatch && <Tag color="brass">BATCH COOKING</Tag>}
        {recette.seedTags?.styleCulinaire && <Tag>{recette.seedTags.styleCulinaire}</Tag>}
        {recette.seedTags?.proteinePrincipale && recette.seedTags.proteinePrincipale !== "aucune" && (
          <Tag>{recette.seedTags.proteinePrincipale}</Tag>
        )}
        {recette.seedTags?.repas && <Tag>{recette.seedTags.repas}</Tag>}
        {recette.tags.map((t) => (
          <Tag key={t} muted>{t}</Tag>
        ))}
      </section>

      {/* Sélecteur portions + actions */}
      <section className="tile-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={18} className="text-text-secondaire" />
          <span className="text-sm text-text-secondaire">Portions</span>
          <button
            type="button"
            onClick={() => setPortions((p) => Math.max(1, (p ?? recette.portions) - 1))}
            className="w-9 h-9 rounded-md border border-bordure hover:bg-bordure flex items-center justify-center"
            aria-label="Moins de portions"
          >
            <Minus size={14} />
          </button>
          <span className="text-2xl font-semibold w-12 text-center">{targetPortions}</span>
          <button
            type="button"
            onClick={() => setPortions((p) => Math.min(20, (p ?? recette.portions) + 1))}
            className="w-9 h-9 rounded-md border border-bordure hover:bg-bordure flex items-center justify-center"
            aria-label="Plus de portions"
          >
            <Plus size={14} />
          </button>
          {targetPortions !== recette.portions && (
            <button
              type="button"
              onClick={() => setPortions(null)}
              className="text-xs text-text-secondaire underline ml-1"
            >
              Réinitialiser ({recette.portions})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isExcluded && (
            <>
              <button
                onClick={() => upvote.mutate({ householdId, recetteId: recette.id })}
                className={`p-2 transition ${isFav ? "text-accent-chaud" : "text-text-secondaire hover:text-accent-chaud"}`}
                title={isFav ? "Déjà favorite" : "Marquer favorite"}
              >
                {isFav ? <Heart size={16} fill="currentColor" /> : <ThumbsUp size={16} />}
              </button>
              <button
                onClick={() => downvote.mutate({ householdId, recetteId: recette.id })}
                className="p-2 text-text-secondaire hover:text-accent-chaud transition"
                title="Exclure (ne plus piocher dans les plans)"
              >
                <ThumbsDown size={16} />
              </button>
            </>
          )}
          <button
            onClick={async () => {
              if (!confirm(`Supprimer définitivement "${recette.nom}" ?`)) return;
              await del.mutateAsync({ householdId, recetteId: recette.id });
              navigate("/livre-recettes");
            }}
            className="p-2 text-text-secondaire hover:text-accent-chaud transition"
            title="Supprimer définitivement"
          >
            <Trash2 size={16} />
          </button>
          <Link
            to={`/livre-recettes/${recette.id}/cuisine?portions=${targetPortions}`}
            className="btn-primary flex items-center gap-2 ml-2"
          >
            <ChefHat size={16} />
            Mode cuisine
          </Link>
        </div>
      </section>

      {/* Ingrédients */}
      <section className="tile-card space-y-4">
        <h2 className="text-xl">Ingrédients</h2>
        {ingredientsByRayon.map((group) => (
          <div key={group.rayon}>
            <h3 className="text-sm uppercase tracking-widest text-text-secondaire mb-2">
              {group.label}
            </h3>
            <ul className="space-y-1">
              {group.items.map((ing, i) => (
                <li key={`${ing.libelle}-${i}`} className="flex items-baseline gap-2">
                  <span className="font-medium tabular-nums w-28 shrink-0 text-right">
                    {scaleQuantite(ing.quantite, ratio)}{" "}
                    <span className="text-text-secondaire text-sm">{ing.unite}</span>
                  </span>
                  <span>{ing.libelle}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Étapes */}
      <section className="tile-card space-y-3">
        <h2 className="text-xl">Étapes</h2>
        <ol className="space-y-3">
          {[...recette.etapes]
            .sort((a, b) => a.ordre - b.ordre)
            .map((etape) => (
              <li key={etape.ordre} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-bordure flex items-center justify-center font-semibold text-sm">
                  {etape.ordre}
                </span>
                <div className="flex-1">
                  <p className="leading-relaxed">{etape.description}</p>
                  {etape.dureeMinutes && etape.dureeMinutes > 0 && (
                    <p className="text-text-secondaire text-sm mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      {etape.dureeMinutes} min
                    </p>
                  )}
                </div>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-text-secondaire" />
      <div>
        <div className="font-medium leading-none">{label}</div>
        {sub && <div className="text-xs text-text-secondaire mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Tag({
  children,
  color,
  muted,
}: {
  children: React.ReactNode;
  color?: "brass";
  muted?: boolean;
}) {
  const cls =
    color === "brass"
      ? "bg-accent-chaud/20 text-accent-chaud"
      : muted
        ? "bg-bordure/40 text-text-secondaire"
        : "bg-bordure text-text-principal";
  return (
    <span className={`text-xs uppercase tracking-widest px-2 py-1 rounded-sm ${cls}`}>
      {children}
    </span>
  );
}

/**
 * Multiplie la quantité par le ratio. La quantité est une string libre :
 *   "200" → "300" si ratio=1.5
 *   "1 botte" → "2 botte" si ratio=2
 *   "qsp" → "qsp" inchangé
 *   "1/2" → "1" si ratio=2
 *   "0.5" → "0.75" si ratio=1.5
 *
 * Stratégie : on extrait le préfixe numérique (entier, décimal ou fraction),
 * on le multiplie, on garde le reste tel quel. Si pas de nombre détecté, on
 * laisse la string inchangée.
 */
export function scaleQuantite(q: string, ratio: number): string {
  if (ratio === 1) return q;
  const trimmed = q.trim();
  if (!trimmed) return q;

  // Fraction "1/2", "3/4"
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  if (frac) {
    const num = (parseInt(frac[1], 10) / parseInt(frac[2], 10)) * ratio;
    return formatNum(num) + frac[3];
  }

  // Décimal ou entier "200", "1.5", "0,75"
  const dec = trimmed.match(/^(\d+[.,]?\d*)(.*)$/);
  if (dec) {
    const n = parseFloat(dec[1].replace(",", "."));
    if (!isNaN(n)) {
      return formatNum(n * ratio) + dec[2];
    }
  }
  return q;
}

function formatNum(n: number): string {
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return (Math.round(n * 2) / 2).toString().replace(".", ",");
  if (n >= 1) return (Math.round(n * 4) / 4).toString().replace(".", ",");
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}
