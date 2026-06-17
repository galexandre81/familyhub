import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useDisplays, useHouseholds, useTiles } from "../lib/queries";
import { ErrorState } from "../components/states";

export default function Dashboard() {
  const { user } = useAuth();
  const {
    data: households,
    isLoading,
    isError,
    refetch,
  } = useHouseholds(user?.uid);
  const household = households?.[0];
  const { data: displays } = useDisplays(household?.id);
  const { data: tiles } = useTiles(household?.id);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <header>
        <div className="rule mb-6">
          <span className="rule-mark" />
          <span className="eyebrow">Édition du jour</span>
          <span className="rule-mark" />
        </div>
        <h1 className="font-serif text-5xl tracking-tight leading-none">
          <span>Bienvenue,</span>{" "}
          <span className="italic text-terracotta">
            {user?.displayName?.split(" ")[0] ?? "à la maison"}
          </span>
        </h1>
        <p className="font-serif italic text-lg text-ink-mute mt-3">
          Vos foyers, vos écrans, vos tuiles.
        </p>
      </header>

      {isLoading && (
        <p className="text-ink-mute italic font-serif">Chargement…</p>
      )}

      {isError && (
        <ErrorState
          message="Impossible de charger vos foyers."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && households?.length === 0 && (
        <div className="tile-card text-center py-12 max-w-xl mx-auto">
          <p className="font-serif italic text-2xl text-ink mb-2">
            Première étape
          </p>
          <p className="text-ink-mute mb-8">
            Créez votre foyer pour commencer à configurer vos écrans.
          </p>
          <Link to="/parametres" className="btn-primary inline-block">
            Créer mon foyer
          </Link>
        </div>
      )}

      {!isError && households && households.length > 0 && (
        <>
          {/* Stats grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Foyer"
              value={household?.nom ?? "—"}
              detail={household?.parametres?.localisation?.ville}
            />
            <StatCard
              label="Écrans"
              value={displays?.length ?? 0}
              detail={displays && displays.length > 0
                ? displays.map((d) => d.nom).join(" · ")
                : "Aucun configuré"}
            />
            <StatCard
              label="Tuiles"
              value={tiles?.length ?? 0}
              detail={tiles && tiles.length > 0
                ? `${tiles.length} configurée${tiles.length > 1 ? "s" : ""}`
                : "Aucune tuile"}
            />
          </section>

          <div className="rule">
            <span className="rule-mark" />
          </div>

          {/* Foyers détail */}
          <section>
            <h2 className="eyebrow mb-4">Foyers</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {households.map((h) => (
                <li key={h.id} className="tile-card">
                  <p className="eyebrow mb-2">Foyer</p>
                  <h3 className="font-serif italic text-3xl text-ink mb-2">{h.nom}</h3>
                  <p className="text-sm text-ink-mute">
                    {h.parametres?.localisation?.ville}
                    {h.parametres?.localisation?.pays &&
                      `, ${h.parametres.localisation.pays}`}
                  </p>
                  <p className="text-xs text-ink-mute mt-1">
                    {h.membres.length} membre{h.membres.length > 1 ? "s" : ""}
                  </p>
                  <div className="mt-6 flex gap-2">
                    <Link to="/displays" className="btn-secondary">
                      Écrans
                    </Link>
                    <Link to="/tiles" className="btn-secondary">
                      Tuiles
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="tile-card">
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-serif italic text-3xl text-ink leading-tight nums">{value}</p>
      {detail && (
        <p className="text-xs text-ink-mute mt-2 truncate">{detail}</p>
      )}
    </div>
  );
}
