import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useRecette } from "../lib/queries";
import { scaleQuantite } from "./RecetteDetail";

/**
 * Mode cuisine plein écran : étape par étape, gros texte, fond sombre.
 * Bouton minuteur intégré sur les étapes avec dureeMinutes.
 *
 * Pensé tablette / iPad mini en cuisine : grosses zones cliquables, contraste
 * fort, pas de défilement parasite.
 */

/** État d'un minuteur persistant entre les navigations d'étapes. */
type TimerState = { secondsLeft: number; running: boolean };

export default function RecetteCuisine() {
  const { recetteId } = useParams<{ recetteId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const portionsParam = parseInt(search.get("portions") ?? "0", 10);
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recette, isLoading } = useRecette(householdId, recetteId);

  const [stepIdx, setStepIdx] = useState(0);

  // État des minuteurs conservé au niveau page, indexé par ordre d'étape :
  // changer d'étape puis revenir préserve le temps restant et l'état de marche.
  const [timers, setTimers] = useState<Map<number, TimerState>>(() => new Map());

  const sortedEtapes = useMemo(
    () => (recette ? [...recette.etapes].sort((a, b) => a.ordre - b.ordre) : []),
    [recette],
  );

  // Garde-fou si l'index dépasse (ex: hot reload)
  useEffect(() => {
    if (stepIdx >= sortedEtapes.length && sortedEtapes.length > 0) {
      setStepIdx(sortedEtapes.length - 1);
    }
  }, [stepIdx, sortedEtapes.length]);

  // Destination de sortie : si on vient du menu, on y retourne ; sinon détail recette.
  const exitTo =
    search.get("from") === "menu"
      ? "/menu"
      : recette
        ? `/livre-recettes/${recette.id}`
        : "/livre-recettes";

  // Bouton de fermeture : focus au montage + cible de l'Échap.
  const closeRef = useRef<HTMLAnchorElement | null>(null);

  // Échap = quitter le mode cuisine.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        navigate(exitTo);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, exitTo]);

  // Focus sur le bouton de fermeture au montage (accessibilité dialog).
  useEffect(() => {
    closeRef.current?.focus();
  }, [recette]);

  if (isLoading) {
    return (
      <FullscreenWrapper>
        <p className="text-2xl text-text-secondaire">Chargement…</p>
      </FullscreenWrapper>
    );
  }
  if (!recette) {
    return (
      <FullscreenWrapper>
        <p className="text-2xl">Recette introuvable.</p>
        <Link to="/livre-recettes" className="btn-primary mt-4">
          Retour au livre
        </Link>
      </FullscreenWrapper>
    );
  }

  const targetPortions = portionsParam > 0 ? portionsParam : recette.portions;
  const ratio = targetPortions / recette.portions;

  // Recette sans étapes détaillées : on évite le crash et on propose les ingrédients.
  if (sortedEtapes.length === 0) {
    return (
      <FullscreenWrapper
        role="dialog"
        aria-modal="true"
        aria-label={recette.nom}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-text-secondaire">
              Mode cuisine · {targetPortions} pers
            </p>
            <h1 className="text-2xl md:text-3xl font-serif">{recette.nom}</h1>
          </div>
          <Link
            ref={closeRef}
            to={exitTo}
            className="p-3 rounded-full hover:bg-bordure transition"
            aria-label="Quitter le mode cuisine"
          >
            <X size={24} />
          </Link>
        </div>

        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <p className="text-2xl md:text-3xl leading-snug font-serif mb-6">
            Cette recette n'a pas d'étapes détaillées.
          </p>

          <details className="mt-2 group" open>
            <summary className="cursor-pointer text-sm uppercase tracking-widest text-text-secondaire hover:text-text-principal">
              Voir les ingrédients ({recette.ingredients.length})
            </summary>
            <ul className="mt-3 space-y-1 text-sm text-text-secondaire">
              {recette.ingredients.map((ing, i) => (
                <li key={`${ing.libelle}-${i}`}>
                  <span className="font-medium tabular-nums">
                    {scaleQuantite(ing.quantite, ratio)} {ing.unite}
                  </span>{" "}
                  · {ing.libelle}
                </li>
              ))}
            </ul>
          </details>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 mt-6">
          <Link
            to={`/livre-recettes/${recette.id}`}
            className="btn-primary flex items-center gap-2 px-8 py-3"
          >
            Retour à la recette
            <ArrowRight size={18} />
          </Link>
        </div>
      </FullscreenWrapper>
    );
  }

  const etape = sortedEtapes[stepIdx];
  const isLast = stepIdx === sortedEtapes.length - 1;
  const isFirst = stepIdx === 0;

  // Accesseurs minuteur pour l'étape courante (sécurisés si etape est absent).
  const currentOrdre = etape?.ordre;
  const initialSec = (etape?.dureeMinutes ?? 0) * 60;
  const timerState: TimerState =
    currentOrdre !== undefined
      ? timers.get(currentOrdre) ?? { secondsLeft: initialSec, running: false }
      : { secondsLeft: initialSec, running: false };

  const setTimerState = useCallback(
    (ordre: number, updater: (prev: TimerState) => TimerState) => {
      setTimers((prev) => {
        const next = new Map(prev);
        const existing = next.get(ordre) ?? { secondsLeft: initialSec, running: false };
        next.set(ordre, updater(existing));
        return next;
      });
    },
    [initialSec],
  );

  return (
    <FullscreenWrapper
      role="dialog"
      aria-modal="true"
      aria-label={recette.nom}
    >
      {/* Header : titre + sortie (fixe en haut) */}
      <div className="shrink-0 flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-secondaire">
            Mode cuisine · {targetPortions} pers
          </p>
          <h1 className="text-2xl md:text-3xl font-serif">{recette.nom}</h1>
        </div>
        <Link
          ref={closeRef}
          to={exitTo}
          className="p-3 rounded-full hover:bg-bordure transition"
          aria-label="Quitter le mode cuisine"
        >
          <X size={24} />
        </Link>
      </div>

      {/* Progression : segments tappables qui sautent à l'étape (fixe en haut) */}
      <div className="shrink-0 flex gap-1 mb-6">
        {sortedEtapes.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStepIdx(i)}
            aria-label={`Aller à l'étape ${i + 1}`}
            className={`h-1.5 flex-1 rounded-full transition ${
              i < stepIdx
                ? "bg-accent-chaud"
                : i === stepIdx
                  ? "bg-accent-chaud/70"
                  : "bg-bordure"
            }`}
          />
        ))}
      </div>

      {/* Étape courante : zone scrollable qui prend la place restante */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
        <div className="text-sm uppercase tracking-widest text-text-secondaire mb-2">
          Étape {stepIdx + 1} / {sortedEtapes.length}
        </div>
        <p className="text-2xl md:text-4xl leading-snug font-serif mb-6">
          {etape?.description ?? ""}
        </p>

        {etape?.dureeMinutes && etape.dureeMinutes > 0 && currentOrdre !== undefined && (
          <Minuteur
            initialMinutes={etape.dureeMinutes}
            state={timerState}
            onChange={(updater) => setTimerState(currentOrdre, updater)}
          />
        )}

        {/* Ingrédients utiles (toujours visibles à droite/dessous) */}
        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm uppercase tracking-widest text-text-secondaire hover:text-text-principal">
            Voir les ingrédients ({recette.ingredients.length})
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-text-secondaire">
            {recette.ingredients.map((ing, i) => (
              <li key={`${ing.libelle}-${i}`}>
                <span className="font-medium tabular-nums">
                  {scaleQuantite(ing.quantite, ratio)} {ing.unite}
                </span>{" "}
                · {ing.libelle}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* Navigation : footer fixe, toujours visible */}
      <div className="shrink-0 flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          className="btn-secondary flex items-center gap-2 disabled:opacity-30 px-6 py-3"
        >
          <ArrowLeft size={18} />
          Précédent
        </button>
        {isLast ? (
          <Link
            to={exitTo}
            className="btn-primary flex items-center gap-2 px-8 py-3"
          >
            Terminer
            <ArrowRight size={18} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.min(sortedEtapes.length - 1, i + 1))}
            className="btn-primary flex items-center gap-2 px-8 py-3"
          >
            Suivant
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </FullscreenWrapper>
  );
}

function FullscreenWrapper({
  children,
  role,
  "aria-modal": ariaModal,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  role?: string;
  "aria-modal"?: boolean | "true" | "false";
  "aria-label"?: string;
}) {
  return (
    <div
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
      className="fixed inset-0 bg-fond-principal text-text-principal flex flex-col p-6 md:p-10 z-50"
    >
      {children}
    </div>
  );
}

/**
 * Minuteur visuel + sonore (beep simple via Web Audio API à la fin).
 * Compte à rebours en MM:SS, gros affichage.
 *
 * L'état (secondsLeft / running) est détenu par la page parente afin de
 * persister entre les changements d'étape. On reçoit l'état + un setter.
 */
function Minuteur({
  initialMinutes,
  state,
  onChange,
}: {
  initialMinutes: number;
  state: TimerState;
  onChange: (updater: (prev: TimerState) => TimerState) => void;
}) {
  const initialSec = initialMinutes * 60;
  const { secondsLeft, running } = state;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepedRef = useRef(false);

  // Le beep ne doit retentir qu'une fois ; on réarme dès qu'on quitte zéro.
  useEffect(() => {
    if (secondsLeft > 0) beepedRef.current = false;
  }, [secondsLeft]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      onChange((prev) => {
        if (prev.secondsLeft <= 1) {
          if (!beepedRef.current) {
            beep();
            beepedRef.current = true;
          }
          return { secondsLeft: 0, running: false };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, onChange]);

  function reset() {
    beepedRef.current = false;
    onChange(() => ({ secondsLeft: initialSec, running: false }));
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const isDone = secondsLeft === 0;

  return (
    <div className={`tile-card flex items-center gap-4 ${isDone ? "border-accent-chaud" : ""}`}>
      <Timer size={28} className={isDone ? "text-accent-chaud" : "text-text-secondaire"} />
      <div
        className={`text-5xl md:text-6xl font-mono tabular-nums ${
          isDone ? "text-accent-chaud" : ""
        }`}
      >
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {!running ? (
          <button
            type="button"
            onClick={() => {
              if (isDone) {
                beepedRef.current = false;
                onChange(() => ({ secondsLeft: initialSec, running: true }));
              } else {
                onChange((prev) => ({ ...prev, running: true }));
              }
            }}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            <Play size={18} />
            {isDone ? "Recommencer" : secondsLeft === initialSec ? "Démarrer" : "Reprendre"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, running: false }))}
            className="btn-secondary flex items-center gap-2 px-6 py-3"
          >
            <Pause size={18} />
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="p-3 rounded-md border border-bordure hover:bg-bordure transition"
          aria-label="Réinitialiser"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Beep simple via Web Audio API (pas besoin de fichier son).
 * Fréquence 880 Hz, durée 800 ms, fade out doux.
 */
function beep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    // Vibration sur mobile si supporté
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  } catch {
    /* silence si pas de support audio */
  }
}
