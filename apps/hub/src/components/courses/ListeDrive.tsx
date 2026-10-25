/**
 * Colonne « Drive » (ordinateur) : une ligne par article trié au drive.
 * Case « dans le panier » (= cocher, couleur de la personne), nom +
 * quantité, lien « Chercher sur Intermarché » (nouvel onglet ; on ajoute
 * soi-même au panier) et « Pas dispo → Magasin » qui renvoie l'article au
 * magasin. Ce qui est dans le panier descend en bas, barré.
 */
import { memo, useMemo } from "react";
import { Check, Search, Store } from "lucide-react";
import clsx from "clsx";
import { vueDrive, type ArticleAvecId } from "../../lib/listeCourses";
import { libelleQuantite } from "../../lib/coursesTelephone";
import { lienRechercheDrive } from "../../lib/drive";
import type { QuiACoche } from "./LigneArticle";

interface Props {
  articles: ArticleAvecId[];
  /** Modèle de recherche du foyer (`{terme}`) ; absent = Intermarché. */
  modele?: string;
  /** Libellé du lien : « Chercher sur Intermarché » ou « Chercher sur le drive ». */
  libelleRecherche: string;
  quiACoche(uid: string | null | undefined): QuiACoche;
  onCocher(id: string, coche: boolean): void;
  onPasDispo(id: string): void;
}

export default function ListeDrive({ articles, modele, libelleRecherche, quiACoche, onCocher, onPasDispo }: Props) {
  const lignes = useMemo(() => {
    const drive = vueDrive(articles);
    return [...drive.filter((a) => !a.checked), ...drive.filter((a) => a.checked)];
  }, [articles]);

  if (lignes.length === 0) {
    return (
      <p className="py-6 text-center text-cream-mute">
        Rien au drive — trie un article en « Drive » pour le voir ici.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-xl bg-ebony-card border border-hairline">
      {lignes.map((a) => (
        <LigneDrive
          key={a.id}
          article={a}
          lien={lienRechercheDrive(a.nom, modele)}
          libelleRecherche={libelleRecherche}
          qui={a.checked ? quiACoche(a.checkedBy) : undefined}
          onCocher={onCocher}
          onPasDispo={onPasDispo}
        />
      ))}
    </ul>
  );
}

const LigneDrive = memo(function LigneDrive({
  article,
  lien,
  libelleRecherche,
  qui,
  onCocher,
  onPasDispo,
}: {
  article: ArticleAvecId;
  lien: string;
  libelleRecherche: string;
  qui?: QuiACoche;
  onCocher(id: string, coche: boolean): void;
  onPasDispo(id: string): void;
}) {
  const coche = article.checked;
  const quantite = libelleQuantite(article);
  const couleur = qui?.couleur ?? "rgb(var(--c-cream-mute))";

  return (
    <li className="px-3 py-2 flex flex-col gap-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={coche}
        aria-label={`${article.nom} dans le panier`}
        onClick={() => onCocher(article.id, !coche)}
        className="min-h-12 flex items-center gap-3 text-left rounded-xl hover:bg-ebony-ridge/50 active:bg-ebony-ridge"
      >
        <span
          aria-hidden="true"
          className={clsx(
            "shrink-0 w-[26px] h-[26px] rounded-lg border-2 flex items-center justify-center",
            !coche && "border-cream-mute",
          )}
          style={coche ? { backgroundColor: couleur, borderColor: couleur } : undefined}
        >
          {coche && <Check size={18} strokeWidth={3} style={{ color: "rgb(var(--c-p-texte))" }} />}
        </span>
        <span className="flex-1 min-w-0 leading-tight">
          <span className={clsx("text-lg", coche ? "line-through text-cream-mute" : "text-cream")}>
            {article.nom}
          </span>
          {quantite && (
            <span className={clsx("ml-2 text-[15px] text-cream-mute", coche && "line-through")}>{quantite}</span>
          )}
        </span>
        {coche && qui?.prenom && (
          <span className="shrink-0 text-[15px] font-semibold" style={{ color: qui.couleur }}>
            {qui.prenom}
          </span>
        )}
      </button>
      {!coche && (
        <div className="flex flex-wrap gap-2 pl-[38px]">
          <a
            href={lien}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 px-3 rounded-xl bg-ebony border border-hairline text-cream text-[15px] inline-flex items-center gap-1.5 hover:border-brass"
          >
            <Search size={16} aria-hidden="true" />
            {libelleRecherche}
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
          <button
            type="button"
            onClick={() => onPasDispo(article.id)}
            className="min-h-11 px-3 rounded-xl bg-ebony border border-hairline text-cream-mute text-[15px] inline-flex items-center gap-1.5 hover:text-cream"
          >
            <Store size={16} aria-hidden="true" />
            Pas dispo → Magasin
          </button>
        </div>
      )}
    </li>
  );
});
