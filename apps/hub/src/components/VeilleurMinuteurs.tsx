/**
 * Veilleur de minuteurs : un minuteur qui arrive à zéro sonne et s'affiche
 * par-dessus n'importe quelle page du hub (téléphone et PC), pas seulement
 * dans le mode recette. Le passage à `ended` et le son sont faits par
 * l'abonnement partagé (MinuteursProvider) ; ce composant ne fait que le
 * bandeau « c'est prêt ! » avec « OK ».
 *
 * Dans le mode recette (…/cuisine), le bandeau s'efface : le mode recette
 * montre déjà l'alarme (colonne des minuteurs sur PC, bouton jaune puis
 * feuille sur téléphone) — un seul jaune à l'écran.
 */
import { useLocation } from "react-router-dom";
import { BellRing, Check } from "lucide-react";
import { useMinuteurs } from "../lib/MinuteursContext";
import { identifiantAppareil } from "../lib/appareil";
import { sonneIci } from "../lib/minuteurs";

export default function VeilleurMinuteurs() {
  const { minuteurs, nowMs, acquitter } = useMinuteurs();
  const { pathname } = useLocation();
  const appareil = identifiantAppareil();
  const enAlarme = minuteurs.filter((m) => sonneIci(m, nowMs, appareil));
  if (enAlarme.length === 0 || /\/cuisine\/?$/.test(pathname)) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[70] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 space-y-2 pointer-events-none"
    >
      {enAlarme.map((m) => (
        <div
          key={m.id}
          className="pointer-events-auto mx-auto max-w-xl flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg bg-[rgb(var(--c-maintenant))] text-[rgb(var(--c-bordure))]"
        >
          <BellRing aria-hidden className="h-6 w-6 shrink-0" />
          <p className="flex-1 min-w-0 text-lg font-semibold leading-tight line-clamp-2">
            Minuteur {m.label} : c'est prêt !
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
  );
}
