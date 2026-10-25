/**
 * Liste de courses du plan, format 2 (un document par article) : abonnement
 * temps réel, migration de l'ancien format et actions.
 *
 * Lecture : `onSnapshot` sur la liste du plan (`where planId ==`) puis sur sa
 * sous-collection `items`. Le cache Firestore persistant (lib/firebase.ts)
 * rend la liste lisible et modifiable hors ligne.
 *
 * Écritures : jamais d'attente de l'accusé du serveur (la promesse ne se
 * résout pas hors ligne) — Firestore applique l'écriture au cache local tout
 * de suite et l'abonnement l'affiche. Une erreur éventuelle arrive en toast.
 * Pas de transaction : chaque action ne touche que les champs de SON article,
 * deux téléphones qui cochent des articles différents ne s'écrasent pas.
 *
 * Migration (ancien tableau `items` → documents) : un `writeBatch` qui pose
 * chaque article à un id déterministe (= ancien `item.id`, mêmes données),
 * puis passe la liste en `format: 2` et retire le tableau. Deux appareils qui
 * migrent ensemble écrivent la même chose : ni doublon ni perte.
 * Décision : on ne migre qu'à partir d'un instantané CONFIRMÉ par le serveur
 * (`!metadata.fromCache`). Un appareil resté longtemps hors ligne avec
 * l'ancien format en cache pourrait sinon, au retour du réseau, ré-écrire les
 * articles « non cochés » par-dessus des coches faites entre-temps ailleurs.
 * Tant que la liste n'est pas migrée, les articles sont affichés depuis le
 * tableau (lecture seule) et les actions demandent de se reconnecter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { ArticleCourses, DestinationArticle, ShoppingList } from "@family-hub/types";
import { db } from "./firebase";
import { useAuth } from "./auth";
import { toast } from "../components/Toast";
import {
  articleOubli,
  doitMigrer,
  migrerArticles,
  patchCoche,
  prochainOrdre,
  type ArticleAvecId,
} from "./listeCourses";

export type ListeCoursesAvecId = ShoppingList & { id: string };

export interface ListeCoursesApi {
  liste?: ListeCoursesAvecId;
  articles: ArticleAvecId[];
  chargement: boolean;
  trier(id: string, destination: DestinationArticle): void;
  cocher(id: string, coche: boolean): void;
  ajouterOubli(nom: string): void;
  supprimer(id: string): void;
}

export interface ListeCoursesOptions {
  /**
   * Produit de placard ? Utilisé à la migration. Par défaut aucun (la vraie
   * liste du foyer arrive avec les produits de placard).
   */
  estPlacard?: (nom: string) => boolean;
}

/** Au-delà de 500 écritures, un batch Firestore est refusé. */
const TAILLE_BATCH = 450;
const AUCUN_PLACARD = () => false;

function signalerErreur(err: unknown, message: string): void {
  const code = (err as { code?: string } | null)?.code;
  // Déjà supprimé par un autre appareil : rien à dire.
  if (code === "not-found") return;
  console.error("[courses]", err);
  toast(message, { type: "error" });
}

function colListes(householdId: string) {
  return collection(db, "households", householdId, "shoppingLists");
}

function colArticles(householdId: string, listId: string) {
  return collection(db, "households", householdId, "shoppingLists", listId, "items");
}

/** Écrit la migration sans l'attendre. Rejette si l'un des lots échoue. */
function lancerMigration(
  householdId: string,
  liste: ListeCoursesAvecId,
  estPlacard: (nom: string) => boolean,
): Promise<void> {
  const articles = migrerArticles(liste.items ?? [], estPlacard);
  const col = colArticles(householdId, liste.id);
  const lots: Promise<void>[] = [];
  let batch = writeBatch(db);
  let taille = 0;
  for (const { id, data } of articles) {
    batch.set(doc(col, id), data);
    if (++taille >= TAILLE_BATCH) {
      lots.push(batch.commit());
      batch = writeBatch(db);
      taille = 0;
    }
  }
  // Dernier lot : la liste ne passe en format 2 qu'avec (ou après) ses articles.
  batch.update(doc(colListes(householdId), liste.id), {
    format: 2,
    items: deleteField(),
    updatedAt: serverTimestamp(),
  });
  lots.push(batch.commit());
  return Promise.all(lots).then(() => undefined);
}

