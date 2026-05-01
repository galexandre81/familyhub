import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/queries";
import HouseholdForm from "../components/HouseholdForm";

export default function Parametres() {
  const { user } = useAuth();
  const { data: households, isLoading } = useHouseholds(user?.uid);
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Paramètres</h1>

      <section className="tile-card space-y-3">
        <h2 className="text-xl">Mon compte</h2>
        <div className="flex items-center gap-3">
          {user.photoURL && <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />}
          <div>
            <p>{user.displayName}</p>
            <p className="text-text-secondaire text-sm">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Foyers</h2>

        {isLoading && <p className="text-text-secondaire">Chargement…</p>}

        {!isLoading && households && households.length > 0 && (
          <ul className="space-y-3">
            {households.map((h) =>
              editingId === h.id ? (
                <li key={h.id}>
                  <HouseholdForm
                    uid={user.uid}
                    existing={{ id: h.id, nom: h.nom, parametres: h.parametres }}
                    onSaved={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={h.id} className="tile-card flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">{h.nom}</p>
                    <p className="text-text-secondaire text-sm mt-1">
                      {h.parametres?.localisation?.ville},{" "}
                      {h.parametres?.localisation?.pays}
                    </p>
                    <p className="text-text-secondaire text-xs mt-0.5">
                      {h.parametres?.localisation?.lat.toFixed(4)},{" "}
                      {h.parametres?.localisation?.lon.toFixed(4)} ·{" "}
                      {h.parametres?.localisation?.timezone} ·{" "}
                      {h.membres.length} membre{h.membres.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingId(h.id)}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Pencil size={14} />
                    Modifier
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {!isLoading && (!households || households.length === 0) && (
          <HouseholdForm
            uid={user.uid}
            onSaved={() => navigate("/")}
          />
        )}
      </section>
    </div>
  );
}
