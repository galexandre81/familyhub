import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw, TriangleAlert } from "lucide-react";
import type { TileType } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useDisplay,
  useHouseholds,
  useTiles,
} from "../lib/queries";
import {
  useCreateTile,
  useUpdateDisplayLayout,
} from "../lib/mutations";
import {
  NOMS_SOURCES,
  TYPES_TABLEAU,
  layoutCuisine,
  tuileParDefaut,
  typesPresents,
} from "../lib/ecranCuisine";
import { rafraichirEcransSansAttendre } from "../lib/rafraichirEcrans";
import SetupTokenModal from "../components/SetupTokenModal";

export default function DisplayEditor() {
  const { displayId } = useParams();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households } = useHouseholds(user?.uid);
  const { data: display } = useDisplay(householdId, displayId);
  const { data: tiles } = useTiles(householdId);
  const updateLayout = useUpdateDisplayLayout();
  const createTile = useCreateTile();

  const [setupOpen, setSetupOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  if (!householdId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Écran</h1>
        <p className="text-text-secondaire">Crée d'abord un foyer.</p>
      </div>
    );
  }

  if (!display) {
    return <p className="text-text-secondaire">Chargement de l'écran…</p>;
  }

  const layout = display.layout ?? [];
  const tuiles = tiles ?? [];
  const presents = typesPresents(layout, tuiles);
  const manquantes = TYPES_TABLEAU.filter((t) => !presents.has(t));
  const aRetirer = layoutCuisine(layout, tuiles).retirees.length;
  const aJour = manquantes.length === 0 && aRetirer === 0;
  const localisation = households?.find((h) => h.id === householdId)?.parametres
    ?.localisation;

  function afficherMessage(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 5000);
  }

  async function preparer() {
    setPreparing(true);
    setStatus(null);
    try {
      const { aCreer } = layoutCuisine(layout, tuiles);
      const creees: Array<{ id: string; type: string }> = [];
      for (const type of aCreer) {
        const def = tuileParDefaut(type as TileType, localisation);
        const id = await createTile.mutateAsync({
          householdId: householdId!,
          type: type as TileType,
          ...def,
        });
        creees.push({ id, type });
      }
      const { layout: nouveau } = layoutCuisine(layout, [...tuiles, ...creees]);
      await updateLayout.mutateAsync({
        householdId: householdId!,
        displayId: display!.id,
        layout: nouveau,
      });
      rafraichirEcransSansAttendre(householdId!, "tout");
      afficherMessage("L'écran de cuisine est prêt. Les données arrivent dans un instant.");
    } catch {
      afficherMessage("Impossible de préparer l'écran pour l'instant. Réessaie dans un moment.");
    } finally {
      setPreparing(false);
    }
  }

  /* Une seule demande « tout » (menu, recette du jour, météo, agenda) : la
     météo n'est plus rafraîchie deux fois. */
  function rafraichir() {
    setStatus(null);
    rafraichirEcransSansAttendre(householdId!, "tout");
    afficherMessage("Mise à jour demandée : l'écran se met à jour dans un instant.");
  }

  return (
    <div className="space-y-6">
      <Link
        to="/displays"
        aria-label="Retour aux écrans"
        className="text-sm text-text-secondaire hover:text-accent-chaud flex items-center gap-1"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Retour aux écrans
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl">{display.nom}</h1>
          <p className="text-text-secondaire mt-1">
            {display.type} · {display.resolution.w}×{display.resolution.h}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={rafraichir}
            className="btn-secondary flex items-center gap-1"
            title="Demande une mise à jour des données de l'écran"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Rafraîchir
          </button>
          <button onClick={() => setSetupOpen(true)} className="btn-secondary">
            Configurer cet écran
          </button>
        </div>
      </header>

      {status && <p className="text-sm text-accent-secondaire">{status}</p>}

      <section className="space-y-3">
        <h2 className="text-xl">Tableau de cuisine</h2>
        <p className="text-text-secondaire text-sm">
          L'écran affiche toujours le même tableau. Il a besoin de ces sources pour se remplir.
        </p>
        <h3 className="text-base">Sources du tableau</h3>
        <ul className="space-y-2">
          {TYPES_TABLEAU.map((type) => {
            const ok = presents.has(type);
            return (
              <li key={type} className="tile-card flex items-center justify-between">
                <span className="font-semibold">{NOMS_SOURCES[type]}</span>
                <span
                  className={
                    ok
                      ? "flex items-center gap-1 text-sm text-accent-secondaire"
                      : "flex items-center gap-1 text-sm text-accent-chaud"
                  }
                >
                  {ok ? <Check size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
                  {ok ? "Présente" : "Manquante"}
                </span>
              </li>
            );
          })}
        </ul>
        {aRetirer > 0 && (
          <p className="text-sm text-text-secondaire">
            La liste de courses et l'horloge ne servent plus sur cet écran : elles seront retirées.
          </p>
        )}
        <button
          onClick={preparer}
          disabled={preparing || aJour}
          className="btn-primary disabled:opacity-50"
        >
          {preparing ? "Préparation…" : aJour ? "L'écran de cuisine est prêt" : "Préparer l'écran de cuisine"}
        </button>
      </section>

      {setupOpen && (
        <SetupTokenModal
          householdId={householdId}
          displayId={display.id}
          displayNom={display.nom}
          onClose={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}
