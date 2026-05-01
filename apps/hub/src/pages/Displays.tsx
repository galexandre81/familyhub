import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useHouseholds, useDisplays } from "../lib/queries";

export default function Displays() {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);
  const householdId = households?.[0]?.id;
  const { data: displays, isLoading } = useDisplays(householdId);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Écrans</h1>
          <p className="text-text-secondaire mt-1">Les écrans configurés dans votre foyer</p>
        </div>
        <button className="btn-primary" disabled>
          Nouvel écran (TODO)
        </button>
      </header>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && (!displays || displays.length === 0) && (
        <div className="tile-card text-center">
          <p className="mb-2">Aucun écran configuré pour le moment.</p>
          <p className="text-sm text-text-secondaire">
            La création d'écran arrivera dans la prochaine itération.
          </p>
        </div>
      )}

      {displays && displays.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displays.map((d) => (
            <li key={d.id} className="tile-card">
              <h2 className="text-xl">{d.nom}</h2>
              <p className="text-text-secondaire text-sm mt-1">
                {d.type} · {d.resolution.w}×{d.resolution.h}
              </p>
              <Link to={`/displays/${d.id}`} className="btn-secondary text-sm mt-4 inline-block">
                Éditer
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
