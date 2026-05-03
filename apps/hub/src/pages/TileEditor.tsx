import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useTile } from "../lib/queries";

export default function TileEditor() {
  const { tileId } = useParams();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: tile, isLoading } = useTile(householdId, tileId);

  return (
    <div className="space-y-6">
      <Link to="/tiles" className="text-sm text-text-secondaire hover:text-accent-chaud flex items-center gap-1">
        <ArrowLeft size={14} /> Retour aux tuiles
      </Link>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && !tile && (
        <p className="text-accent-chaud">Tuile introuvable.</p>
      )}

      {tile && (
        <>
          <header>
            <h1 className="text-3xl">{tile.nom}</h1>
            <p className="text-text-secondaire mt-1">Type : {tile.type}</p>
          </header>

          <section className="tile-card">
            <h2 className="text-xl mb-3">Configuration brute</h2>
            <pre className="bg-bg-principal rounded-md p-3 text-xs overflow-auto">
              {JSON.stringify(tile.config, null, 2)}
            </pre>
            <p className="text-text-secondaire text-xs mt-3">
              L'édition de configuration arrive en Phase 2. Pour modifier maintenant : supprimer
              et recréer la tuile depuis la liste.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
