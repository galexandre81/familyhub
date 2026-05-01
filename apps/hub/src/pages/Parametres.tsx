import { useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/queries";

export default function Parametres() {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Paramètres</h1>

      <section className="tile-card space-y-3">
        <h2 className="text-xl">Mon compte</h2>
        <div className="flex items-center gap-3">
          {user?.photoURL && <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />}
          <div>
            <p>{user?.displayName}</p>
            <p className="text-text-secondaire text-sm">{user?.email}</p>
          </div>
        </div>
      </section>

      <section className="tile-card space-y-3">
        <h2 className="text-xl">Foyers</h2>
        {!households || households.length === 0 ? (
          <p className="text-text-secondaire">
            Aucun foyer. La création de foyer (avec localisation) sera ajoutée dans la prochaine itération.
          </p>
        ) : (
          <ul className="space-y-2">
            {households.map((h) => (
              <li key={h.id}>
                <p className="font-semibold">{h.nom}</p>
                <p className="text-text-secondaire text-sm">
                  {h.parametres?.localisation?.ville ?? "—"} · {h.parametres?.langue ?? "fr"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
