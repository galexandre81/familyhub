/**
 * Courses sur l'ordinateur (page Menu, ≥ 768 px) : trois colonnes sur grand
 * écran, empilées en dessous — **Trier** (la vue du téléphone, en plus
 * large) · **Drive** (commande Intermarché à la main) · **Magasin** (aperçu
 * en lecture, par rayon). Les écritures passent par `useListeCourses` (sans
 * attente du serveur, pas de transaction).
 */
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Car, ClipboardCopy, Download, ListChecks, Plus, ShoppingCart, Store } from "lucide-react";
import clsx from "clsx";
import type { Profil } from "@family-hub/types";
import type { ListeCoursesApi } from "../../lib/useListeCourses";
import type { MealPlanWithId } from "../../lib/queries";
import { useRepasDesArticles } from "../../lib/useRepasDesArticles";
import type { RepasDeLArticle } from "../../lib/repasArticle";
import { grouperParRayon, vueDrive, vueMagasin, type ArticleAvecId } from "../../lib/listeCourses";
import { libelleQuantite, prenomQuiACoche } from "../../lib/coursesTelephone";
import { htmlListeMagasin, modeleDriveValide, texteListeDrive } from "../../lib/drive";
import { couleurDuProfil } from "../../lib/personnes";
import { toast } from "../Toast";
import VueTri from "./VueTri";
import ListeDrive from "./ListeDrive";
import NomArticle from "./NomArticle";
import BoutonRepas from "./BoutonRepas";
import PanneauRepasArticle from "./PanneauRepasArticle";
import type { QuiACoche } from "./LigneArticle";

interface Props {
  courses: ListeCoursesApi;
  householdId: string;
  /** Plan affiché : ses repas alimentent le bouton « n repas » de chaque article. */
  plan?: MealPlanWithId;
  profils: Array<Profil & { id: string }>;
  /** `parametres.modeleRechercheDrive` du foyer. */
  modeleDrive?: string;
}

const ID_MAGASIN = "courses-pc-magasin";

async function copierListeDrive(texte: string): Promise<void> {
  if (!texte) {
    toast("Rien à commander au drive.", { type: "info" });
    return;
  }
  try {
    await navigator.clipboard.writeText(texte);
    toast("Liste drive copiée.", { type: "success" });
  } catch {
    toast("Impossible de copier la liste sur cet ordinateur.", { type: "error" });
  }
}

