/**
 * Minuteurs partagés avec l'iPad cuisine : abonnement temps réel, actions,
 * passage à « terminé » et bip.
 *
 * Même cycle de vie que l'iPad (apps/display/public/js/timer-singleton.js) :
 * running → (paused ↔ running) → ended → acknowledged → supprimé ; « Arrêter »
 * supprime directement.
 *
 * Fin d'un minuteur : l'iPad et les téléphones peuvent atteindre zéro en même
 * temps. On ne passe à `ended` que si le document est encore `running`
 * (transaction). Une transaction échoue hors ligne : dans ce cas on sonne
 * quand même localement (estEnAlarme) et on ne réessaie qu'au retour du réseau
 * (événement `online`), une seule fois. Aucune erreur affichée pour ce cas.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { toast } from "../components/Toast";
import {
  ajoutUneMinute,
  estEnAlarme,
  estTermine,
  libelleParDefaut,
  tempsRestantMs,
  type Minuteur,
} from "./minuteurs";

export type { Minuteur } from "./minuteurs";

/* ------------------------------------------------------------------ */
/* Son : un seul AudioContext et une seule boucle pour toute la page.  */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;
let deverrouillageInstalle = false;
const demandesAlarme = new Set<symbol>();
let boucle: number | null = null;

function contexteAudio(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  return audioCtx;
}

/** Safari mobile n'autorise le son qu'après un geste : on ouvre le contexte au premier toucher. */
function installerDeverrouillage(): void {
  if (deverrouillageInstalle || typeof window === "undefined") return;
  deverrouillageInstalle = true;
  const deverrouiller = () => {
    const ctx = contexteAudio();
    if (!ctx) return;
    void ctx.resume().catch(() => {});
    try {
      // Tampon silencieux : finit de « débloquer » la sortie sur iOS.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* rien */
    }
    if (ctx.state === "running") {
      for (const ev of ["pointerdown", "touchend", "keydown"] as const) {
        window.removeEventListener(ev, deverrouiller, true);
      }
    }
  };
  for (const ev of ["pointerdown", "touchend", "keydown"] as const) {
    window.addEventListener(ev, deverrouiller, true);
  }
}

function bip(ctx: AudioContext, freq: number, debut: number, duree: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, debut);
  gain.gain.exponentialRampToValueAtTime(0.6, debut + 0.01);
  gain.gain.setValueAtTime(0.6, debut + duree - 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(debut);
  osc.stop(debut + duree + 0.05);
}

/** « Di-din » aigu, comme l'iPad. */
function jouerCycle(): void {
  const ctx = contexteAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  try {
    const t = ctx.currentTime;
    bip(ctx, 1320, t, 0.18);
    bip(ctx, 1760, t + 0.22, 0.22);
  } catch {
    /* rien */
  }
}

function majBoucle(): void {
  const doitSonner = demandesAlarme.size > 0 && document.visibilityState === "visible";
  if (doitSonner && boucle === null) {
    jouerCycle();
    boucle = window.setInterval(jouerCycle, 2000);
  } else if (!doitSonner && boucle !== null) {
    window.clearInterval(boucle);
    boucle = null;
  }
}

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

function colTimers(householdId: string) {
  return collection(db, "households", householdId, "timers");
}

function signalerErreur(err: unknown, message: string): void {
  const code = (err as { code?: string } | null)?.code;
  // Déjà supprimé par un autre appareil : rien à dire.
  if (code === "not-found") return;
  console.error("[minuteurs]", err);
  toast(message, { type: "error" });
}

/** Passe à `ended` seulement si le document est encore `running` et à zéro. Erreurs ignorées. */
async function marquerTermine(householdId: string, id: string): Promise<void> {
  const ref = doc(db, "households", householdId, "timers", id);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Minuteur;
      if (data.status !== "running" || !estTermine(data, Date.now())) return;
      tx.update(ref, { status: "ended", updatedAt: serverTimestamp() });
    });
  } catch {
    /* hors ligne, déjà modifié ou supprimé : un autre appareil (ou le retour du réseau) s'en charge */
  }
}

const DELAIS_REABONNEMENT_MS = [5_000, 15_000, 60_000, 300_000];

export interface MinuteursApi {
  minuteurs: Minuteur[];
  /** Heure locale (ms), rafraîchie chaque seconde tant qu'il y a des minuteurs. */
  nowMs: number;
  lancer(label: string | null, secondes: number): Promise<void>;
  ajouterUneMinute(m: Minuteur): Promise<void>;
  pause(m: Minuteur): Promise<void>;
  reprendre(m: Minuteur): Promise<void>;
  arreter(m: Minuteur): Promise<void>;
  acquitter(m: Minuteur): Promise<void>;
}

