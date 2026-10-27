import { Bell, BellOff } from "lucide-react";
import { refuser } from "../../lib/controleParental/envoyer";
import { useNotificationsDemandes, type EtatNotifications } from "../../lib/controleParental/notifications";

const PHRASE: Record<EtatNotifications, string> = {
  verification: "…",
  indisponible:
    "Cet appareil ne sait pas recevoir de notification ici. Sur le téléphone, ouvre Family Hub depuis son icône sur l'écran d'accueil.",
  bloquees:
    "Les notifications de Family Hub sont bloquées sur cet appareil : autorise-les dans les réglages du téléphone (ou du navigateur), puis reviens ici.",
  inactives: "Cet appareil ne sonne pas quand une demande arrive.",
  actives: "Cet appareil sonne à chaque demande.",
};

/** Un interrupteur par appareil : chaque parent active les téléphones et ordinateurs qui doivent sonner. */
export default function PrevenirDemandes({ appareilId, uid }: { appareilId: string; uid: string }) {
  const { etat, occupe, activer, desactiver } = useNotificationsDemandes(appareilId, uid);
  const actives = etat === "actives";
  const possible = etat === "actives" || etat === "inactives";
  const basculer = () =>
    (actives ? desactiver() : activer()).catch((e: unknown) => {
      console.error(e);
      refuser("Ça n'a pas marché. Réessaie dans un instant.");
    });

  return (
    <section aria-labelledby="prevenir" className="rounded-2xl bg-ebony-card border border-hairline px-4 py-3 flex items-center gap-3">
      {actives ? (
        <Bell size={22} aria-hidden="true" className="shrink-0 text-brass" />
      ) : (
        <BellOff size={22} aria-hidden="true" className="shrink-0 text-cream-mute" />
      )}
      <span className="flex-1 min-w-0 flex flex-col">
        <span id="prevenir" className="text-[17px] font-semibold text-cream">
          Me prévenir des demandes
        </span>
        <span className="text-[15px] text-cream-mute">{PHRASE[etat]}</span>
      </span>
      {possible && (
        <button
          type="button"
          role="switch"
          aria-checked={actives}
          aria-labelledby="prevenir"
          disabled={occupe}
          onClick={basculer}
          className={
            "shrink-0 relative h-8 w-14 rounded-full border transition-colors disabled:opacity-60 " +
            (actives ? "bg-brass border-brass" : "bg-ebony border-hairline")
          }
        >
          <span
            aria-hidden="true"
            className={
              "absolute top-1 h-6 w-6 rounded-full transition-[left] " +
              (actives ? "left-7 bg-ebony" : "left-1 bg-cream-mute")
            }
          />
        </button>
      )}
    </section>
  );
}
