import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { useAcceptInvitation } from "./mutations";
import { lireInvitationEnAttente, oublierInvitationEnAttente } from "./invitationEnAttente";
import { messageBienvenue, messageErreurInvitation } from "./invitations";

export interface ResultatInvitation {
  ok: boolean;
  message: string;
}

interface InvitationContextValue {
  /** Une invitation est en cours de traitement : ne pas proposer « Créer mon foyer ». */
  enCours: boolean;
  resultat: ResultatInvitation | null;
  fermer: () => void;
}

const InvitationContext = createContext<InvitationContextValue>({
  enCours: false,
  resultat: null,
  fermer: () => {},
});

/**
 * Traite, dès l'arrivée dans l'arbre connecté, l'invitation gardée par
 * `/rejoindre/:code` (avant ou après la connexion Google), puis l'oublie.
 */
export function InvitationEnAttenteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const accepter = useAcceptInvitation();
  const [code] = useState(() => lireInvitationEnAttente());
  const [enCours, setEnCours] = useState(code !== null);
  const [resultat, setResultat] = useState<ResultatInvitation | null>(null);
  const lance = useRef(false);
  const { mutateAsync } = accepter;

  useEffect(() => {
    if (!user || !code || lance.current) return;
    lance.current = true;
    mutateAsync({ code, uid: user.uid })
      .then((r) => setResultat({ ok: true, message: messageBienvenue(r.nom) }))
      .catch((err: unknown) => setResultat({ ok: false, message: messageErreurInvitation(err) }))
      .finally(() => {
        oublierInvitationEnAttente();
        setEnCours(false);
      });
  }, [user, code, mutateAsync]);

  const fermer = useCallback(() => setResultat(null), []);

  return (
    <InvitationContext.Provider value={{ enCours, resultat, fermer }}>
      {children}
    </InvitationContext.Provider>
  );
}

export function useInvitationEnAttente(): InvitationContextValue {
  return useContext(InvitationContext);
}