export function useMinuteurs(householdId?: string): MinuteursApi {
  const [minuteurs, setMinuteurs] = useState<Minuteur[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** Minuteurs pour lesquels on a déjà tenté le passage à `ended` depuis cet appareil. */
  const tentes = useRef(new Set<string>());

  // Abonnement temps réel, trié par fin, avec ré-abonnement si le flux s'arrête.
  useEffect(() => {
    setMinuteurs([]);
    if (!householdId) return;
    let annule = false;
    let desabonner: (() => void) | null = null;
    let relance: number | null = null;
    let essai = 0;
    const abonner = () => {
      desabonner = onSnapshot(
        query(colTimers(householdId), orderBy("endsAt", "asc")),
        (snap) => {
          essai = 0;
          setMinuteurs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Minuteur, "id">) })));
        },
        (err) => {
          console.error("[minuteurs] écoute", err);
          desabonner = null;
          if (annule) return;
          const delai = DELAIS_REABONNEMENT_MS[Math.min(essai++, DELAIS_REABONNEMENT_MS.length - 1)];
          relance = window.setTimeout(abonner, delai);
        },
      );
    };
    abonner();
    return () => {
      annule = true;
      if (relance !== null) window.clearTimeout(relance);
      desabonner?.();
    };
  }, [householdId]);

  // Horloge : une seconde, seulement s'il y a quelque chose à afficher.
  const actifs = minuteurs.length > 0;
  useEffect(() => {
    if (!actifs) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [actifs]);

  // Arrivée à zéro sur cet appareil → transaction (une tentative, puis au retour du réseau).
  useEffect(() => {
    if (!householdId) return;
    for (const m of minuteurs) {
      if (!estTermine(m, nowMs) || tentes.current.has(m.id)) continue;
      tentes.current.add(m.id);
      if (typeof navigator !== "undefined" && navigator.onLine === false) continue;
      void marquerTermine(householdId, m.id);
    }
  }, [householdId, minuteurs, nowMs]);

  useEffect(() => {
    const auRetour = () => tentes.current.clear();
    window.addEventListener("online", auRetour);
    return () => window.removeEventListener("online", auRetour);
  }, []);

  // Son : tant qu'un minuteur sonne et que la page est visible.
  const alarme = minuteurs.some((m) => estEnAlarme(m, nowMs));
  useEffect(() => {
    installerDeverrouillage();
    if (!alarme) return;
    const cle = Symbol("alarme");
    demandesAlarme.add(cle);
    majBoucle();
    document.addEventListener("visibilitychange", majBoucle);
    return () => {
      demandesAlarme.delete(cle);
      document.removeEventListener("visibilitychange", majBoucle);
      majBoucle();
    };
  }, [alarme]);

  const ref = useCallback(
    (id: string) => doc(db, "households", householdId ?? "_", "timers", id),
    [householdId],
  );

  const lancer = useCallback(
    async (label: string | null, secondes: number) => {
      if (!householdId || !(secondes > 0)) return;
      const debut = Date.now();
      try {
        await addDoc(colTimers(householdId), {
          label: label?.trim() || libelleParDefaut(secondes),
          durationSeconds: secondes,
          startedAt: new Date(debut),
          endsAt: new Date(debut + secondes * 1000),
          status: "running",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        signalerErreur(err, "Le minuteur n'a pas pu être lancé.");
      }
    },
    [householdId],
  );

  const ajouterUneMinute = useCallback(
    async (m: Minuteur) => {
      if (!householdId) return;
      const p = ajoutUneMinute(m, Date.now());
      const champs: Record<string, unknown> = {
        durationSeconds: p.durationSeconds,
        updatedAt: serverTimestamp(),
      };
      if (p.status) champs.status = p.status;
      if (p.endsAtMs !== undefined) champs.endsAt = new Date(p.endsAtMs);
      if (p.remainingSeconds !== undefined) champs.remainingSeconds = p.remainingSeconds;
      // Relancé après sa fin : il peut à nouveau être marqué terminé.
      tentes.current.delete(m.id);
      try {
        await updateDoc(ref(m.id), champs);
      } catch (err) {
        signalerErreur(err, "La minute n'a pas pu être ajoutée.");
      }
    },
    [householdId, ref],
  );

  const pause = useCallback(
    async (m: Minuteur) => {
      if (!householdId || m.status !== "running") return;
      try {
        await updateDoc(ref(m.id), {
          status: "paused",
          pausedAt: new Date(),
          remainingSeconds: Math.ceil(tempsRestantMs(m, Date.now()) / 1000),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        signalerErreur(err, "Le minuteur n'a pas pu être mis en pause.");
      }
    },
    [householdId, ref],
  );

  const reprendre = useCallback(
    async (m: Minuteur) => {
      if (!householdId || m.status !== "paused") return;
      try {
        await updateDoc(ref(m.id), {
          status: "running",
          endsAt: new Date(Date.now() + (m.remainingSeconds ?? 0) * 1000),
          pausedAt: deleteField(),
          remainingSeconds: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        signalerErreur(err, "Le minuteur n'a pas pu reprendre.");
      }
    },
    [householdId, ref],
  );

  const arreter = useCallback(
    async (m: Minuteur) => {
      if (!householdId) return;
      try {
        await deleteDoc(ref(m.id));
      } catch (err) {
        signalerErreur(err, "Le minuteur n'a pas pu être arrêté.");
      }
    },
    [householdId, ref],
  );

  const acquitter = useCallback(
    async (m: Minuteur) => {
      if (!householdId) return;
      // Les deux écritures partent dans l'ordre (y compris hors ligne, depuis
      // le cache local) : `acknowledged` coupe l'alarme des autres appareils,
      // la suppression libère la liste.
      const marque = updateDoc(ref(m.id), {
        status: "acknowledged",
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      const supprime = deleteDoc(ref(m.id)).catch((err) =>
        signalerErreur(err, "Le minuteur n'a pas pu être retiré."),
      );
      await Promise.all([marque, supprime]);
    },
    [householdId, ref],
  );

  return { minuteurs, nowMs, lancer, ajouterUneMinute, pause, reprendre, arreter, acquitter };
}
