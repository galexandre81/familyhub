import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";

/**
 * Émulateurs locaux (`VITE_EMULATEURS=1 npm run dev:hub`) : développement
 * seulement — `import.meta.env.DEV` est faux au build, Vite retire ce code de
 * la production. Le projet est forcé à « demo-fh » : un projet `demo-`
 * n'existe pas chez Google, une session d'essai ne peut donc jamais écrire
 * dans la vraie base. Voir docs/controle-parental/SIMULATEUR.md.
 */
const EMULATEURS = import.meta.env.DEV && import.meta.env.VITE_EMULATEURS === "1";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: EMULATEURS ? "demo-fh" : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
// Cache local persistant (IndexedDB) : les données déjà vues restent lisibles
// hors ligne, et les écritures faites sans réseau partent au retour de la
// connexion. Partagé entre plusieurs onglets ouverts.
// initializeFirestore ne peut être appelé qu'une fois par app (sinon il lève
// une erreur, par ex. lors d'un rechargement à chaud) : on retombe alors sur
// l'instance déjà créée.
function creerFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}
export const db: Firestore = creerFirestore();
export const functions: Functions = getFunctions(app, "europe-west1");

if (EMULATEURS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });
