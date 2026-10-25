/**
 * Onglet « iPad de cuisine » (PC) : remplace les anciens onglets « Écrans »
 * et « Tuiles » (du temps où chaque écran avait sa grille de tuiles ; l'iPad
 * a désormais un tableau fixe).
 *
 * 1. L'iPad : état de l'appairage, « Appairer l'iPad » (code à taper sur
 *    l'iPad), « Mettre à jour l'iPad », « Préparer l'écran de cuisine » s'il
 *    lui manque des sources (ou s'il en garde d'anciennes).
 * 2. Ce qu'il affiche : les sources du tableau, et l'adresse de l'agenda.
 * 3. Anciens écrans (téléphones, PC appairés avant la refonte) : à supprimer.
 */
import { useState } from "react";
import { Check, RefreshCw, Tablet, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import type { TileType } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useDisplays, useHouseholds, useTiles } from "../lib/queries";
import {
  useCreateDisplay,
  useCreateTile,
  useDeleteDisplay,
  useUpdateDisplayLayout,
} from "../lib/mutations";
import {
  NOMS_SOURCES,
  TYPES_TABLEAU,
  layoutCuisine,
  tuileParDefaut,
  typesPresents,
} from "../lib/ecranCuisine";
import { autresEcrans, choisirIpad, etatAppairage } from "../lib/ipadCuisine";
import { rafraichirEcransSansAttendre } from "../lib/rafraichirEcrans";
import SetupTokenModal from "../components/SetupTokenModal";
import CalendarUrlSection from "../components/CalendarUrlSection";
import { ErrorState } from "../components/states";

const CARTE = "rounded-2xl bg-ebony-card border border-hairline p-5";
const BOUTON = "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold disabled:opacity-50";
const PRINCIPAL = `${BOUTON} bg-brass text-ebony`;
const SECONDAIRE = `${BOUTON} border-2 border-hairline text-cream`;

