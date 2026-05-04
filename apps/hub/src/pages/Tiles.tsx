import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Clock, CloudSun, Radio as RadioIcon, Timer } from "lucide-react";
import type { TileType } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useHouseholds, useTiles } from "../lib/queries";
import { useDeleteTile } from "../lib/mutations";
import TileForm from "../components/TileForm";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  clock: <Clock size={18} className="text-accent-chaud" />,
  weather: <CloudSun size={18} className="text-accent-chaud" />,
  radio: <RadioIcon size={18} className="text-accent-chaud" />,
  timer: <Timer size={18} className="text-accent-chaud" />,
};

const TYPE_LABEL: Record<TileType, string> = {
  clock: "Horloge",
  weather: "Météo",
  calendar: "Calendrier",
  radio: "Radio",
  timer: "Minuteur",
  "recipe-today": "Recette du jour",
  "recipe-mode": "Mode cuisine",
  "shopping-list": "Liste de courses",
  "meal-planner-week": "Menu de la semaine (legacy)",
  "weekly-menu": "Menu de la semaine",
  "batch-mode": "Batch cooking",
  "livre-recettes": "Livre de recettes",
  "cuisine-quoi": "Cuisine quoi ?",
  profils: "Profils",
};

export default function Tiles() {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: tiles, isLoading } = useTiles(householdId);
  const deleteTile = useDeleteTile();

  const [showForm, setShowForm] = useState(false);

  const household = households?.[0];

  if (!householdId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Tuiles</h1>
        <div className="tile-card text-center">
          <p className="mb-3">Crée d'abord un foyer.</p>
          <Link to="/parametres" className="btn-primary inline-block">
            Aller aux paramètres
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Tuiles</h1>
          <p className="text-text-secondaire mt-1">Les instances de tuiles configurées</p>
        </div>
        {!showForm && tiles && tiles.length > 0 && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nouvelle tuile
          </button>
        )}
      </header>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && (showForm || !tiles || tiles.length === 0) && (
        <TileForm
          householdId={householdId}
          defaultLocation={household?.parametres?.localisation}
          onCreated={() => setShowForm(false)}
          onCancel={tiles && tiles.length > 0 ? () => setShowForm(false) : undefined}
        />
      )}

      {tiles && tiles.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <li key={t.id} className="tile-card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {TYPE_ICONS[t.type]}
                  <p className="tile-title m-0">{TYPE_LABEL[t.type] ?? t.type}</p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer la tuile « ${t.nom} » ?`)) {
                      void deleteTile.mutate({ householdId, tileId: t.id });
                    }
                  }}
                  className="text-text-secondaire hover:text-accent-chaud"
                  aria-label="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h2 className="text-xl">{t.nom}</h2>
              {t.refreshIntervalSeconds > 0 && (
                <p className="text-text-secondaire text-xs mt-2">
                  Refresh : toutes les {Math.round(t.refreshIntervalSeconds / 60)} min
                </p>
              )}
              <Link to={`/tiles/${t.id}`} className="btn-secondary text-sm mt-4 inline-block">
                Configurer
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
