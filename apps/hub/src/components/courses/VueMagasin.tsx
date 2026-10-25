/**
 * Mode « Magasin » : pastilles de rayons défilantes (« Légumes 9 ») qui
 * mènent au rayon, puis chaque rayon (titre + « n restants ») avec ses
 * articles, cochés en bas. Ni le drive ni les « On l'a » n'apparaissent.
 */
import { useCallback, useMemo } from "react";
import { grouperParRayon, vueMagasin, type ArticleAvecId } from "../../lib/listeCourses";
import { libellePastille } from "../../lib/coursesTelephone";
import LigneArticle, { type QuiACoche } from "./LigneArticle";

interface Props {
  articles: ArticleAvecId[];
  /** Prénom et couleur de la personne reliée au compte `checkedBy`. */
  quiACoche(uid: string | null | undefined): QuiACoche;
  onCocher(id: string, coche: boolean): void;
  /** Retirer un oubli (ajout manuel seulement). */
  onRetirer(id: string): void;
}

const idRayon = (rayon: string) => `rayon-${rayon}`;

function restantsTexte(n: number): string {
  if (n === 0) return "tout est pris";
  return n === 1 ? "1 restant" : `${n} restants`;
}

export default function VueMagasin({ articles, quiACoche, onCocher, onRetirer }: Props) {
  const groupes = useMemo(() => grouperParRayon(vueMagasin(articles)), [articles]);

  const allerAuRayon = useCallback((rayon: string) => {
    document.getElementById(idRayon(rayon))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (groupes.length === 0) {
    return <p className="py-8 text-center text-lg text-cream-mute">Rien à acheter au magasin</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Rayons"
        className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-ebony flex gap-2 overflow-x-auto"
      >
        {groupes.map((g) => (
          <button
            key={g.rayon}
            type="button"
            onClick={() => allerAuRayon(g.rayon)}
            className="shrink-0 min-h-12 px-4 rounded-full bg-ebony-card border border-hairline text-cream text-[15px] whitespace-nowrap"
          >
            {libellePastille(g.rayon, g.libelle)}{" "}
            <span className={g.restants ? "font-semibold" : "text-cream-mute"}>{g.restants}</span>
          </button>
        ))}
      </nav>

      {groupes.map((g) => (
        <section key={g.rayon} id={idRayon(g.rayon)} aria-label={g.libelle} className="scroll-mt-20">
          <h2 className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-serif text-lg text-cream">{g.libelle}</span>
            <span className="text-[15px] text-cream-mute">{restantsTexte(g.restants)}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-hairline rounded-xl bg-ebony-card border border-hairline">
            {g.articles.map((a) => {
              const qui = a.checked ? quiACoche(a.checkedBy) : undefined;
              return (
                <LigneArticle
                  key={a.id}
                  article={a}
                  prenom={qui?.prenom}
                  couleur={qui?.couleur}
                  onBasculer={onCocher}
                  onRetirer={a.ajoutManuel ? onRetirer : undefined}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
