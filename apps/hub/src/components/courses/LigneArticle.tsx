/**
 * Ligne d'article en magasin (60 px) : grande case de 30 px, nom + quantité,
 * prénom de la personne qui a coché à droite. Toute la ligne se touche ;
 * toucher à nouveau décoche. Case cochée : couleur de la personne + coche
 * blanche (le jour) ou sombre (la nuit) via `--c-p-texte`.
 */
import { memo } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import type { ArticleAvecId } from "../../lib/listeCourses";
import { libelleQuantite } from "../../lib/coursesTelephone";

export interface QuiACoche {
  prenom: string;
  /** Couleur CSS de la personne ; absente = personne inconnue. */
  couleur?: string;
}

interface Props {
  article: ArticleAvecId;
  qui?: QuiACoche;
  onBasculer(id: string, coche: boolean): void;
}

function LigneArticle({ article, qui, onBasculer }: Props) {
  const coche = article.checked;
  const quantite = libelleQuantite(article);
  const couleur = qui?.couleur ?? "rgb(var(--c-cream-mute))";

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={coche}
        onClick={() => onBasculer(article.id, !coche)}
        className="w-full min-h-[60px] flex items-center gap-3 px-3 text-left rounded-xl active:bg-ebony-ridge"
      >
        <span
          aria-hidden="true"
          className={clsx(
            "shrink-0 w-[30px] h-[30px] rounded-lg border-2 flex items-center justify-center",
            !coche && "border-cream-mute",
          )}
          style={coche ? { backgroundColor: couleur, borderColor: couleur } : undefined}
        >
          {coche && <Check size={22} strokeWidth={3} style={{ color: "rgb(var(--c-p-texte))" }} />}
        </span>
        <span className="flex-1 min-w-0 leading-tight">
          <span className={clsx("block text-lg", coche ? "line-through text-cream-mute" : "text-cream")}>
            {article.nom}
          </span>
          {quantite && (
            <span className={clsx("block text-[15px] text-cream-mute", coche && "line-through")}>
              {quantite}
            </span>
          )}
        </span>
        {coche && qui && (
          <span className="shrink-0 text-[15px] font-semibold text-cream-mute" style={{ color: qui.couleur }}>
            {qui.prenom}
          </span>
        )}
      </button>
    </li>
  );
}

export default memo(LigneArticle);
