/** Rappel « Cette semaine : yaourt à la place de Crème » en tête d'une recette. */
import { texteRappel, type RemplacementActif } from "../../lib/remplacements";

export default function RappelRemplacements({ remplacements }: { remplacements: RemplacementActif[] }) {
  if (remplacements.length === 0) return null;
  return (
    <div className="space-y-1 rounded-xl border border-hairline bg-ebony-card px-3 py-2 text-base text-brass">
      {remplacements.map((r) => (
        <p key={r.nomArticle}>{texteRappel(r)}</p>
      ))}
    </div>
  );
}
