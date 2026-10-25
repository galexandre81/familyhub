import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { doitUtiliserRedirection } from "./authMode";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Message à afficher si la dernière connexion a échoué, sinon null. */
  erreur: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const MESSAGE_ECHEC = "La connexion n'a pas abouti — réessaie.";

/** Fermer soi-même la fenêtre Google n'est pas une erreur à signaler. */
function estAnnulation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Crée ou met à jour le document users/{uid} à chaque connexion. */
function enregistrerUtilisateur(u: User): void {
  void setDoc(
    doc(db, `users/${u.uid}`),
    {
      uid: u.uid,
      email: u.email ?? "",
      displayName: u.displayName ?? "",
      photoURL: u.photoURL ?? "",
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function estAppInstallee(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches;
}

function utiliserRedirection(): boolean {
  return doitUtiliserRedirection(
    estAppInstallee(),
    auth.config.authDomain ?? "",
    window.location.hostname,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    // Retour d'une connexion par redirection (app installée, iPhone/iPad) :
    // on finalise le résultat ; onAuthStateChanged ci-dessous reçoit alors
    // l'utilisateur et écrit users/{uid} comme pour la fenêtre surgissante.
    getRedirectResult(auth).catch((err: unknown) => {
      console.error("[auth] échec de la connexion par redirection", err);
      setErreur(MESSAGE_ECHEC);
    });

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) enregistrerUtilisateur(u);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    erreur,
    signIn: async () => {
      setErreur(null);
      try {
        if (utiliserRedirection()) {
          await signInWithRedirect(auth, googleProvider);
        } else {
          await signInWithPopup(auth, googleProvider);
        }
      } catch (err) {
        if (estAnnulation(err)) return;
        console.error("[auth] échec de la connexion", err);
        setErreur(MESSAGE_ECHEC);
      }
    },
    signOut: async () => {
      await firebaseSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
