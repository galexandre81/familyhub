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
import {
  estRefusDefinitif,
  messageBienvenue,
  messageErreurInvitation,
  MESSAGE_INVITATION_EN_ATTENTE,
} from "./invitations";

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
 * `/rejoindre/:code` (avant ou après la connexion Google). Le code n'est
 * oublié qu'en cas de succès ou de refus définitif (raison renvoyée par le
 * serveur) ; sur une panne réseau il est gardé et réessayé au retour de la
 * connexion (événement `online`) ou à la prochaine ouverture.
 */
export function InvitationEnAttenteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const accepter = useAcceptInvitation();
  const [code, setCode] = useState(() => lireInvitationEnAttente());
  const [enCours, setEnCours] = useState(code !== null);
  const [resultat, setResultat] = useState<ResultatInvitation | null>(null);
  const [essai, setEssai] = useState(0);
  const lance = useRef<number | null>(null);
  const { mutateAsync } = accepter;

  useEffect(() => {
    if (!user || !code || lance.current === essai) return;
    lance.current = essai;
    setEnCours(true);
    mutateAsync({ code, uid: user.uid })
      .then((r) => {
        oublierInvitationEnAttente();
        setCode(null);
        setResultat({ ok: true, message: messageBienvenue(r.nom) });
      })
      .catch((err: unknown) => {
        if (estRefusDefinitif(err)) {
          oublierInvitationEnAttente();
          setCode(null);
          setResultat({ ok: false, message: messageErreurInvitation(err) });
        } else {
          setResultat({ ok: false, message: MESSAGE_INVITATION_EN_ATTENTE });
        }
      })
      .finally(() => setEnCours(false));
  }, [user, code, essai, mutateAsync]);

  // Code gardé après une panne : nouvel essai quand la connexion revient.
  useEffect(() => {
    if (!code) return;
    const auRetour = () => setEssai((n) => n + 1);
    window.addEventListener("online", auRetour);
    return () => window.removeEventListener("online", auRetour);
  }, [code]);

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
