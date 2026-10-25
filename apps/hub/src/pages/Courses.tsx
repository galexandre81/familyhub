/**
 * Onglet « Courses » (téléphone ; le PC affiche la même page).
 *
 * À la maison, « Trier » : on vérifie le placard, puis chaque article part
 * en « On l'a », « Drive » ou « Magasin ». En magasin, souvent sans réseau,
 * « Magasin » : on coche par rayon ; le cache Firestore garde les coches et
 * les envoie au retour du réseau. Un oubli s'ajoute en bas de l'écran.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ListChecks, Plus, Share2, ShoppingCart, WifiOff } from "lucide-react";
import clsx from "clsx";
import { estProduitPlacard, PLACARD_DEFAUT } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useActivePlan, useHouseholds, useProfils } from "../lib/queries";
import { useListeCourses } from "../lib/useListeCourses";
import { couleurDuProfil } from "../lib/personnes";
import { dateDuTimestamp } from "../lib/semaine";
import {
  CLE_MODE_COURSES,
  modeEnregistre,
  modeParDefaut,
  prenomQuiACoche,
  progressionMagasin,
  texteAPartager,
  titreSemaine,
  type ModeCourses,
} from "../lib/coursesTelephone";
import { useEstTelephone } from "../lib/useEstTelephone";
import { LoadingState } from "../components/states";
import { toast } from "../components/Toast";
import VueTri from "../components/courses/VueTri";
import VueMagasin from "../components/courses/VueMagasin";
import type { QuiACoche } from "../components/courses/LigneArticle";

function lireMode(): ModeCourses | undefined {
  try {
    return modeEnregistre(window.sessionStorage.getItem(CLE_MODE_COURSES));
  } catch {
    return undefined;
  }
}

function ecrireMode(mode: ModeCourses): void {
  try {
    window.sessionStorage.setItem(CLE_MODE_COURSES, mode);
  } catch {
    /* stockage indisponible : le mode reste en mémoire */
  }
}

/** Suit `navigator.onLine` (événements `online` / `offline`). */
function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);
  return enLigne;
}

async function partager(texte: string): Promise<void> {
  if (!texte) {
    toast("Tout est déjà dans le chariot.", { type: "info" });
    return;
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Courses", text: texte });
      return;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return;
      /* partage refusé : on tente la copie */
    }
  }
  try {
    await navigator.clipboard.writeText(texte);
    toast("Liste copiée — colle-la dans un message.", { type: "success" });
  } catch {
    toast("Impossible de partager la liste sur cet appareil.", { type: "error" });
  }
}