export function useListeCourses(
  householdId?: string,
  planId?: string,
  options: ListeCoursesOptions = {},
): ListeCoursesApi {
  const { user } = useAuth();
  const uid = user?.uid;

  const estPlacardRef = useRef(options.estPlacard ?? AUCUN_PLACARD);
  estPlacardRef.current = options.estPlacard ?? AUCUN_PLACARD;

  const [liste, setListe] = useState<ListeCoursesAvecId | undefined>(undefined);
  const [listeConfirmee, setListeConfirmee] = useState(false);
  const [listeChargee, setListeChargee] = useState(false);
  const [docsArticles, setDocsArticles] = useState<ArticleAvecId[]>([]);
  const [articlesCharges, setArticlesCharges] = useState(false);
  /** Listes dont la migration est déjà partie depuis cet appareil. */
  const migrees = useRef(new Set<string>());

  // Liste du plan.
  useEffect(() => {
    setListe(undefined);
    setListeConfirmee(false);
    setListeChargee(false);
    if (!householdId || !planId) {
      setListeChargee(true);
      return;
    }
    const desabonner = onSnapshot(
      query(colListes(householdId), where("planId", "==", planId)),
      // Métadonnées incluses : on veut savoir quand le serveur a confirmé.
      { includeMetadataChanges: true },
      (snap) => {
        const premier = snap.docs[0];
        setListe(premier ? { id: premier.id, ...(premier.data() as ShoppingList) } : undefined);
        setListeConfirmee(!snap.metadata.fromCache);
        setListeChargee(true);
      },
      (err) => {
        console.error("[courses] écoute de la liste", err);
        setListeChargee(true);
      },
    );
    return desabonner;
  }, [householdId, planId]);

  const listId = liste?.id;

  // Articles de la liste.
  useEffect(() => {
    setDocsArticles([]);
    setArticlesCharges(false);
    if (!householdId || !listId) return;
    const desabonner = onSnapshot(
      colArticles(householdId, listId),
      (snap) => {
        setDocsArticles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ArticleCourses) })));
        setArticlesCharges(true);
      },
      (err) => {
        console.error("[courses] écoute des articles", err);
        setArticlesCharges(true);
      },
    );
    return desabonner;
  }, [householdId, listId]);

  const aMigrer = !!liste && doitMigrer(liste);

  // Migration de l'ancien format, une fois par liste et par appareil.
  useEffect(() => {
    if (!householdId || !liste || !aMigrer || !listeConfirmee) return;
    if (migrees.current.has(liste.id)) return;
    migrees.current.add(liste.id);
    lancerMigration(householdId, liste, estPlacardRef.current).catch((err) => {
      migrees.current.delete(liste.id);
      signalerErreur(err, "La liste de courses n'a pas pu être mise à jour.");
    });
  }, [householdId, liste, aMigrer, listeConfirmee]);

  // Avant migration : articles lus dans l'ancien tableau (affichage seul).
  const articles = useMemo<ArticleAvecId[]>(() => {
    if (aMigrer && liste) {
      return migrerArticles(liste.items ?? [], estPlacardRef.current).map(({ id, data }) => ({
        id,
        ...data,
      }));
    }
    return docsArticles;
  }, [aMigrer, liste, docsArticles]);

  const chargement = !listeChargee || (!!liste && !aMigrer && !articlesCharges);

  /** Référence de l'article si la liste est prête à être modifiée, sinon null (avec message). */
  const refArticle = useCallback(
    (id: string) => {
      if (!householdId || !listId) return null;
      if (aMigrer) {
        toast("La liste se met à jour : reconnecte-toi un instant, puis réessaie.", { type: "info" });
        return null;
      }
      return doc(colArticles(householdId, listId), id);
    },
    [householdId, listId, aMigrer],
  );

  const trier = useCallback(
    (id: string, destination: DestinationArticle) => {
      const ref = refArticle(id);
      if (!ref) return;
      updateDoc(ref, { destination }).catch((err) =>
        signalerErreur(err, "Le tri n'a pas pu être enregistré."),
      );
    },
    [refArticle],
  );

  const cocher = useCallback(
    (id: string, coche: boolean) => {
      if (!uid) return;
      const ref = refArticle(id);
      if (!ref) return;
      updateDoc(ref, patchCoche(coche, uid, serverTimestamp())).catch((err) =>
        signalerErreur(err, "La coche n'a pas pu être enregistrée."),
      );
    },
    [refArticle, uid],
  );

  const ajouterOubli = useCallback(
    (nom: string) => {
      if (!nom.trim()) return;
      if (householdId && planId && !listId) {
        toast("Il n'y a pas encore de liste de courses pour cette semaine.", { type: "info" });
        return;
      }
      if (!householdId || !listId) return;
      if (aMigrer) {
        refArticle("_"); // affiche le message de mise à jour
        return;
      }
      const ref = doc(colArticles(householdId, listId));
      setDoc(ref, { ...articleOubli(nom, prochainOrdre(docsArticles)), createdAt: serverTimestamp() }).catch(
        (err) => signalerErreur(err, "L'article n'a pas pu être ajouté."),
      );
    },
    [householdId, planId, listId, aMigrer, refArticle, docsArticles],
  );

  const supprimer = useCallback(
    (id: string) => {
      const ref = refArticle(id);
      if (!ref) return;
      deleteDoc(ref).catch((err) => signalerErreur(err, "L'article n'a pas pu être retiré."));
    },
    [refArticle],
  );

  return { liste, articles, chargement, trier, cocher, ajouterOubli, supprimer };
}
