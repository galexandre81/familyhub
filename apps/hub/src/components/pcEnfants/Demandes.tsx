import {
  ACTION_NEXTDNS,
  VALEUR,
  accepterDemande,
  refuserDemande,
  type ConfigAppareil,
  type Demande,
} from "@family-hub/controle-parental";
import { db } from "../../lib/firebase";
import { envoyer } from "../../lib/controleParental/envoyer";
import { changerSite } from "../../lib/controleParental/nextdns";
import { boutonOui, dureeDemandee, ilYA, titreDemande } from "../../lib/controleParental/phrases";

/**
 * Ce que l'enfant demande depuis le PC : un toucher pour répondre. Accepter
 * pose aussi l'effet (contrat § 8.4) : du temps, un mode pour la durée
 * demandée (il remplace la décision en cours), un site ouvert, une appli
 * autorisée. `par` est le nom montré à l'enfant (« Papa »).
 */
export default function Demandes({
  config,
  demandes,
  uid,
  par,
  nomAppli,
  maintenant,
}: {
  config: ConfigAppareil;
  demandes: Demande[];
  uid: string;
  par: string;
  nomAppli: (id: string) => string;
  maintenant: Date;
}) {
  if (demandes.length === 0) return null;

  const accepter = (d: Demande) => {
    const avecDuree = d.type === VALEUR.typeDemande.temps || d.type === VALEUR.typeDemande.mode;
    const jusqua = avecDuree ? new Date(Date.now() + dureeDemandee(d) * 60_000) : null;
    envoyer(accepterDemande(db, config, d, { jusqua, par, uid }), `Accepté : ${titreDemande(d, nomAppli).toLowerCase()}`);
    // Un site demandé vient presque toujours d'un blocage : ouvert aussi par le filtre internet.
    if (d.type === VALEUR.typeDemande.site && d.detail) {
      void changerSite(config.id, ACTION_NEXTDNS.debloquer, d.detail, `${d.detail} est autorisé sur internet`);
    }
  };
  const refuser = (d: Demande) =>
    envoyer(refuserDemande(db, config.id, d.id, uid), `Refusé : ${titreDemande(d, nomAppli).toLowerCase()}`);

  return (
    <section aria-labelledby="demandes" className="rounded-2xl bg-ebony-card border-2 border-brass p-4 flex flex-col gap-4">
      <h2 id="demandes" className="text-lg font-semibold text-cream">
        {demandes.length === 1 ? "Une demande" : `${demandes.length} demandes`}
      </h2>
      <ul className="flex flex-col gap-5">
        {demandes.map((d) => (
          <li key={d.id} className="flex flex-col gap-3">
            <p className="text-[17px] leading-snug break-words">
              <strong className="text-cream">{titreDemande(d, nomAppli)}</strong>
              <br />
              <span className="text-cream-mute">
                {d.message && `« ${d.message} » · `}
                {ilYA(d.creeeLe, maintenant)}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => accepter(d)}
                className="min-h-12 rounded-xl px-3 text-base font-semibold bg-brass text-ebony"
              >
                {boutonOui(d)}
              </button>
              <button
                type="button"
                onClick={() => refuser(d)}
                className="min-h-12 rounded-xl px-3 text-base text-cream bg-ebony-ridge"
              >
                Non
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
