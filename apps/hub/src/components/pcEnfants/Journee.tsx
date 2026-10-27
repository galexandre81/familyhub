import type { EtatAppareil, UsageJour } from "@family-hub/controle-parental";
import { applisDuJour, dureeSecondesTexte, evenementsDuJour } from "../../lib/controleParental/phrases";

/** La journée sur le PC : temps total, temps par appli, ce qui a été refusé. Jamais le contenu. */
export default function Journee({ usage, etat }: { usage: UsageJour | null; etat: EtatAppareil | null }) {
  const applis = applisDuJour(usage, etat);
  const max = applis[0]?.secondes ?? 1;
  const evenements = evenementsDuJour(usage, etat);

  return (
    <section aria-labelledby="journee" className="rounded-2xl bg-ebony-card border border-hairline p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="journee" className="text-lg font-semibold text-cream">Aujourd'hui</h2>
        {usage && usage.secondesSession > 0 && (
          <span className="font-serif text-2xl text-cream">{dureeSecondesTexte(usage.secondesSession)}</span>
        )}
      </div>
      {!usage || usage.secondesSession === 0 ? (
        <p className="text-base text-cream-mute">Pas encore utilisé aujourd'hui.</p>
      ) : (
        applis.length > 0 && (
          <ul className="flex flex-col gap-2.5" aria-label="Temps par appli">
            {applis.map((a) => (
              <li key={a.id} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2 text-[15px]">
                  <span className="text-cream truncate">{a.nom}</span>
                  <span className="text-cream-mute whitespace-nowrap">{dureeSecondesTexte(a.secondes)}</span>
                </div>
                <div className="h-2 rounded-full bg-ebony-ridge overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${Math.round((a.secondes / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      {evenements.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-[15px] text-cream-mute" aria-label="Ce qui s'est passé">
          {evenements.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
