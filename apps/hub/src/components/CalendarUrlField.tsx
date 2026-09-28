import { useId } from "react";
import { useCalendarConfigured } from "../lib/queries";
import { isValidIcalUrl } from "../lib/calendarUrl";

/**
 * Ce que l'utilisateur veut faire de l'adresse secrète iCal du foyer :
 * - keep  : ne rien toucher (valeur actuelle, ou rien si non configurée)
 * - set   : remplacer par `value`
 * - clear : retirer l'adresse
 */
export type CalendarUrlDraft =
  | { mode: "keep" }
  | { mode: "set"; value: string }
  | { mode: "clear" };

export type CalendarUrlAction =
  | { action: "none" }
  | { action: "set"; url: string }
  | { action: "clear" }
  | { action: "error"; message: string };

/**
 * Traduit le brouillon en action à exécuter à l'enregistrement.
 * `configured` vaut undefined tant que la présence n'est pas connue (chargement
 * ou lecture refusée) : on ne bloque alors pas l'utilisateur.
 */
export function resolveCalendarUrlDraft(
  draft: CalendarUrlDraft,
  configured: boolean | undefined,
): CalendarUrlAction {
  if (draft.mode === "clear") return { action: "clear" };
  const value = draft.mode === "set" ? draft.value.trim() : "";
  if (!value) {
    if (configured === false) {
      return {
        action: "error",
        message: "Colle l'adresse secrète iCal de ton agenda Google.",
      };
    }
    return { action: "none" };
  }
  if (!isValidIcalUrl(value)) {
    return {
      action: "error",
      message: "L'adresse iCal doit commencer par https:// (pas webcal:// ni http://).",
    };
  }
  return { action: "set", url: value };
}

export default function CalendarUrlField({
  householdId,
  draft,
  onChange,
}: {
  householdId: string;
  draft: CalendarUrlDraft;
  onChange: (d: CalendarUrlDraft) => void;
}) {
  const inputId = useId();
  const helpId = useId();
  const { data, isLoading } = useCalendarConfigured(householdId);
  const configured = data?.configured;

  const help = (
    <p id={helpId} className="text-text-secondaire text-xs mt-1">
      Où la trouver : Google Agenda sur ordinateur → ⚙ Paramètres → choisis l'agenda à
      gauche → <strong>Paramètres et partage</strong> → section « Intégrer l'agenda » →{" "}
      <strong>Adresse secrète au format iCal</strong>. Garde-la pour toi : quiconque la
      possède peut lire l'agenda.
    </p>
  );

  if (isLoading) {
    return <p className="text-text-secondaire text-sm">Vérification de l'agenda…</p>;
  }

  if (configured && draft.mode === "keep") {
    return (
      <div className="space-y-1">
        <span className="block text-sm text-text-secondaire">
          Adresse secrète iCal de ton agenda Google
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Agenda configuré ✓</span>
          <button
            type="button"
            onClick={() => onChange({ mode: "set", value: "" })}
            className="btn-secondary text-xs"
          >
            Remplacer
          </button>
          <button
            type="button"
            onClick={() => onChange({ mode: "clear" })}
            className="text-xs text-text-secondaire hover:text-accent-chaud"
          >
            Retirer
          </button>
        </div>
      </div>
    );
  }

  if (draft.mode === "clear") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-accent-chaud">
          L'adresse de l'agenda sera retirée à l'enregistrement.
        </span>
        <button
          type="button"
          onClick={() => onChange({ mode: "keep" })}
          className="btn-secondary text-xs"
        >
          Annuler
        </button>
      </div>
    );
  }

  const value = draft.mode === "set" ? draft.value : "";
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm text-text-secondaire mb-1">
        Adresse secrète iCal de ton agenda Google
        {!configured && <span className="text-accent-chaud"> *</span>}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange({ mode: "set", value: e.target.value })}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          aria-describedby={helpId}
          className="input flex-1"
        />
        {configured && (
          <button
            type="button"
            onClick={() => onChange({ mode: "keep" })}
            className="btn-secondary text-xs"
          >
            Garder l'actuelle
          </button>
        )}
      </div>
      {help}
    </div>
  );
}
