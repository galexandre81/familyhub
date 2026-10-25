/**
 * Carte d'une session de batch cooking (téléphone : onglets Aujourd'hui et
 * Semaine). Toute la carte ouvre la page de la session.
 */
import { Link } from "react-router-dom";
import { ChevronRight, CookingPot } from "lucide-react";
import type { BatchSessionWithId } from "../lib/queries";
import { dureeTexte } from "../lib/batch";

export default function CarteBatch({
  planId,
  batch,
  titre,
  recettes,
}: {
  planId: string;
  batch: BatchSessionWithId;
  /** « Batch cooking aujourd'hui », « Batch cooking demain »… */
  titre: string;
  recettes: Record<string, { nom: string } | undefined>;
}) {
  const noms = batch.recetteIds.map((id) => recettes[id]?.nom).filter(Boolean).join(", ");
  const duree = dureeTexte(batch.dureeEstimeeMinutes);
  return (
    <Link
      to={`/batch/${planId}/${batch.id}`}
      className={
        "flex items-center gap-3 rounded-xl bg-ebony-card border border-hairline px-4 py-3 min-h-16 " +
        (batch.done ? "opacity-50" : "")
      }
    >
      <CookingPot size={24} aria-hidden="true" className="shrink-0 text-brass" />
      <span className="flex-1 min-w-0">
        <span className="block text-base font-semibold text-cream">
          {titre}
          {duree && <span className="font-normal text-cream-mute"> · {duree}</span>}
          {batch.done && <span className="font-normal text-cream-mute"> · fait</span>}
        </span>
        {noms && <span className="block text-[15px] text-cream-mute line-clamp-2">{noms}</span>}
      </span>
      <ChevronRight size={24} aria-hidden="true" className="shrink-0 text-cream-mute" />
    </Link>
  );
}
