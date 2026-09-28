import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useCalendarConfigured, useTile } from "../lib/queries";
import { useSaveCalendarUrl, useSyncCalendarTile } from "../lib/mutations";
import CalendarUrlField, {
  resolveCalendarUrlDraft,
  type CalendarUrlDraft,
} from "../components/CalendarUrlField";

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

          {tile.type === "calendar" && householdId && (
            <CalendarUrlSection householdId={householdId} tileId={tile.id} />
          )}

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

/** Changer l'adresse iCal du foyer sans recréer la tuile calendrier. */
function CalendarUrlSection({ householdId, tileId }: { householdId: string; tileId: string }) {
  const [draft, setDraft] = useState<CalendarUrlDraft>({ mode: "keep" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { data } = useCalendarConfigured(householdId);
  const save = useSaveCalendarUrl();
  const sync = useSyncCalendarTile();
  const busy = save.isPending || sync.isPending;

  async function handleSave() {
    setError(null);
    setDone(null);
    const action = resolveCalendarUrlDraft(draft, data?.configured);
    if (action.action === "error") {
      setError(action.message);
      return;
    }
    if (action.action === "none") {
      setDone("Rien à enregistrer.");
      return;
    }
    try {
      await save.mutateAsync({
        householdId,
        icalUrl: action.action === "set" ? action.url : null,
      });
      setDraft({ mode: "keep" });
      if (action.action === "set") {
        const res = await sync.mutateAsync({ householdId, tileId });
        setDone(`Agenda enregistré · ${res.eventsCount} événement${res.eventsCount > 1 ? "s" : ""} synchronisé${res.eventsCount > 1 ? "s" : ""}.`);
      } else {
        setDone("Adresse de l'agenda retirée.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <section className="tile-card space-y-3">
      <h2 className="text-xl">Agenda Google</h2>
      <CalendarUrlField householdId={householdId} draft={draft} onChange={setDraft} />
      {error && <p className="text-accent-chaud text-sm">{error}</p>}
      {done && <p className="text-text-secondaire text-sm">{done}</p>}
      {draft.mode !== "keep" && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void handleSave()} disabled={busy} className="btn-primary">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </section>
  );
}
