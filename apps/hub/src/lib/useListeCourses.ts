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
 * Migration (ancien tableau `items` → documents) : une TRANSACTION (ce n'est
 * pas une des actions des courses ; elle ne marche qu'en ligne, voulu) qui
 * relit la liste sur le serveur, abandonne si elle est déjà en `format: 2`
 * (ou sans tableau), sinon pose chaque article à un id déterministe (= ancien
 * `item.id`) et passe la liste en `format: 2` sans le tableau. Deux appareils
 * qui migrent ensemble : le second voit `format: 2` et n'écrit rien — aucune
 * coche faite entre-temps n'est écrasée. Hors ligne, la transaction échoue
 * au lieu de mettre en file une écriture périmée.
 * Optimisation : on ne tente la migration qu'à partir d'un instantané confirmé
 * par le serveur (`!metadata.fromCache`). Tant que la liste n'est pas migrée,
 * les articles sont affichés depuis le tableau (lecture seule) et les actions
 * demandent de se reconnecter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
  /**
   * Article « placard » : drapeau stocké OU nom reconnu par la liste du foyer
   * (calculé à la lecture, pour les listes déjà migrées). À passer à `vueTri`.
   */
  estPlacardArticle(article: ArticleCourses): boolean;
}

export interface ListeCoursesOptions {
  /**
   * Produit de placard (selon la liste du foyer) ? Utilisé à la migration et
   * à la lecture. Par défaut aucun.
   */
  estPlacard?: (nom: string) => boolean;
}

/** Une transaction est limitée à 500 écritures : au-delà on ne migre pas (irréaliste). */
const MAX_ARTICLES_MIGRATION = 450;
const AUCUN_PLACARD = () => false;

function signalerErreur(err: unknown, message: string): void {
  const code = (err as { code?: string } | null)?.code;
  // Déjà supprimé par un autre appareil : rien à dire.
  if (code === "not-found") return;
  console.error("[courses]", err);
  toast(message, { type: "error" });
}

/** Action refusée tant que la liste n'est pas passée au format 2. */
function signalerMigrationEnCours(): void {
  toast("La liste se met à jour : reconnecte-toi un instant, puis réessaie.", { type: "info" });
}

function colListes(householdId: string) {
  return collection(db, "households", householdId, "shoppingLists");
}

function colArticles(householdId: string, listId: string) {
  return collection(db, "households", householdId, "shoppingLists", listId, "items");
}

/**
 * Migre la liste en une transaction (relit le document sur le serveur).
 * Sans effet si la liste est déjà migrée. Rejette hors ligne.
 */
function lancerMigration(
  householdId: string,
  listId: string,
  estPlacard: (nom: string) => boolean,
): Promise<void> {
  const listeRef = doc(colListes(householdId), listId);
  const col = colArticles(householdId, listId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(listeRef);
    if (!snap.exists()) return;
    const data = snap.data() as ShoppingList;
    if (!doitMigrer(data)) return;
    const articles = migrerArticles(data.items ?? [], estPlacard);
    if (articles.length > MAX_ARTICLES_MIGRATION) {
      console.warn(`[courses] migration refusée : ${articles.length} articles (max ${MAX_ARTICLES_MIGRATION})`);
      return;
    }
    for (const { id, data: article } of articles) tx.set(doc(col, id), article);
    tx.update(listeRef, { format: 2, items: deleteField(), updatedAt: serverTimestamp() });
  });
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
    lancerMigration(householdId, liste.id, estPlacardRef.current).catch((err) => {
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
        signalerMigrationEnCours();
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
        signalerMigrationEnCours();
        return;
      }
      const ref = doc(colArticles(householdId, listId));
      setDoc(ref, { ...articleOubli(nom, prochainOrdre(docsArticles)), createdAt: serverTimestamp() }).catch(
        (err) => signalerErreur(err, "L'article n'a pas pu être ajouté."),
      );
    },
    [householdId, planId, listId, aMigrer, docsArticles],
  );

  const supprimer = useCallback(
    (id: string) => {
      const ref = refArticle(id);
      if (!ref) return;
      deleteDoc(ref).catch((err) => signalerErreur(err, "L'article n'a pas pu être retiré."));
    },
    [refArticle],
  );

  const estPlacardArticle = useCallback(
    (article: ArticleCourses) => article.placard === true || estPlacardRef.current(article.nom),
    [],
  );

  return { liste, articles, chargement, trier, cocher, ajouterOubli, supprimer, estPlacardArticle };
}
