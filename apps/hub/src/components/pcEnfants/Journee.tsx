import type { ConfigAppareil, UsageJour } from "@family-hub/controle-parental";
import { dureeTexte, heure } from "../../lib/controleParental/phrases";

/** La journée sur le PC : temps total, temps par appli, ce qui a été refusé. Jamais le contenu. */
export default function Journee({ config, usage }: { config: ConfigAppareil; usage: UsageJour | null }) {
  const nomAppli = (id: string) => config.applis[id]?.nom ?? id;
  const applis = Object.entries(usage?.minutesParAppli ?? {})
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = applis[0]?.[1] ?? 1;

  return (
    <section aria-labelledby="journee" className="rounded-2xl bg-ebony-card border border-hairline p-4 flex flex-col gap-3">
      <h2 id="journee" className="text-lg font-semibold text-cream">Aujourd'hui sur le PC</h2>
      {!usage || usage.minutesSession === 0 ? (
        <p className="text-base text-cream-mute">Pas encore utilisé aujourd'hui.</p>
      ) : (
        <>
          <p className="text-2xl text-cream">{dureeTexte(usage.minutesSession)} de PC</p>
          {applis.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Temps par appli">
              {applis.map(([id, minutes]) => (
                <li key={id} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-base">
                    <span className="text-cream truncate">{nomAppli(id)}</span>
                    <span className="text-cream-mute whitespace-nowrap">{dureeTexte(minutes)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ebony-ridge overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-sage" style={{ width: `${Math.round((minutes / max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {usage && usage.lancementsRefuses.length > 0 && (
        <div>
          <h3 className="text-base text-cream-mute">Applis refusées</h3>
          <ul className="text-base text-cream">
            {usage.lancementsRefuses.map((e, i) => (
              <li key={i}>
                {e.appli ? nomAppli(e.appli) : "Une appli"}
                {e.quand && <span className="text-cream-mute"> · {heure(e.quand)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {usage && usage.codeParent.length > 0 && (
        <p className="text-base text-cream">
          Code parent utilisé
          {usage.codeParent.map((e) => (e.quand ? ` à ${heure(e.quand)}` : "")).join(",")}
          <span className="text-cream-mute"> (déblocage d'une heure sur le PC)</span>
        </p>
      )}
    </section>
  );
}
