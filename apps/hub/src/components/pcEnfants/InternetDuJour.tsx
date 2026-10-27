import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ACTION_NEXTDNS, jourLocal, type RapportNextdns, type SiteDuJour } from "@family-hub/controle-parental";
import { changerSite } from "../../lib/controleParental/nextdns";
import { phraseQuota, resumeInternet } from "../../lib/controleParental/phrases";
import LigneRepliee from "./LigneRepliee";

/**
 * Internet aujourd'hui (rapport NextDNS) : les sites les plus visités, ceux qui
 * ont été bloqués, et le quota gratuit du mois. Un site s'autorise ou se bloque
 * d'un toucher. Ligne repliée (maquette A) ; l'alerte de quota reste dehors.
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
  if (!rapport) {
    return (
      <LigneRepliee titre="Internet aujourd'hui" resume={resumeInternet(rapport, maintenant)}>
        <p className="text-base text-cream-mute">Le filtre internet n'est pas encore relié à Family Hub.</p>
      </LigneRepliee>
    );
  }
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

  // L'alerte de quota reste visible ligne fermée : au-delà de la limite, plus rien n'est filtré.
  return (
    <>
      {quota.alerte && (
        <p role="alert" className="flex gap-2 rounded-xl border border-copper p-3 text-base text-cream">
          <AlertTriangle size={20} aria-hidden="true" className="shrink-0 mt-0.5 text-copper" />
          {quota.texte}
        </p>
      )}
      <LigneRepliee titre="Internet aujourd'hui" resume={resumeInternet(rapport, maintenant)}>
        {liste("Sites bloqués", duJour ? rapport.bloques : [], "autoriser", "Aucun site bloqué aujourd'hui.")}
        {liste("Sites les plus visités", duJour ? rapport.visites.slice(0, 8) : [], "bloquer", "Pas encore de visite aujourd'hui.")}
        {!quota.alerte && <p className="text-[15px] text-cream-mute">{quota.texte}</p>}
      </LigneRepliee>
    </>
  );
}
