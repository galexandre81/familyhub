import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/queries";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: households, isLoading } = useHouseholds(user?.uid);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Bienvenue {user?.displayName?.split(" ")[0] ?? ""}</h1>
        <p className="text-text-secondaire mt-1">Vos foyers et leurs écrans</p>
      </header>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && households?.length === 0 && (
        <div className="tile-card text-center">
          <p className="mb-4">Vous n'avez pas encore de foyer.</p>
          <Link to="/parametres" className="btn-primary inline-block">
            Créer mon foyer
          </Link>
        </div>
      )}

      {households && households.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {households.map((h) => (
            <li key={h.id} className="tile-card">
              <h2 className="text-xl mb-1">{h.nom}</h2>
              <p className="text-text-secondaire text-sm">
                {h.parametres?.localisation?.ville ?? "—"} · {h.membres.length} membre(s)
              </p>
              <div className="mt-4 flex gap-2">
                <Link to="/displays" className="btn-secondary text-sm">
                  Écrans
                </Link>
                <Link to="/tiles" className="btn-secondary text-sm">
                  Tuiles
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
