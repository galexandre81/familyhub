/**
 * Mode « Trier » (à la maison) : d'abord « Sûrement dans le placard — à
 * vérifier », puis les articles à trier. Chaque article : « On l'a » /
 * « Drive » / « Magasin ». Un article trié part dans « Déjà trié (n) »,
 * replié en bas, où l'on peut changer d'avis. Un oubli (ajout manuel) peut
 * être retiré ; les articles des recettes, non.
 */
import { memo } from "react";
import { Car, Home, Store, Trash2, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { ArticleCourses, DestinationArticle } from "@family-hub/types";
import { vueTri, type ArticleAvecId } from "../../lib/listeCourses";
import { libelleQuantite } from "../../lib/coursesTelephone";

const CHOIX: Array<{ destination: DestinationArticle; libelle: string; icone: LucideIcon }> = [
  { destination: "deja", libelle: "On l'a", icone: Home },
  { destination: "drive", libelle: "Drive", icone: Car },
  { destination: "magasin", libelle: "Magasin", icone: Store },
];

interface Props {
  articles: ArticleAvecId[];
  estPlacard(article: ArticleCourses): boolean;
  onTrier(id: string, destination: DestinationArticle): void;
  /** Retirer un oubli (ajout manuel seulement). */
  onRetirer(id: string): void;
  /** Tout est trié : passer en mode magasin. */
  onAllerAuMagasin(): void;
}

type Actions = Pick<Props, "onTrier" | "onRetirer">;

export default function VueTri({ articles, estPlacard, onTrier, onRetirer, onAllerAuMagasin }: Props) {
  const { placard, aTrier, tries } = vueTri(articles, estPlacard);
  const actions = { onTrier, onRetirer };

  return (
    <div className="flex flex-col gap-5">
      {placard.length > 0 && (
        <Section titre="Sûrement dans le placard — à vérifier" articles={placard} {...actions} />
      )}
      {aTrier.length > 0 && <Section titre="À trier" articles={aTrier} {...actions} />}

      {placard.length === 0 && aTrier.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-lg text-cream">Tout est trié</p>
          <button
            type="button"
            onClick={onAllerAuMagasin}
            className="min-h-12 px-5 rounded-xl bg-ebony-card border border-hairline text-cream inline-flex items-center gap-2"
          >
            <Store size={20} aria-hidden="true" />
            Passer au magasin
          </button>
        </div>
      )}

      {tries.length > 0 && (
        <details className="rounded-xl bg-ebony-card border border-hairline">
          <summary className="min-h-12 px-4 flex items-center text-base text-cream-mute cursor-pointer">
            Déjà trié ({tries.length})
          </summary>
          <ul className="flex flex-col divide-y divide-hairline px-3 pb-2">
            {tries.map((a) => (
              <LigneTri key={a.id} article={a} {...actions} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({ titre, articles, ...actions }: { titre: string; articles: ArticleAvecId[] } & Actions) {
  return (
    <section aria-label={titre}>
      <h2 className="font-serif text-lg text-cream mb-1">
        {titre} <span className="font-sans text-[15px] text-cream-mute">· {articles.length}</span>
      </h2>
      <ul className="flex flex-col divide-y divide-hairline rounded-xl bg-ebony-card border border-hairline px-3">
        {articles.map((a) => (
          <LigneTri key={a.id} article={a} {...actions} />
        ))}
      </ul>
    </section>
  );
}

const LigneTri = memo(function LigneTri({
  article,
  onTrier,
  onRetirer,
}: { article: ArticleAvecId } & Actions) {
  const quantite = libelleQuantite(article);
  return (
    <li className="py-2 flex flex-col gap-1.5">
      <div className="min-h-[28px] flex items-center gap-2 leading-tight">
        <span className="flex-1 min-w-0">
          <span className="text-lg text-cream">{article.nom}</span>
          {quantite && <span className="ml-2 text-[15px] text-cream-mute">{quantite}</span>}
        </span>
        {article.ajoutManuel && (
          <button
            type="button"
            onClick={() => onRetirer(article.id)}
            aria-label={`Retirer ${article.nom}`}
            className="shrink-0 min-h-12 px-3 -mr-1 rounded-xl inline-flex items-center gap-1.5 text-[15px] text-cream-mute active:bg-ebony-ridge"
          >
            <Trash2 size={18} aria-hidden="true" />
            Retirer
          </button>
        )}
      </div>
      <div role="group" aria-label={`Où acheter ${article.nom}`} className="grid grid-cols-3 gap-2">
        {CHOIX.map(({ destination, libelle, icone: Icone }) => {
          const choisi = article.destination === destination;
          return (
            <button
              key={destination}
              type="button"
              aria-pressed={choisi}
              onClick={() => onTrier(article.id, destination)}
              className={clsx(
                "min-h-12 rounded-xl border inline-flex items-center justify-center gap-1.5 text-[15px]",
                choisi
                  ? "bg-ebony-ridge text-brass border-transparent font-semibold"
                  : "bg-ebony text-cream border-hairline",
              )}
            >
              <Icone size={18} aria-hidden="true" />
              {libelle}
            </button>
          );
        })}
      </div>
    </li>
  );
});
