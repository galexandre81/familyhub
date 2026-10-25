import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useInvitationEnAttente } from "../lib/invitationContext";

/**
 * Résultat de l'invitation gardée (« Bienvenue dans le foyer … » ou le motif
 * du refus), sur l'accueil PC comme sur « Aujourd'hui » au téléphone.
 * Ne rend rien tant qu'il n'y a pas de résultat.
 */
export default function ResultatInvitation({ telephone = false }: { telephone?: boolean }) {
  const invitation = useInvitationEnAttente();
  if (!invitation.resultat) return null;
  const { ok, message } = invitation.resultat;
  const Icone = ok ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={ok ? "status" : "alert"}
      className={
        telephone
          ? "rounded-xl bg-ebony-card border border-hairline px-4 py-2 flex items-center gap-3 text-base text-cream"
          : "tile-card flex items-center gap-3 text-base"
      }
    >
      <Icone aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" />
      <span className={telephone ? "flex-1" : "flex-1 text-ink"}>{message}</span>
      <button
        type="button"
        onClick={invitation.fermer}
        className={
          telephone
            ? "min-h-12 inline-flex items-center gap-2 rounded-xl px-3 -mr-2 text-cream"
            : "btn-secondary inline-flex min-h-[48px] items-center gap-2"
        }
      >
        <X aria-hidden="true" className="h-4 w-4" />
        Fermer
      </button>
    </div>
  );
}
