/**
 * Panneau des minuteurs partagés avec l'iPad cuisine.
 *
 * Autonome : il s'abonne lui-même (useMinuteurs) ; on peut le poser dans une
 * page, la colonne droite du mode recette (PC) ou une feuille en bas d'écran
 * (téléphone). Le son ne joue qu'une fois, même si plusieurs panneaux sont
 * ouverts.
 */
import { useState, type FormEvent } from "react";
import { BellRing, Check, Pause, Play, Plus, Square, Timer, X } from "lucide-react";
import { useMinuteurs, type Minuteur } from "../lib/useMinuteurs";
import { estEnAlarme, formatMinuteur, lireMinutesSaisies, tempsRestantMs } from "../lib/minuteurs";

export interface MinuteurPanneauProps {
  householdId: string;
  /** Nom donné aux minuteurs lancés depuis ce panneau (ex. l'étape de recette). Sinon : « 5 min ». */
  libelleParDefaut?: string;
  /** Sans titre, marges resserrées : colonne étroite ou feuille du bas. */
  compact?: boolean;
  className?: string;
}

const RAPIDES = [1, 5, 10];

const BOUTON = "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition";
const BOUTON_ACTION = `${BOUTON} bg-brass text-ebony hover:opacity-90`;
const BOUTON_DOUX = `${BOUTON} bg-ebony border border-hairline text-cream hover:border-brass`;

export function MinuteurPanneau({
  householdId,
  libelleParDefaut,
  compact = false,
  className = "",
}: MinuteurPanneauProps): JSX.Element {
  const { minuteurs, nowMs, lancer, ajouterUneMinute, pause, reprendre, arreter, acquitter } =
    useMinuteurs(householdId);
  const [autreOuvert, setAutreOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [saisieInvalide, setSaisieInvalide] = useState(false);

  const visibles = minuteurs.filter((m) => m.status !== "acknowledged");
  const enAlarme = visibles.filter((m) => estEnAlarme(m, nowMs));
  const enCours = visibles.filter((m) => !estEnAlarme(m, nowMs));
  const nom = libelleParDefaut?.trim() || null;

  const lancerAutre = (e: FormEvent) => {
    e.preventDefault();
    const secondes = lireMinutesSaisies(saisie);
    if (secondes === null) {
      setSaisieInvalide(true);
      return;
    }
    void lancer(nom, secondes);
    setSaisie("");
    setSaisieInvalide(false);
    setAutreOuvert(false);
  };

  return (
    <section
      aria-label="Minuteurs"
      className={`bg-ebony-card text-cream rounded-2xl ${compact ? "p-3 space-y-3" : "p-5 space-y-4"} ${className}`}
    >
      {!compact && (
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Timer aria-hidden className="h-5 w-5 text-brass" />
          Minuteurs
        </h2>
      )}

      {enAlarme.length > 0 && (
        <div role="alert" className="space-y-2">
          {enAlarme.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3 bg-[rgb(var(--c-maintenant))] text-[rgb(var(--c-bordure))]"
            >
              <BellRing aria-hidden className="h-6 w-6 shrink-0" />
              <p className="flex-1 min-w-0 text-lg font-semibold leading-tight line-clamp-2">
                {m.label} : c'est prêt !
              </p>
              <button
                type="button"
                onClick={() => void acquitter(m)}
                className="min-h-12 min-w-12 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-bold bg-[rgb(var(--c-bordure))] text-[rgb(var(--c-maintenant))]"
              >
                <Check aria-hidden className="h-5 w-5" />
                OK
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {RAPIDES.map((min) => (
          <button
            key={min}
            type="button"
            onClick={() => void lancer(nom, min * 60)}
            className={`${BOUTON_ACTION} px-2`}
            aria-label={`Lancer un minuteur de ${min} minute${min > 1 ? "s" : ""}`}
          >
            <Timer aria-hidden className="h-4 w-4 shrink-0" />
            {min} min
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAutreOuvert((o) => !o)}
          aria-expanded={autreOuvert}
          className={`${BOUTON_DOUX} px-2`}
        >
          {autreOuvert ? <X aria-hidden className="h-4 w-4 shrink-0" /> : <Plus aria-hidden className="h-4 w-4 shrink-0" />}
          Autre
        </button>
      </div>

      {autreOuvert && (
        <form onSubmit={lancerAutre} className="flex items-end gap-2">
          <label className="flex-1 min-w-0 text-base text-cream-mute">
            Durée en minutes
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={saisie}
              onChange={(e) => {
                setSaisie(e.target.value);
                setSaisieInvalide(false);
              }}
              placeholder="ex. 7"
              aria-invalid={saisieInvalide}
              className={`mt-1 block w-full min-h-12 rounded-xl bg-ebony border px-3 text-lg text-cream ${
                saisieInvalide ? "border-copper" : "border-hairline"
              }`}
            />
          </label>
          <button type="submit" className={BOUTON_ACTION}>
            <Play aria-hidden className="h-4 w-4" />
            Lancer
          </button>
        </form>
      )}
      {autreOuvert && saisieInvalide && (
        <p className="text-base text-copper">Indique une durée en minutes (24 h au plus).</p>
      )}

      {enCours.length > 0 ? (
        <ul className="space-y-2">
          {enCours.map((m) => (
            <LigneMinuteur
              key={m.id}
              m={m}
              nowMs={nowMs}
              compact={compact}
              onPlusUn={() => void ajouterUneMinute(m)}
              onPauseReprise={() => void (m.status === "paused" ? reprendre(m) : pause(m))}
              onArreter={() => void arreter(m)}
            />
          ))}
        </ul>
      ) : (
        enAlarme.length === 0 && (
          <p className="text-base text-cream-mute">Aucun minuteur en cours. Il apparaîtra aussi sur l'iPad.</p>
        )
      )}
    </section>
  );
}

function LigneMinuteur({
  m,
  nowMs,
  compact,
  onPlusUn,
  onPauseReprise,
  onArreter,
}: {
  m: Minuteur;
  nowMs: number;
  compact: boolean;
  onPlusUn: () => void;
  onPauseReprise: () => void;
  onArreter: () => void;
}): JSX.Element {
  const enPause = m.status === "paused";
  return (
    <li className="rounded-xl border border-hairline bg-ebony px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="flex-1 min-w-0 truncate text-base">{m.label}</span>
        <span className={`nums font-semibold ${compact ? "text-2xl" : "text-3xl"} ${enPause ? "text-cream-mute" : ""}`}>
          {formatMinuteur(tempsRestantMs(m, nowMs))}
        </span>
      </div>
      {enPause && <p className="text-base text-cream-mute">En pause</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" onClick={onPlusUn} aria-label="Ajouter une minute" className={`${BOUTON_DOUX} px-2`}>
          <Plus aria-hidden className="h-4 w-4 shrink-0" />
          1 min
        </button>
        <button type="button" onClick={onPauseReprise} className={`${BOUTON_DOUX} px-2`}>
          {enPause ? <Play aria-hidden className="h-4 w-4 shrink-0" /> : <Pause aria-hidden className="h-4 w-4 shrink-0" />}
          {enPause ? "Reprendre" : "Pause"}
        </button>
        <button type="button" onClick={onArreter} className={`${BOUTON_DOUX} px-2`}>
          <Square aria-hidden className="h-4 w-4 shrink-0" />
          Arrêter
        </button>
      </div>
    </li>
  );
}
