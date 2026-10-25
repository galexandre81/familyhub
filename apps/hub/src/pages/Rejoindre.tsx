import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { garderInvitationEnAttente } from "../lib/invitationEnAttente";
import { normaliserCodeInvitation } from "../lib/invitations";

/**
 * `/rejoindre/:code` — hors RequireAuth. Garde le code puis envoie vers
 * l'accueil : sans compte, RequireAuth passe par /login ; une fois connecté,
 * InvitationEnAttenteProvider accepte l'invitation.
 */
export default function Rejoindre() {
  const { code: brut } = useParams();
  const code = normaliserCodeInvitation(brut);
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) return;
    garderInvitationEnAttente(code);
    navigate("/", { replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        {code ? (
          <p className="text-cream-mute text-base">Ouverture de l'invitation…</p>
        ) : (
          <>
            <p role="alert" className="flex items-center justify-center gap-2 text-cream text-base">
              <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" />
              <span>Invitation introuvable</span>
            </p>
            <Link to="/" className="btn-secondary inline-flex min-h-[48px] items-center">
              Aller à l'accueil
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
