import { useState } from "react";
import { X } from "lucide-react";
import type { HeuresRepas } from "@family-hub/types";
import { useMaintenant } from "../../lib/useMaintenant";
import {
  choixEcheances,
  echeanceDepuisHeure,
  quandTexte,
  type SorteDecision,
} from "../../lib/controleParental/phrases";

/**
 * « Jusqu'à quand ? » (maquette A, 27.10) : en tête, pleine largeur, « Jusqu'à
 * ce que je change » ; puis des durées et des repères, puis une heure libre.
 * `remplace` dit la décision en cours que ce choix annule (une seule à la
 * fois) ; `note` dit ce qui revient ensuite.
 */
export default function FeuilleEcheance({
  surtitre,
  titre,
  description,
  sorte,
  remplace,
  note,
  heuresRepas,
  onChoisir,
  onFermer,
}: {
  surtitre: string;
  titre: string;
  description?: string;
  sorte: SorteDecision;
  remplace: string | null;
  note: string;
  heuresRepas?: HeuresRepas;
  onChoisir: (jusqua: Date) => void;
  onFermer: () => void;
}) {
  const maintenant = useMaintenant();
  const [heureLibre, setHeureLibre] = useState("");
  const libre = heureLibre ? echeanceDepuisHeure(heureLibre, maintenant) : null;
  const choix = choixEcheances(maintenant, sorte, heuresRepas);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`${surtitre} : ${titre}`}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/50" onClick={onFermer} />
      <div className="relative rounded-t-3xl bg-ebony-panel border-t border-hairline p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-brass">{surtitre}</span>
            <h2 className="font-serif text-2xl text-cream">{titre}</h2>
            {description && <p className="text-[15px] text-cream-mute">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full bg-ebony-card text-cream"
            aria-label="Fermer"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {remplace && (
          <p className="rounded-xl border border-hairline px-3 py-2 text-[15px] text-cream-mute">Remplace : {remplace}</p>
        )}

        <p className="text-lg font-semibold text-cream">Jusqu'à quand ?</p>
        <ul className="grid grid-cols-2 gap-2.5">
          {choix.map((c) => (
            <li key={c.libelle} className={c.principal ? "col-span-2" : undefined}>
              <button
                type="button"
                onClick={() => onChoisir(c.jusqua)}
                className={
                  c.principal
                    ? "w-full min-h-14 rounded-xl px-3 text-base font-semibold bg-brass text-ebony"
                    : "w-full min-h-14 rounded-xl px-3 text-base text-cream bg-ebony-card border border-hairline"
                }
              >
                {c.libelle}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-end gap-2.5">
          <label className="flex-1 flex flex-col gap-1 text-[15px] text-cream-mute">
            Autre heure
            <input
              type="time"
              value={heureLibre}
              onChange={(e) => setHeureLibre(e.target.value)}
              className="min-h-12 rounded-xl bg-ebony-card border border-hairline px-3 text-base text-cream"
            />
          </label>
          <button
            type="button"
            disabled={!libre}
            onClick={() => libre && onChoisir(libre)}
            className="min-h-12 rounded-xl px-5 text-base font-semibold bg-ebony-card border border-brass text-cream disabled:opacity-40"
          >
            {libre ? `Jusqu'à ${quandTexte(libre, maintenant)}` : "Valider"}
          </button>
        </div>

        {note && <p className="rounded-xl bg-ebony-card px-3 py-2.5 text-[15px] text-cream-mute">{note}</p>}
      </div>
    </div>
  );
}
