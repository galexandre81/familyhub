import { Check, Clock, Globe, AppWindow, X } from "lucide-react";
import {
  VALEUR,
  accepterDemande,
  refuserDemande,
  type ConfigAppareil,
  type Demande,
} from "@family-hub/controle-parental";
import { db } from "../../lib/firebase";
import { envoyer } from "../../lib/controleParental/envoyer";
import { ilYA, titreDemande } from "../../lib/controleParental/phrases";

const ICONE = {
  [VALEUR.typeDemande.temps]: Clock,
  [VALEUR.typeDemande.site]: Globe,
  [VALEUR.typeDemande.appli]: AppWindow,
};

/** « Plus de temps » s'accepte en un geste : la durée est le bouton. */
const DUREES = [
  { libelle: "+30 min", minutes: 30 },
  { libelle: "+1 h", minutes: 60 },
];

export default function Demandes({
  config,
  demandes,
  uid,
  maintenant,
}: {
  config: ConfigAppareil;
  demandes: Demande[];
  uid: string;
  maintenant: Date;
}) {
  if (demandes.length === 0) return null;
  const nomAppli = (id: string) => config.applis[id]?.nom ?? id;

  const accepter = (d: Demande, minutes: number | null) => {
    const jusqua = minutes ? new Date(Date.now() + minutes * 60_000) : null;
    envoyer(accepterDemande(db, config, d, jusqua, uid), `Accepté : ${titreDemande(d, nomAppli).toLowerCase()}`);
  };
  const refuserLa = (d: Demande) =>
    envoyer(refuserDemande(db, config.id, d.id, uid), `Refusé : ${titreDemande(d, nomAppli).toLowerCase()}`);

  return (
    <section aria-labelledby="demandes" className="flex flex-col gap-2">
      <h2 id="demandes" className="text-lg font-semibold text-cream">
        {demandes.length === 1 ? "Une demande" : `${demandes.length} demandes`} en attente
      </h2>
      <ul className="flex flex-col gap-3">
        {demandes.map((d) => {
          const Icone = ICONE[d.type];
          return (
            <li key={d.id} className="rounded-2xl bg-ebony-card border border-brass/60 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Icone size={22} aria-hidden="true" className="shrink-0 mt-0.5 text-brass" />
                <div className="min-w-0">
                  <p className="text-lg text-cream leading-snug break-words">{titreDemande(d, nomAppli)}</p>
                  {d.message && <p className="text-base text-cream-mute break-words">« {d.message} »</p>}
                  <p className="text-[15px] text-cream-mute">{ilYA(d.creeeLe, maintenant)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.type === VALEUR.typeDemande.temps ? (
                  DUREES.map((x) => (
                    <button
                      key={x.minutes}
                      type="button"
                      onClick={() => accepter(d, x.minutes)}
                      className="min-h-12 flex-1 rounded-xl px-4 text-base font-semibold bg-brass text-ebony"
                    >
                      {x.libelle}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => accepter(d, null)}
                    className="min-h-12 flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold bg-brass text-ebony"
                  >
                    <Check size={20} aria-hidden="true" />
                    Accepter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => refuserLa(d)}
                  className="min-h-12 flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base text-cream bg-ebony-ridge border border-hairline"
                >
                  <X size={20} aria-hidden="true" />
                  Refuser
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