function dateLongue(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function IpadCuisine() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households } = useHouseholds(user?.uid);
  // Relu toutes les 15 s : l'appairage se fait sur l'iPad, pas ici.
  const { data: ecrans, isLoading, isError, refetch } = useDisplays(householdId, 15_000);
  const { data: tiles } = useTiles(householdId);
  const createDisplay = useCreateDisplay();
  const createTile = useCreateTile();
  const updateLayout = useUpdateDisplayLayout();
  const deleteDisplay = useDeleteDisplay();

  const [appairageOuvert, setAppairageOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);

  if (!householdId) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl text-cream">iPad de cuisine</h1>
        <p className="text-base text-cream-mute">Crée d'abord un foyer dans Paramètres.</p>
      </div>
    );
  }

  const ipad = choisirIpad(ecrans ?? []);
  const anciens = autresEcrans(ecrans ?? [], ipad);
  const tuiles = tiles ?? [];
  const layout = ipad?.layout ?? [];
  const presents = typesPresents(layout, tuiles);
  const manquantes = TYPES_TABLEAU.filter((t) => !presents.has(t));
  const aJour = manquantes.length === 0 && layoutCuisine(layout, tuiles).retirees.length === 0;
  const localisation = households?.find((h) => h.id === householdId)?.parametres?.localisation;
  const tuileAgenda = tuiles.find((t) => t.type === "calendar");

  function afficher(msg: string) {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 6000);
  }

  async function ajouterIpad() {
    try {
      await createDisplay.mutateAsync({
        householdId: householdId!,
        nom: "Cuisine iPad",
        type: "ipad-mini-1",
        resolution: { w: 1024, h: 768 },
        gridConfig: { cols: 4, rows: 3, gap: 16 },
      });
    } catch {
      afficher("Impossible d'ajouter l'iPad pour l'instant. Réessaie dans un moment.");
    }
  }

  async function preparer() {
    if (!ipad) return;
    setPreparation(true);
    setMessage(null);
    try {
      const { aCreer } = layoutCuisine(layout, tuiles);
      const creees: Array<{ id: string; type: string }> = [];
      for (const type of aCreer) {
        const def = tuileParDefaut(type as TileType, localisation);
        const id = await createTile.mutateAsync({ householdId: householdId!, type: type as TileType, ...def });
        creees.push({ id, type });
      }
      const { layout: nouveau } = layoutCuisine(layout, [...tuiles, ...creees]);
      await updateLayout.mutateAsync({ householdId: householdId!, displayId: ipad.id, layout: nouveau });
      rafraichirEcransSansAttendre(householdId!, "tout");
      afficher("L'écran de cuisine est prêt. Les données arrivent dans un instant.");
    } catch {
      afficher("Impossible de préparer l'écran pour l'instant. Réessaie dans un moment.");
    } finally {
      setPreparation(false);
    }
  }

  function mettreAJour() {
    rafraichirEcransSansAttendre(householdId!, "tout");
    afficher("Mise à jour demandée : l'iPad se met à jour dans un instant.");
  }

  function supprimer(id: string, nom: string) {
    if (!window.confirm(`Supprimer l'écran « ${nom} » ? L'appareil sera déconnecté.`)) return;
    deleteDisplay.mutate({ householdId: householdId!, displayId: id });
  }

  const etat = ipad ? etatAppairage(ipad, Date.now()) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-serif text-3xl text-cream flex items-center gap-3">
          <Tablet size={28} aria-hidden="true" className="text-brass" />
          iPad de cuisine
        </h1>
        <p className="text-base text-cream-mute mt-1">L'écran de la cuisine : appairage, mise à jour et ce qu'il affiche.</p>
      </header>

      {isLoading && <p className="text-base text-cream-mute">Chargement…</p>}
      {isError && <ErrorState message="Impossible de charger les écrans." onRetry={() => void refetch()} />}
      {message && (
        <p role="status" className="text-base text-cream">
          {message}
        </p>
      )}

      {!isLoading && !isError && !ipad && (
        <section className={`${CARTE} space-y-3`}>
          <h2 className="text-xl font-semibold text-cream">Aucun iPad pour l'instant</h2>
          <p className="text-base text-cream-mute">Ajoute l'iPad de cuisine, puis appaire-le avec un code.</p>
          <button type="button" onClick={() => void ajouterIpad()} disabled={createDisplay.isPending} className={PRINCIPAL}>
            Ajouter l'iPad de cuisine
          </button>
        </section>
      )}

      {ipad && etat && (
        <section className={`${CARTE} space-y-4`} aria-labelledby="ipad-titre">
          <div>
            <h2 id="ipad-titre" className="text-xl font-semibold text-cream">
              {ipad.nom}
            </h2>
            {etat.etat === "appaire" && (
              <p className="flex items-center gap-2 text-base text-cream mt-1">
                <Check size={18} aria-hidden="true" className="text-brass" />
                Appairé
                {etat.jusquau !== null && (
                  <span className="text-cream-mute">· se renouvelle tout seul (prochaine échéance le {dateLongue(etat.jusquau)})</span>
                )}
              </p>
            )}
            {etat.etat === "expire" && (
              <p className="flex items-center gap-2 text-base text-red-600 mt-1">
                <TriangleAlert size={18} aria-hidden="true" />
                Appairage expiré depuis le {dateLongue(etat.depuis)} : appaire-le à nouveau.
              </p>
            )}
            {etat.etat === "jamais" && (
              <p className="flex items-center gap-2 text-base text-cream-mute mt-1">
                <TriangleAlert size={18} aria-hidden="true" />
                Pas encore appairé.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setAppairageOuvert(true)} className={etat.etat === "appaire" ? SECONDAIRE : PRINCIPAL}>
              Appairer l'iPad
            </button>
            <button type="button" onClick={mettreAJour} className={SECONDAIRE}>
              <RefreshCw size={18} aria-hidden="true" />
              Mettre à jour l'iPad
            </button>
            {!aJour && (
              <button type="button" onClick={() => void preparer()} disabled={preparation} className={PRINCIPAL}>
                <Wand2 size={18} aria-hidden="true" />
                {preparation ? "Préparation…" : "Préparer l'écran de cuisine"}
              </button>
            )}
          </div>
          <p className="text-[15px] text-cream-mute">
            « Appairer » donne un code à 6 caractères à taper sur l'iPad (bandeau « à reconfigurer »), dans Safari.
          </p>
        </section>
      )}

      {ipad && (
        <section className="space-y-3" aria-labelledby="sources-titre">
          <h2 id="sources-titre" className="text-xl font-semibold text-cream">
            Ce qu'il affiche
          </h2>
          <ul className={`${CARTE} divide-y divide-hairline py-1`}>
            {TYPES_TABLEAU.map((type) => {
              const ok = presents.has(type);
              return (
                <li key={type} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-base text-cream">{NOMS_SOURCES[type]}</span>
                  <span className={`flex items-center gap-1 text-base ${ok ? "text-cream-mute" : "text-red-600"}`}>
                    {ok ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
                    {ok ? "Prêt" : "Manquant"}
                  </span>
                </li>
              );
            })}
          </ul>
          {!aJour && (
            <p className="text-base text-cream-mute">Il manque des éléments : clique sur « Préparer l'écran de cuisine » ci-dessus.</p>
          )}
          {tuileAgenda && <CalendarUrlSection householdId={householdId} tileId={tuileAgenda.id} />}
        </section>
      )}

      {anciens.length > 0 && (
        <section className="space-y-3" aria-labelledby="anciens-titre">
          <h2 id="anciens-titre" className="text-xl font-semibold text-cream">
            Anciens écrans
          </h2>
          <p className="text-base text-cream-mute">
            Appareils appairés avant la version téléphone. Ils ne servent plus : les téléphones se connectent avec leur compte Google.
          </p>
          <ul className={`${CARTE} divide-y divide-hairline py-1`}>
            {anciens.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-base text-cream">{e.nom}</span>
                <button
                  type="button"
                  onClick={() => supprimer(e.id, e.nom)}
                  disabled={deleteDisplay.isPending && deleteDisplay.variables?.displayId === e.id}
                  className={SECONDAIRE}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {appairageOuvert && ipad && (
        <SetupTokenModal
          householdId={householdId}
          displayId={ipad.id}
          displayNom={ipad.nom}
          onClose={() => {
            setAppairageOuvert(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