export default function Courses() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households, isLoading: householdsLoading } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);
  const { data: plan, isLoading: planLoading } = useActivePlan(householdId);
  const { data: profils } = useProfils(householdId);
  const estTelephone = useEstTelephone();
  const enLigne = useEnLigne();

  const placardFoyer = household?.parametres?.placard ?? PLACARD_DEFAUT;
  const estPlacard = useCallback((nom: string) => estProduitPlacard(nom, placardFoyer), [placardFoyer]);
  const { liste, articles, chargement, trier, cocher, ajouterOubli, estPlacardArticle } = useListeCourses(
    householdId,
    plan?.id,
    { estPlacard },
  );

  const [modeChoisi, setModeChoisi] = useState<ModeCourses | undefined>(lireMode);
  /*
   * Mode par défaut figé au premier chargement de la liste : trier le dernier
   * article ne fait pas sauter l'écran en « Magasin » (on voit « Tout est trié »).
   */
  const pret = !!liste && !chargement;
  useEffect(() => {
    if (pret && modeChoisi === undefined) setModeChoisi(modeParDefaut(articles));
  }, [pret, modeChoisi, articles]);
  const mode = modeChoisi ?? modeParDefaut(articles);
  const choisirMode = useCallback((m: ModeCourses) => {
    setModeChoisi(m);
    ecrireMode(m);
  }, []);

  const quiACoche = useCallback(
    (uid: string | null | undefined): QuiACoche => {
      const { prenom, profil } = prenomQuiACoche(profils ?? [], uid);
      return { prenom, couleur: profil ? couleurDuProfil(profil) : undefined };
    },
    [profils],
  );

  const progression = useMemo(() => progressionMagasin(articles), [articles]);
  const [oubli, setOubli] = useState("");

  const ajouter = (e: FormEvent) => {
    e.preventDefault();
    if (!oubli.trim()) return;
    ajouterOubli(oubli);
    setOubli("");
  };

  if (householdsLoading || planLoading || (plan && chargement)) return <LoadingState />;
  if (!householdId || !plan || !liste) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-12">
        <ShoppingCart size={40} className="text-cream-mute" aria-hidden="true" />
        <p className="text-lg text-cream">Pas de liste en cours — elle arrive avec le prochain menu</p>
      </div>
    );
  }

  const debut = dateDuTimestamp(plan.dateDebut);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl text-cream leading-tight">Courses</h1>
            {debut && <p className="text-[15px] text-cream-mute">{titreSemaine(debut)}</p>}
          </div>
          <p className="shrink-0 text-lg text-cream tabular-nums" aria-label="Articles du magasin cochés">
            {progression.coches} / {progression.total}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Avancement des courses au magasin"
          aria-valuemin={0}
          aria-valuemax={progression.total}
          aria-valuenow={progression.coches}
          className="h-2 rounded-full bg-ebony-ridge overflow-hidden"
        >
          <div className="h-full bg-brass transition-[width]" style={{ width: `${progression.pourcentage}%` }} />
        </div>
        {!enLigne && (
          <p role="status" className="flex items-center gap-2 text-[15px] text-cream-mute">
            <WifiOff size={18} aria-hidden="true" />
            Hors ligne — tes coches partiront au retour du réseau
          </p>
        )}
      </header>

      <div role="group" aria-label="Mode" className="grid grid-cols-2 gap-2">
        {(
          [
            { m: "trier", libelle: "Trier", Icone: ListChecks },
            { m: "magasin", libelle: "Magasin", Icone: ShoppingCart },
          ] as const
        ).map(({ m, libelle, Icone }) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => choisirMode(m)}
            className={clsx(
              "min-h-12 rounded-xl border inline-flex items-center justify-center gap-2 text-base",
              /* Pas de jaune : comme les onglets. */
              mode === m
                ? "bg-ebony-ridge text-brass border-transparent font-semibold"
                : "bg-ebony-card text-cream border-hairline",
            )}
          >
            <Icone size={20} aria-hidden="true" />
            {libelle}
          </button>
        ))}
      </div>

      {mode === "trier" ? (
        <VueTri
          articles={articles}
          estPlacard={estPlacardArticle}
          onTrier={trier}
          onAllerAuMagasin={() => choisirMode("magasin")}
        />
      ) : (
        <VueMagasin articles={articles} quiACoche={quiACoche} onCocher={cocher} />
      )}

      <button
        type="button"
        onClick={() => void partager(texteAPartager(articles))}
        className="self-center min-h-12 px-5 rounded-xl bg-ebony-card border border-hairline text-cream-mute inline-flex items-center gap-2"
      >
        <Share2 size={20} aria-hidden="true" />
        Partager la liste
      </button>

      <form
        onSubmit={ajouter}
        className={clsx(
          "flex gap-2 py-2 bg-ebony",
          /* Collé au-dessus de la barre d'onglets du téléphone. */
          estTelephone && "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 px-4 border-t border-hairline",
        )}
      >
        <label htmlFor="courses-oubli" className="sr-only">
          Un oubli ?
        </label>
        <input
          id="courses-oubli"
          type="text"
          value={oubli}
          onChange={(e) => setOubli(e.target.value)}
          placeholder="Un oubli ?"
          enterKeyHint="done"
          autoComplete="off"
          className="flex-1 min-w-0 min-h-12 px-4 rounded-xl bg-ebony-card border border-hairline text-cream text-lg placeholder:text-cream-mute"
        />
        <button
          type="submit"
          className="shrink-0 min-h-12 px-4 rounded-xl bg-ebony-ridge text-brass font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={20} aria-hidden="true" />
          Ajouter
        </button>
      </form>
    </div>
  );
}
