/**
 * Panneau des repas d'un article : en bas de l'écran sur téléphone, centré sur
 * ordinateur. Liste les repas (et sessions batch) qui utilisent l'article, avec
 * la quantité de chacun, et permet de noter un produit de remplacement.
 * Échap, clic sur le fond et focus piégé comme `RecetteDetailModal`.
 * Fermer sans rien saisir n'écrit rien : seul « OK » ou « Annuler le remplacement » écrit.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import type { ArticleCourses } from "@family-hub/types";
import { libelleQuantite } from "../../lib/coursesTelephone";
import { titreRepas } from "../../lib/repasCuisine";
import { libelleJour, titreEntreeBatch, type EntreeRepasArticle, type RepasDeLArticle } from "../../lib/repasArticle";
import NomArticle from "./NomArticle";

interface Props {
  article: Pick<ArticleCourses, "nom" | "quantite" | "unite" | "remplacement">;
  repas: RepasDeLArticle;
  /** Note le remplacement ; texte vide = l'efface. */
  onRemplacer(texte: string): void;
  onFermer(): void;
}

const MAX_REMPLACEMENT = 100;

export default function PanneauRepasArticle({ article, repas, onRemplacer, onFermer }: Props) {
  const carteRef = useRef<HTMLDivElement>(null);
  const fermerRef = useRef<HTMLButtonElement>(null);
  const [texte, setTexte] = useState(article.remplacement ?? "");
  const quantite = libelleQuantite(article);

  useEffect(() => {
    const surTouche = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => fermerRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      if (precedent && typeof precedent.focus === "function") precedent.focus();
    };
  }, []);

  function piegerFocus(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const carte = carteRef.current;
    if (!carte) return;
    const focalisables = carte.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focalisables.length === 0) return;
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (actif === premier || !carte.contains(actif)) {
        e.preventDefault();
        dernier.focus();
      }
    } else if (actif === dernier || !carte.contains(actif)) {
      e.preventDefault();
      premier.focus();
    }
  }

  const valider = (e: FormEvent) => {
    e.preventDefault();
    onRemplacer(texte);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6" onClick={onFermer}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        ref={carteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panneau-repas-titre"
        className="relative w-full md:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-ebony-card border border-hairline p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={piegerFocus}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="panneau-repas-titre" className="font-serif text-xl text-cream leading-tight min-w-0">
            <NomArticle article={article} />
            {quantite && <span className="font-sans text-base text-cream-mute"> · {quantite} sur la liste</span>}
          </h2>
          <button
            ref={fermerRef}
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="shrink-0 min-h-12 min-w-12 -mt-2 -mr-2 inline-flex items-center justify-center rounded-xl text-cream-mute active:bg-ebony-ridge"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <ul className="flex flex-col divide-y divide-hairline">
          {repas.entrees.map((e) => (
            <li key={e.cle}>
              <Entree entree={e} />
            </li>
          ))}
        </ul>

        <form onSubmit={valider} className="flex flex-col gap-2">
          <label htmlFor="panneau-repas-remplacement" className="text-[15px] text-cream-mute">
            Remplacer par (facultatif)
          </label>
          <div className="flex gap-2">
            <input
              id="panneau-repas-remplacement"
              type="text"
              value={texte}
              maxLength={MAX_REMPLACEMENT}
              onChange={(e) => setTexte(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              className="flex-1 min-w-0 min-h-12 px-4 rounded-xl bg-ebony border border-hairline text-cream text-lg placeholder:text-cream-mute"
            />
            <button
              type="submit"
              className="shrink-0 min-h-12 px-5 rounded-xl bg-ebony-ridge text-brass font-semibold"
            >
              OK
            </button>
          </div>
          {article.remplacement && (
            <button
              type="button"
              onClick={() => {
                setTexte("");
                onRemplacer("");
              }}
              className="self-start min-h-12 px-3 -ml-3 rounded-xl text-[15px] text-cream-mute underline underline-offset-2 active:bg-ebony-ridge"
            >
              Annuler le remplacement
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/** Une ligne qui ouvre la recette, ou un bloc sans lien si le nom de la recette est inconnu. */
function Cible({ entree, children }: { entree: EntreeRepasArticle; children: ReactNode }) {
  const classes = "min-h-12 py-2 flex items-center gap-3 text-left";
  if (!entree.nomRecette) return <div className={classes}>{children}</div>;
  const portions = entree.type === "hors-menu" ? "" : `?portions=${entree.portions}`;
  return (
    <Link to={`/livre-recettes/${entree.recetteId}${portions}`} className={clsx(classes, "active:bg-ebony-ridge")}>
      {children}
    </Link>
  );
}

function Entree({ entree }: { entree: EntreeRepasArticle }) {
  const attenue = entree.type !== "hors-menu" && entree.passe;
  const barre = entree.type !== "hors-menu" && entree.annule;
  const nom = entree.nomRecette ?? "Recette indisponible sans réseau";

  let sur: ReactNode;
  if (entree.type === "repas") sur = titreRepas(entree.repas, entree.date);
  else if (entree.type === "batch") sur = <TitreBatch entree={entree} />;
  else sur = "Pas prévue dans le menu";

  return (
    <Cible entree={entree}>
      <span className={clsx("flex-1 min-w-0 leading-tight", attenue ? "text-cream-mute" : "text-cream")}>
        <span className={clsx("block text-[15px] text-cream-mute", barre && "line-through")}>{sur}</span>
        <span className={clsx("block text-lg", barre && "line-through")}>{nom}</span>
      </span>
      {entree.type !== "hors-menu" && entree.quantite && (
        <span
          className={clsx("shrink-0 text-[15px]", barre && "line-through", attenue ? "text-cream-mute" : "text-cream")}
        >
          {entree.quantite}
        </span>
      )}
      {entree.nomRecette && <ChevronRight size={18} className="shrink-0 text-cream-mute" aria-hidden="true" />}
    </Cible>
  );
}

/** « Cuisiné dimanche 8 · mangé mardi 10 et jeudi 12 » ; un jour annulé y est barré. */
function TitreBatch({ entree }: { entree: Extract<EntreeRepasArticle, { type: "batch" }> }) {
  if (!entree.mange.some((m) => m.annule)) return <>{titreEntreeBatch(entree)}</>;
  const jours = entree.mange.filter((m) => libelleJour(m.date));
  const dernier = jours.length - 1;
  return (
    <>
      Cuisiné {libelleJour(entree.dateCuisine)} · mangé{" "}
      {jours.map((m, i) => (
        <span key={i}>
          <span className={m.annule ? "line-through" : undefined}>{libelleJour(m.date)}</span>
          {i < dernier - 1 ? ", " : i === dernier - 1 ? " et " : ""}
        </span>
      ))}
    </>
  );
}
