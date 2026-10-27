import { useState } from "react";
import { X } from "lucide-react";
import { ACTION_NEXTDNS, normaliserDomaine, type RapportNextdns } from "@family-hub/controle-parental";
import { changerSite } from "../../lib/controleParental/nextdns";
import { refuser } from "../../lib/controleParental/envoyer";

const CHAMP = "min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream";

/** Réglages : les sites toujours bloqués et toujours autorisés (listes du filtre internet). */
export default function ListesDeSites({ appareilId, rapport }: { appareilId: string; rapport: RapportNextdns | null }) {
  const [saisie, setSaisie] = useState("");
  const domaine = saisie.trim() ? normaliserDomaine(saisie) : null;
  if (!rapport) {
    return <p className="text-base text-cream-mute">Le filtre internet n'est pas encore relié à Family Hub.</p>;
  }

  const retirer = (d: string) => {
    if (window.confirm(`Retirer ${d} de la liste ? Il suivra de nouveau les règles du filtre.`)) {
      void changerSite(appareilId, ACTION_NEXTDNS.retirer, d, `${d} retiré de la liste`);
    }
  };
  const liste = (titre: string, sites: string[]) => (
    <div>
      <h3 className="text-base text-cream-mute">{titre}</h3>
      {sites.length === 0 ? (
        <p className="text-base text-cream-mute">Aucun.</p>
      ) : (
        <ul>
          {sites.map((d) => (
            <li key={d} className="flex items-center justify-between gap-2 text-base text-cream">
              <span className="truncate">{d}</span>
              <button
                type="button"
                onClick={() => retirer(d)}
                className="min-h-12 min-w-12 inline-flex items-center justify-center text-cream-mute"
                aria-label={`Retirer ${d}`}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!domaine) return refuser("Cette adresse n'est pas lisible.");
          void changerSite(appareilId, ACTION_NEXTDNS.bloquer, domaine, `${domaine} est bloqué`).then((ok) => ok && setSaisie(""));
        }}
      >
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Bloquer un site : colle l'adresse"
          aria-label="Site à bloquer"
          autoCapitalize="none"
          className={`${CHAMP} flex-1 min-w-0`}
        />
        <button type="submit" disabled={!domaine} className="min-h-12 rounded-xl px-4 text-base font-semibold bg-brass text-ebony disabled:opacity-40">
          Bloquer
        </button>
      </form>
      {liste("Toujours bloqués", rapport.toujoursBloques)}
      {liste("Toujours autorisés", rapport.toujoursAutorises)}
    </div>
  );
}
