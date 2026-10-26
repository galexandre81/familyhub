import { useState } from "react";
import { X } from "lucide-react";
import { sansFin } from "@family-hub/controle-parental";
import { useMaintenant } from "../../lib/useMaintenant";
import {
  choixEcheances,
  echeanceDepuisHeure,
  quandTexte,
} from "../../lib/controleParental/phrases";

/**
 * « Jusqu'à quand ? » : toute décision sur le PC a une fin. Des choix tout
 * faits (30 min, 1 h, ce soir 23h…) et une heure libre ; pas de bouton
 * « pour toujours ». `remplace` dit ce que ce choix annule.
 */
export default function FeuilleEcheance({
  titre,
  sorte,
  remplace,
  onChoisir,
  onFermer,
}: {
  titre: string;
  sorte: "debloquer" | "verrouiller" | "ecole";
  remplace: string | null;
  onChoisir: (jusqua: Date) => void;
  onFermer: () => void;
}) {
  const maintenant = useMaintenant();
  const [heureLibre, setHeureLibre] = useState("");
  const libre = heureLibre ? echeanceDepuisHeure(heureLibre, maintenant) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/50" onClick={onFermer} />
      <div className="relative rounded-t-2xl bg-ebony-panel border-t border-hairline p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-cream">{titre}</h2>
            <p className="text-base text-cream-mute">Jusqu'à quand ?</p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="min-h-12 min-w-12 -mr-2 -mt-2 inline-flex items-center justify-center text-cream-mute"
            aria-label="Fermer"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {remplace && (
          <p className="rounded-xl bg-ebony-card border border-hairline px-3 py-2 text-[15px] text-cream-mute">
            Remplace : {remplace}
          </p>
        )}

        <ul className="grid grid-cols-2 gap-2">
          {choixEcheances(maintenant, sorte).map((c) => (
            <li key={c.libelle} className={sansFin(c.jusqua) ? "col-span-2" : undefined}>
              <button
                type="button"
                onClick={() => onChoisir(c.jusqua)}
                className="w-full min-h-12 rounded-xl bg-ebony-card border border-hairline px-3 text-base text-cream"
              >
                {c.libelle}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-end gap-2">
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
            className="min-h-12 rounded-xl px-5 text-base font-semibold bg-brass text-ebony disabled:opacity-40"
          >
            {libre ? `Jusqu'à ${quandTexte(libre, maintenant)}` : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
