import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useHouseholds, useTiles } from "../lib/queries";

export default function Tiles() {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);
  const householdId = households?.[0]?.id;
  const { data: tiles, isLoading } = useTiles(householdId);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Tuiles</h1>
          <p className="text-text-secondaire mt-1">Les instances de tuiles configurées</p>
        </div>
        <button className="btn-primary" disabled>
          Nouvelle tuile (TODO)
        </button>
      </header>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && (!tiles || tiles.length === 0) && (
        <div className="tile-card text-center">
          <p>Aucune tuile configurée.</p>
        </div>
      )}

      {tiles && tiles.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <li key={t.id} className="tile-card">
              <p className="tile-title">{t.type}</p>
              <h2 className="text-xl">{t.nom}</h2>
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
