import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
export default function RecetteCuisine() {
  const { recetteId } = useParams<{ recetteId: string }>();
  const [search] = useSearchParams();
  const portionsParam = parseInt(search.get("portions") ?? "0", 10);
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: recette, isLoading } = useRecette(householdId, recetteId);

  const [stepIdx, setStepIdx] = useState(0);

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
  const etape = sortedEtapes[stepIdx];
  const isLast = stepIdx === sortedEtapes.length - 1;
  const isFirst = stepIdx === 0;

  return (
    <FullscreenWrapper>
      {/* Header : titre + sortie */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-secondaire">
            Mode cuisine · {targetPortions} pers
          </p>
          <h1 className="text-2xl md:text-3xl font-serif">{recette.nom}</h1>
        </div>
        <Link
          to={`/livre-recettes/${recette.id}`}
          className="p-3 rounded-full hover:bg-bordure transition"
          aria-label="Quitter le mode cuisine"
        >
          <X size={24} />
        </Link>
      </div>

      {/* Progression */}
      <div className="flex gap-1 mb-6">
        {sortedEtapes.map((_, i) => (
          <div
            key={i}
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

      {/* Étape courante : prend toute la place */}
      <div className="flex-1 flex flex-col">
        <div className="text-sm uppercase tracking-widest text-text-secondaire mb-2">
          Étape {stepIdx + 1} / {sortedEtapes.length}
        </div>
        <p className="text-2xl md:text-4xl leading-snug font-serif mb-6">
          {etape.description}
        </p>

        {etape.dureeMinutes && etape.dureeMinutes > 0 && (
          <Minuteur key={etape.ordre} initialMinutes={etape.dureeMinutes} />
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

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mt-6">
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
            to={`/livre-recettes/${recette.id}`}
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

function FullscreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-fond-principal text-text-principal flex flex-col p-6 md:p-10 overflow-auto z-50">
      {children}
    </div>
  );
}

/**
 * Minuteur visuel + sonore (beep simple via Web Audio API à la fin).
 * Compte à rebours en MM:SS, gros affichage.
 */
function Minuteur({ initialMinutes }: { initialMinutes: number }) {
  const initialSec = initialMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(initialSec);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!beepedRef.current) {
            beep();
            beepedRef.current = true;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function reset() {
    setSecondsLeft(initialSec);
    setRunning(false);
    beepedRef.current = false;
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
              if (isDone) reset();
              setRunning(true);
            }}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            <Play size={18} />
            {isDone ? "Recommencer" : secondsLeft === initialSec ? "Démarrer" : "Reprendre"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRunning(false)}
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
