/**
 * Adresse de l'agenda Google (iCal) du foyer, affiché par l'iPad de cuisine :
 * la changer ou la retirer, puis synchroniser la tuile agenda.
 */
import { useState } from "react";
import { useCalendarConfigured } from "../lib/queries";
import { useSaveCalendarUrl, useSyncCalendarTile } from "../lib/mutations";
import CalendarUrlField, {
  resolveCalendarUrlDraft,
  type CalendarUrlDraft,
} from "./CalendarUrlField";

/** Changer l'adresse iCal du foyer sans recréer la tuile calendrier. */
export default function CalendarUrlSection({ householdId, tileId }: { householdId: string; tileId: string }) {
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
    <section className="rounded-2xl bg-ebony-card border border-hairline p-5 space-y-3">
      <h3 className="text-lg font-semibold text-cream">Agenda Google</h3>
      <CalendarUrlField householdId={householdId} draft={draft} onChange={setDraft} />
      {error && <p className="text-base text-red-600">{error}</p>}
      {done && <p className="text-base text-cream-mute">{done}</p>}
      {draft.mode !== "keep" && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void handleSave()} disabled={busy} className="min-h-12 rounded-xl px-5 text-base font-semibold bg-brass text-ebony disabled:opacity-50">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </section>
  );
}
