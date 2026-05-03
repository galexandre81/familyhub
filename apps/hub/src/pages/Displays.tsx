import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Settings, Trash2, Smartphone } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useDisplays } from "../lib/queries";
import { useDeleteDisplay } from "../lib/mutations";
import DisplayForm from "../components/DisplayForm";
import SetupTokenModal from "../components/SetupTokenModal";

export default function Displays() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: displays, isLoading } = useDisplays(householdId);
  const deleteDisplay = useDeleteDisplay();

  const [showForm, setShowForm] = useState(false);
  const [setupTarget, setSetupTarget] = useState<{ id: string; nom: string } | null>(null);

  if (!householdId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Écrans</h1>
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
          <h1 className="text-3xl">Écrans</h1>
          <p className="text-text-secondaire mt-1">Les écrans configurés dans votre foyer</p>
        </div>
        {!showForm && displays && displays.length > 0 && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nouvel écran
          </button>
        )}
      </header>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && (showForm || !displays || displays.length === 0) && (
        <DisplayForm
          householdId={householdId}
          onCreated={() => setShowForm(false)}
          onCancel={displays && displays.length > 0 ? () => setShowForm(false) : undefined}
        />
      )}

      {displays && displays.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displays.map((d) => (
            <li key={d.id} className="tile-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl flex items-center gap-2">
                    <Smartphone size={18} className="text-accent-chaud" />
                    {d.nom}
                  </h2>
                  <p className="text-text-secondaire text-sm mt-1">
                    {d.type} · {d.resolution.w}×{d.resolution.h} ·{" "}
                    grille {d.gridConfig.cols}×{d.gridConfig.rows}
                  </p>
                  <p className="text-text-secondaire text-xs mt-1">
                    {d.layout.length} tuile{d.layout.length > 1 ? "s" : ""} dans le layout
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer l'écran « ${d.nom} » ?`)) {
                      void deleteDisplay.mutate({ householdId, displayId: d.id });
                    }
                  }}
                  className="text-text-secondaire hover:text-accent-chaud"
                  aria-label="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex gap-2 pt-2 border-t border-bordure">
                <Link to={`/displays/${d.id}`} className="btn-secondary text-sm flex items-center gap-1">
                  <Settings size={14} />
                  Layout
                </Link>
                <button
                  onClick={() => setSetupTarget({ id: d.id, nom: d.nom })}
                  className="btn-primary text-sm"
                >
                  Configurer cet écran
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {setupTarget && (
        <SetupTokenModal
          householdId={householdId}
          displayId={setupTarget.id}
          displayNom={setupTarget.nom}
          onClose={() => setSetupTarget(null)}
        />
      )}
    </div>
  );
}
