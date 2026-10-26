import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ACTION_NEXTDNS, jourLocal, type RapportNextdns, type SiteDuJour } from "@family-hub/controle-parental";
import { changerSite } from "../../lib/controleParental/nextdns";
import { phraseQuota } from "../../lib/controleParental/phrases";

/**
 * Internet aujourd'hui (rapport NextDNS) : les sites les plus visités, ceux qui
 * ont été bloqués, et le quota gratuit du mois. Un site s'autorise ou se bloque
 * d'un toucher. Rien n'apparaît tant que le filtre n'est pas relié.
 */
export default function InternetDuJour({
  appareilId,
  rapport,
  maintenant,
}: {
  appareilId: string;
  rapport: RapportNextdns | null;
  maintenant: Date;
}) {
  const [enCours, setEnCours] = useState<string | null>(null);
  if (!rapport) return null;
  const duJour = rapport.jour === jourLocal(maintenant);
  const quota = phraseQuota(rapport);

  const agir = (s: SiteDuJour, action: "bloquer" | "autoriser") => {
    setEnCours(s.domaine);
    void changerSite(
      appareilId,
      action === "bloquer" ? ACTION_NEXTDNS.bloquer : ACTION_NEXTDNS.debloquer,
      s.domaine,
      action === "bloquer" ? `${s.domaine} est bloqué` : `${s.domaine} est autorisé`,
    ).finally(() => setEnCours(null));
  };

  const liste = (titre: string, sites: SiteDuJour[], action: "bloquer" | "autoriser", vide: string) => (
    <div>
      <h3 className="text-base text-cream-mute mb-1">{titre}</h3>
      {sites.length === 0 ? (
        <p className="text-base text-cream-mute">{vide}</p>
      ) : (
        <ul className="flex flex-col">
          {sites.map((s) => (
            <li key={s.domaine} className="flex items-center justify-between gap-2 min-h-12">
              <span className="min-w-0 truncate text-base text-cream">{s.domaine}</span>
              <button
                type="button"
                disabled={enCours === s.domaine}
                onClick={() => agir(s, action)}
                className="shrink-0 min-h-12 rounded-xl px-4 text-base text-cream bg-ebony-ridge border border-hairline disabled:opacity-40"
              >
                {action === "bloquer" ? "Bloquer" : "Autoriser"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section aria-labelledby="internet" className="rounded-2xl bg-ebony-card border border-hairline p-4 flex flex-col gap-4">
      <h2 id="internet" className="text-lg font-semibold text-cream">Internet aujourd'hui</h2>
      {quota.alerte && (
        <p role="alert" className="flex gap-2 rounded-xl border border-copper p-3 text-base text-cream">
          <AlertTriangle size={20} aria-hidden="true" className="shrink-0 mt-0.5 text-copper" />
          {quota.texte}
        </p>
      )}
      {liste("Sites bloqués", duJour ? rapport.bloques : [], "autoriser", "Aucun site bloqué aujourd'hui.")}
      {liste("Sites les plus visités", duJour ? rapport.visites.slice(0, 8) : [], "bloquer", "Pas encore de visite aujourd'hui.")}
      {!quota.alerte && <p className="text-[15px] text-cream-mute">{quota.texte}</p>}
    </section>
  );
}