function telechargerHtml(html: string): void {
  if (!html) {
    toast("Rien à acheter au magasin.", { type: "info" });
    return;
  }
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `courses-magasin-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SectionCoursesPc({ courses, householdId, plan, profils, modeleDrive }: Props) {
  const { articles, trier, cocher, ajouterOubli, supprimer, remplacer, estPlacardArticle } = courses;
  const modelePerso = modeleDriveValide(modeleDrive) ? modeleDrive : undefined;

  const { resume, chargement: repasEnChargement } = useRepasDesArticles(householdId, plan);
  /* Tant que les repas se chargent, un nombre serait faux : le bouton dit « Voir ». */
  const repasDe = useCallback(
    (a: ArticleAvecId): RepasDeLArticle =>
      repasEnChargement ? { entrees: [], nombreRepas: 0, libelleBouton: "Voir" } : resume(a),
    [resume, repasEnChargement],
  );
  const [repasId, setRepasId] = useState<string | null>(null);
  const voirRepas = useCallback((a: ArticleAvecId) => setRepasId(a.id), []);
  const fermerRepas = useCallback(() => setRepasId(null), []);
  const articleOuvert = repasId ? articles.find((a) => a.id === repasId) : undefined;

  const quiACoche = useCallback(
    (uid: string | null | undefined): QuiACoche => {
      const { prenom, profil } = prenomQuiACoche(profils, uid);
      return { prenom, couleur: profil ? couleurDuProfil(profil) : undefined };
    },
    [profils],
  );
  const pasDispo = useCallback((id: string) => trier(id, "magasin"), [trier]);

  const drive = useMemo(() => vueDrive(articles), [articles]);
  const auPanier = drive.filter((a) => a.checked).length;
  const groupesMagasin = useMemo(() => grouperParRayon(vueMagasin(articles)), [articles]);
  const restantsMagasin = groupesMagasin.reduce((n, g) => n + g.restants, 0);

  const [oubli, setOubli] = useState("");
  const ajouter = (e: FormEvent) => {
    e.preventDefault();
    if (!oubli.trim()) return;
    ajouterOubli(oubli);
    setOubli("");
    toast("Ajouté au magasin (rayon Autres)", { type: "success" });
  };

  return (
    <section className="space-y-4" aria-labelledby="courses-pc-titre">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="courses-pc-titre" className="text-xl flex items-center gap-2">
          <ShoppingCart size={20} className="text-brass" aria-hidden="true" />
          Liste de courses
        </h2>
        <form onSubmit={ajouter} className="flex items-center gap-2">
          <label htmlFor="courses-pc-oubli" className="sr-only">
            Un oubli ?
          </label>
          <input
            id="courses-pc-oubli"
            type="text"
            value={oubli}
            onChange={(e) => setOubli(e.target.value)}
            placeholder="Un oubli ?"
            autoComplete="off"
            className="input !py-2 w-56"
          />
          <button type="submit" className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <Plus size={16} aria-hidden="true" />
            Ajouter
          </button>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 items-start">
        <Colonne titre="Trier" Icone={ListChecks}>
          <VueTri
            articles={articles}
            estPlacard={estPlacardArticle}
            onTrier={trier}
            onRetirer={supprimer}
            onAllerAuMagasin={() =>
              document.getElementById(ID_MAGASIN)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            repasDe={repasDe}
            onVoirRepas={voirRepas}
          />
        </Colonne>

        <Colonne
          titre="Drive"
          Icone={Car}
          compte={drive.length ? `${auPanier} / ${drive.length} dans le panier` : undefined}
          action={
            <button
              type="button"
              onClick={() => void copierListeDrive(texteListeDrive(articles))}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <ClipboardCopy size={16} aria-hidden="true" />
              Copier la liste drive
            </button>
          }
        >
          <ListeDrive
            articles={articles}
            modele={modelePerso}
            libelleRecherche={modelePerso ? "Chercher sur le drive" : "Chercher sur Intermarché"}
            quiACoche={quiACoche}
            onCocher={cocher}
            onPasDispo={pasDispo}
            repasDe={repasDe}
            onVoirRepas={voirRepas}
          />
        </Colonne>

        <Colonne
          id={ID_MAGASIN}
          titre="Magasin"
          Icone={Store}
          compte={groupesMagasin.length ? `${restantsMagasin} restant${restantsMagasin > 1 ? "s" : ""}` : undefined}
          action={
            <button
              type="button"
              onClick={() => telechargerHtml(htmlListeMagasin(articles))}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
              title="Un fichier à envoyer par mail ou AirDrop, avec des cases à cocher"
            >
              <Download size={16} aria-hidden="true" />
              Télécharger en HTML
            </button>
          }
        >
          <ApercuMagasin groupes={groupesMagasin} repasDe={repasDe} onVoirRepas={voirRepas} />
        </Colonne>
      </div>

      {articleOuvert && (
        <PanneauRepasArticle
          article={articleOuvert}
          repas={repasDe(articleOuvert)}
          onRemplacer={(texte) => remplacer(articleOuvert.id, texte)}
          onFermer={fermerRepas}
          chargement={repasEnChargement}
        />
      )}
    </section>
  );
}

function Colonne({
  id,
  titre,
  Icone,
  compte,
  action,
  children,
}: {
  id?: string;
  titre: string;
  Icone: typeof Store;
  compte?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={id} className="tile-card space-y-3 min-w-0 scroll-mt-4" role="region" aria-label={titre}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg text-cream flex items-center gap-2">
          <Icone size={18} className="text-cream-mute" aria-hidden="true" />
          {titre}
          {compte && <span className="font-sans text-sm text-cream-mute">· {compte}</span>}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Aperçu en lecture : ce qui sera acheté au magasin, par rayon (cochés barrés, en bas). */
function ApercuMagasin({
  groupes,
  repasDe,
  onVoirRepas,
}: {
  groupes: ReturnType<typeof grouperParRayon>;
  repasDe(article: ArticleAvecId): RepasDeLArticle;
  onVoirRepas(article: ArticleAvecId): void;
}) {
  if (groupes.length === 0) {
    return <p className="py-6 text-center text-cream-mute">Rien à acheter au magasin</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {groupes.map((g) => (
        <div key={g.rayon}>
          <h4 className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-cream">{g.libelle}</span>
            <span className="text-sm text-cream-mute">{g.restants}</span>
          </h4>
          <ul className="flex flex-col gap-0.5">
            {g.articles.map((a) => {
              const q = libelleQuantite(a);
              return (
                <li
                  key={a.id}
                  className={clsx(
                    "text-[15px] leading-snug flex items-center justify-between gap-2",
                    a.checked ? "line-through text-cream-mute" : "text-cream",
                  )}
                >
                  <span className="min-w-0">
                    <NomArticle article={a} />
                    {q && <span className="ml-2 text-cream-mute">{q}</span>}
                    {a.destination === "a-trier" && (
                      <span className="ml-2 text-xs text-cream-mute">(pas encore trié)</span>
                    )}
                  </span>
                  {(a.recetteIds?.length ?? 0) > 0 && (
                    <BoutonRepas libelle={repasDe(a).libelleBouton} nom={a.nom} onClick={() => onVoirRepas(a)} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
