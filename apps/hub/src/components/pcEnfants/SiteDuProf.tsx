import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ACTION_NEXTDNS,
  ajouterSiteEcole,
  normaliserDomaine,
  retirerSiteEcole,
  type ConfigAppareil,
} from "@family-hub/controle-parental";
import { db } from "../../lib/firebase";
import { envoyer, refuser } from "../../lib/controleParental/envoyer";
import { changerSite } from "../../lib/controleParental/nextdns";
import LigneRepliee from "./LigneRepliee";

/** « Le prof demande ce site » : on colle l'adresse telle quelle, le hub garde le nom du site. */
export default function SiteDuProf({ config, uid }: { config: ConfigAppareil; uid: string }) {
  const [saisie, setSaisie] = useState("");
  const domaine = saisie.trim() ? normaliserDomaine(saisie) : null;
  const dejaLa = !!domaine && config.listeEcole.includes(domaine);

  const ajouter = () => {
    if (!domaine) return refuser("Cette adresse n'est pas lisible. Copie-la depuis le message du prof.");
    if (dejaLa) return refuser(`${domaine} est déjà dans la liste.`);
    // Un toucher : ajouté aux sites de l'école ET autorisé par le filtre internet le reste du temps.
    envoyer(ajouterSiteEcole(db, config.id, domaine, uid), `Ajouté : ${domaine}`);
    void changerSite(config.id, ACTION_NEXTDNS.debloquer, domaine, `${domaine} est autorisé sur internet`);
    setSaisie("");
  };

  return (
    <LigneRepliee titre="Le prof demande un site" resume="Coller une adresse">
      <p className="text-[15px] text-cream-mute">Il sera ouvert dans tous les modes, Devoirs compris.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ajouter();
        }}
      >
        <input
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Colle l'adresse ici"
          aria-label="Adresse du site"
          className="flex-1 min-w-0 min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream"
        />
        <button
          type="submit"
          disabled={!domaine || dejaLa}
          className="min-h-12 min-w-12 inline-flex items-center justify-center gap-1 rounded-xl px-4 text-base font-semibold bg-brass text-ebony disabled:opacity-40"
        >
          <Plus size={20} aria-hidden="true" />
          Ajouter
        </button>
      </form>
      {saisie.trim() && (
        <p className="text-[15px] text-cream-mute" aria-live="polite">
          {domaine ? (dejaLa ? `${domaine} est déjà dans la liste` : `Sera ajouté : ${domaine}`) : "Adresse pas encore lisible"}
        </p>
      )}
      {config.listeEcole.length > 0 && (
        <details className="group">
          <summary className="min-h-12 flex items-center text-base text-cream-mute cursor-pointer">
            Sites de l'école ({config.listeEcole.length})
          </summary>
          <ul className="flex flex-col gap-1">
            {config.listeEcole.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 text-base text-cream">
                <span className="truncate">{d}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Retirer ${d} des sites de l'école ?`)) {
                      envoyer(retirerSiteEcole(db, config.id, d, uid), `Retiré : ${d}`);
                    }
                  }}
                  className="min-h-12 min-w-12 inline-flex items-center justify-center text-cream-mute"
                  aria-label={`Retirer ${d}`}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </LigneRepliee>
  );
}
