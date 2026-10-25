/**
 * Ligne d'article en magasin (60 px) : grande case de 30 px, nom + quantité,
 * prénom de la personne qui a coché à droite. Toute la ligne se touche ;
 * toucher à nouveau décoche. Case cochée : couleur de la personne + coche
 * blanche (le jour) ou sombre (la nuit) via `--c-p-texte`. Un oubli (ajout
 * manuel) a en plus un petit bouton « Retirer » en bout de ligne.
 */
import { memo } from "react";
import { Check, X } from "lucide-react";
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
  /** Prénom de la personne qui a coché (article coché seulement). */
  prenom?: string;
  /** Sa couleur CSS ; absente = personne inconnue. */
  couleur?: string;
  onBasculer(id: string, coche: boolean): void;
  /** Présent pour un oubli (ajout manuel) seulement. */
  onRetirer?(id: string): void;
}

function LigneArticle({ article, prenom, couleur: couleurQui, onBasculer, onRetirer }: Props) {
  const coche = article.checked;
  const quantite = libelleQuantite(article);
  const couleur = couleurQui ?? "rgb(var(--c-cream-mute))";

  return (
    <li className="flex items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={coche}
        onClick={() => onBasculer(article.id, !coche)}
        className="flex-1 min-w-0 min-h-[60px] flex items-center gap-3 px-3 text-left rounded-xl active:bg-ebony-ridge"
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
        {coche && prenom && (
          <span className="shrink-0 text-[15px] font-semibold text-cream-mute" style={{ color: couleurQui }}>
            {prenom}
          </span>
        )}
      </button>
      {onRetirer && (
        <button
          type="button"
          onClick={() => onRetirer(article.id)}
          aria-label={`Retirer ${article.nom}`}
          title="Retirer"
          className="shrink-0 min-h-12 min-w-12 mr-1 inline-flex items-center justify-center rounded-xl text-cream-mute active:bg-ebony-ridge"
        >
          <X size={20} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default memo(LigneArticle);
