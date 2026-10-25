/**
 * Mode recette : tout le repas d'un coup (plat principal puis accompagnements).
 *
 * Deux entrées :
 *   - /menu/:planId/:slotId/cuisine → le repas du menu (toutes ses recettes) ;
 *   - /livre-recettes/:recetteId/cuisine → une recette seule (?portions=N) ;
 *   - /menu/:planId/batch/:batchId/cuisine → toutes les recettes d'une session
 *     de batch cooking, chacune à ses propres portions (pas de réglage).
 *
 * PC (≥ 768 px) : étapes à gauche (seule colonne qui défile), à droite les
 * ingrédients en haut et les minuteurs partagés avec l'iPad.
 * Téléphone : une colonne (ingrédients puis étapes) et un bouton « Minuteur »
 * fixé en bas qui ouvre les minuteurs dans une feuille.
 *
 * Plein écran opaque au-dessus de l'en-tête ; l'écran reste allumé tant que
 * la page est ouverte (Wake Lock, si le navigateur le permet).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BellRing, Minus, Plus, Timer, Users, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  usePlanRecettes,
  usePlanBatchSessions,
  usePlanSlots,
  useRecette,
  type MealPlanSlotWithId,
} from "../lib/queries";
import { clampPortions, PORTIONS_MAX, PORTIONS_MIN } from "../lib/recipeConstants";
import {
  assemblerRepas,
  etapesTriees,
  libelleEtape,
  portionsParDefaut,
  titreRepas,
  type RepasAssemble,
} from "../lib/repasCuisine";
import { useMinuteurs } from "../lib/MinuteursContext";
import { sonneIci } from "../lib/minuteurs";
import { identifiantAppareil } from "../lib/appareil";
import { MinuteurPanneau } from "../components/MinuteurPanneau";
import { toast } from "../components/Toast";
import { useEstTelephone } from "../lib/useEstTelephone";
import ListeIngredients from "../components/recette/ListeIngredients";

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

/** Écran maintenu allumé ; redemandé au retour sur la page ; erreurs ignorées. */
function useEcranAllume(): void {
  useEffect(() => {
    const wl = (navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wl) return;
    let actif = true;
    let verrou: WakeLockSentinelLike | null = null;
    const demander = () => {
      if (!actif || document.visibilityState !== "visible") return;
      wl.request("screen")
        .then((v) => {
          if (actif) verrou = v;
          else void v.release().catch(() => {});
        })
        .catch(() => {});
    };
    demander();
    document.addEventListener("visibilitychange", demander);
    return () => {
      actif = false;
      document.removeEventListener("visibilitychange", demander);
      void verrou?.release().catch(() => {});
    };
  }, []);
}

const BOUTON = "min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition";

export default function ModeRecette() {
  const { recetteId, planId, slotId, batchId } = useParams<{
    recetteId?: string;
    planId?: string;
    slotId?: string;
    batchId?: string;
  }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);

  // Entrée « repas du menu ».
  const slotsQ = usePlanSlots(householdId, slotId ? planId : undefined);
  const slot: MealPlanSlotWithId | undefined = slotsQ.data?.find((s) => s.id === slotId);
  // Entrée « session de batch ».
  const sessionsQ = usePlanBatchSessions(householdId, batchId ? planId : undefined);
  const batch = sessionsQ.data?.find((s) => s.id === batchId);
  const recettesQ = usePlanRecettes(householdId, slot ? [slot] : batch ? [batch] : undefined);
  // Entrée « recette seule ».
  const recetteQ = useRecette(householdId, slotId || batchId ? undefined : recetteId);

  const modeRepas = !!slotId;
  const modeBatch = !!batchId;
  const chargement =
    !householdId ||
    (modeRepas
      ? slotsQ.isLoading || (!!slot && slot.recetteIds.length > 0 && recettesQ.isLoading)
      : modeBatch
        ? sessionsQ.isLoading || (!!batch && batch.recetteIds.length > 0 && recettesQ.isLoading)
        : recetteQ.isLoading);

  const repas: RepasAssemble = useMemo(() => {
    if (modeRepas) return assemblerRepas(slot?.recetteIds ?? [], recettesQ.data ?? {});
    if (modeBatch) return assemblerRepas(batch?.recetteIds ?? [], recettesQ.data ?? {});
    if (!recetteId) return { presentes: [], manquantes: [] };
    return assemblerRepas([recetteId], recetteQ.data ? { [recetteId]: recetteQ.data } : {});
  }, [modeRepas, slot, modeBatch, batch, recettesQ.data, recetteId, recetteQ.data]);

  const titre = modeBatch
    ? batch
      ? "Batch cooking"
      : "Session introuvable"
    : modeRepas
    ? slot
      ? titreRepas(slot.repas, slot.date)
      : "Repas introuvable"
    : repas.presentes[0]?.recette.nom ?? "Recette introuvable";

  // Portions : ?portions=N, sinon présents du slot, sinon portions de la recette.
  const portionsUrl = parseInt(search.get("portions") ?? "", 10);
  const portionsInitiales =
    Number.isFinite(portionsUrl) && portionsUrl > 0
      ? clampPortions(portionsUrl)
      : clampPortions(portionsParDefaut(slot, repas.presentes[0]?.recette.portions));
  const [portionsChoisies, setPortions] = useState<number | null>(null);
  const portions = portionsChoisies ?? portionsInitiales;
  /** Batch : chaque recette à ses propres portions (null), pas de réglage. */
  const portionsAffichees = modeBatch ? null : portions;

  const telephone = useEstTelephone();
  const fermer = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else if (modeBatch) navigate(`/batch/${planId}/${batchId}`);
    // Ouvert directement (lien, appli relancée) : sur téléphone, /menu n'existe
    // pas (page PC) → retour à « Aujourd'hui ».
    else if (telephone) navigate("/");
    else navigate(modeRepas ? "/menu" : recetteId ? `/livre-recettes/${recetteId}` : "/livre-recettes");
  }, [navigate, modeRepas, modeBatch, planId, batchId, recetteId, telephone]);

  useEcranAllume();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const declencheurRef = useRef<HTMLButtonElement | null>(null);
  const fermerFeuilleRef = useRef<HTMLButtonElement | null>(null);
  const feuilleDejaOuverte = useRef(false);

  // Feuille des minuteurs : focus sur son « Fermer » à l'ouverture, retour au déclencheur à la fermeture.
  useEffect(() => {
    if (feuilleOuverte) {
      feuilleDejaOuverte.current = true;
      fermerFeuilleRef.current?.focus();
    } else if (feuilleDejaOuverte.current) {
      feuilleDejaOuverte.current = false;
      declencheurRef.current?.focus();
    }
  }, [feuilleOuverte]);

  // Échap : ferme la feuille si elle est ouverte, sinon quitte la page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (feuilleOuverte) setFeuilleOuverte(false);
      else fermer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fermer, feuilleOuverte]);
  // Abonnement partagé du Layout (pas de second abonnement ici).
  const { minuteurs, nowMs, lancer } = useMinuteurs();
  const nbMinuteurs = minuteurs.filter((m) => m.status !== "acknowledged").length;
  const appareil = identifiantAppareil();
  const alarme = minuteurs.some((m) => sonneIci(m, nowMs, appareil));

  const lancerEtape = (description: string, minutes: number) => {
    const label = libelleEtape(description);
    // Écriture locale immédiate : confirmé tout de suite, même hors ligne.
    // Un refus du serveur s'affichera plus tard (lancer s'en charge).
    if (lancer(label, minutes * 60)) toast(`Minuteur lancé : ${label}`, { type: "success" });
  };

  const introuvable = !chargement && repas.presentes.length === 0 && repas.manquantes.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-50 bg-ebony text-cream flex flex-col"
    >
      {/* En-tête : fermer, titre, portions */}
      <header className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 md:px-8 border-b border-hairline">
        <button
          type="button"
          onClick={fermer}
          autoFocus
          className={`${BOUTON} bg-ebony-card border border-hairline text-cream hover:border-brass`}
        >
          <X aria-hidden className="h-5 w-5" />
          Fermer
        </button>
        <h1 className="flex-1 min-w-0 text-xl md:text-2xl font-serif leading-tight line-clamp-2">{titre}</h1>
        {!chargement && !modeBatch && repas.presentes.length > 0 && (
          <div className="flex items-center gap-2" role="group" aria-label="Portions">
            <span className="text-base text-cream-mute">Portions</span>
            <button
              type="button"
              onClick={() => setPortions(Math.max(PORTIONS_MIN, portions - 1))}
              disabled={portions <= PORTIONS_MIN}
              className={`${BOUTON} px-0 w-12 bg-ebony-card border border-hairline disabled:opacity-40`}
              aria-label="Une portion de moins"
            >
              <Minus aria-hidden className="h-5 w-5" />
            </button>
            <span className="inline-flex items-center gap-1 text-lg font-semibold tabular-nums min-w-16 justify-center">
              <Users aria-hidden className="h-5 w-5 text-cream-mute" />
              {portions} pers.
            </span>
            <button
              type="button"
              onClick={() => setPortions(Math.min(PORTIONS_MAX, portions + 1))}
              disabled={portions >= PORTIONS_MAX}
              className={`${BOUTON} px-0 w-12 bg-ebony-card border border-hairline disabled:opacity-40`}
              aria-label="Une portion de plus"
            >
              <Plus aria-hidden className="h-5 w-5" />
            </button>
          </div>
        )}
      </header>

      {chargement ? (
        <p className="p-6 text-lg text-cream-mute">Chargement…</p>
      ) : introuvable ? (
        <p className="p-6 text-lg">
          {modeBatch
            ? batch
              ? "Aucune recette prévue pour cette session."
              : "Cette session de batch cooking est introuvable."
            : !modeRepas
              ? "Recette introuvable."
              : slot
                ? "Aucune recette prévue pour ce repas."
                : "Ce repas est introuvable."}
        </p>
      ) : telephone ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-28 space-y-6">
            <Ingredients repas={repas} portions={portionsAffichees} />
            <Etapes repas={repas} onLancer={lancerEtape} />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-[55] p-3 bg-ebony border-t border-hairline pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              ref={declencheurRef}
              type="button"
              onClick={() => setFeuilleOuverte(true)}
              className={`${BOUTON} w-full text-lg ${
                alarme
                  ? "bg-[rgb(var(--c-maintenant))] text-[rgb(var(--c-bordure))]"
                  : "bg-brass text-ebony"
              }`}
            >
              {alarme ? <BellRing aria-hidden className="h-5 w-5" /> : <Timer aria-hidden className="h-5 w-5" />}
              {alarme ? "Minuteur : c'est prêt !" : nbMinuteurs > 0 ? `Minuteur (${nbMinuteurs})` : "Minuteur"}
            </button>
          </div>
          {feuilleOuverte && householdId && (
            <div className="fixed inset-0 z-[60] flex flex-col justify-end">
              <button
                type="button"
                aria-label="Fermer les minuteurs"
                className="absolute inset-0 bg-ebony/80"
                onClick={() => setFeuilleOuverte(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Minuteurs"
                className="relative max-h-[85vh] overflow-y-auto rounded-t-2xl bg-ebony-card border-t border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Timer aria-hidden className="h-5 w-5 text-brass" />
                    Minuteurs
                  </h2>
                  <button
                    ref={fermerFeuilleRef}
                    type="button"
                    onClick={() => setFeuilleOuverte(false)}
                    className={`${BOUTON} bg-ebony border border-hairline text-cream`}
                  >
                    <X aria-hidden className="h-5 w-5" />
                    Fermer
                  </button>
                </div>
                <MinuteurPanneau compact />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 px-8 py-6">
          <div className="col-span-2 min-h-0 overflow-y-auto pr-2">
            <Etapes repas={repas} onLancer={lancerEtape} />
          </div>
          {/* Colonne droite : défile d'un bloc si les minuteurs s'empilent ; les
              ingrédients restent en haut, limités à la moitié de l'écran. */}
          <aside className="col-span-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1">
            <div className="shrink-0 max-h-[50vh] overflow-y-auto rounded-2xl">
              <Ingredients repas={repas} portions={portionsAffichees} />
            </div>
            {householdId && <MinuteurPanneau compact className="shrink-0" />}
          </aside>
        </div>
      )}
    </div>
  );
}

/** `portions` null : chaque recette à ses propres portions (batch). */
function Ingredients({ repas, portions }: { repas: RepasAssemble; portions: number | null }) {
  const plusieurs = repas.presentes.length + repas.manquantes.length > 1;
  return (
    <section aria-label="Ingrédients" className="bg-ebony-card rounded-2xl p-4 space-y-4">
      <h2 className="text-lg font-semibold">Ingrédients{portions !== null && ` · ${portions} pers.`}</h2>
      {repas.presentes.map(({ id, recette }) => (
        <div key={id}>
          {plusieurs && (
            <h3 className="text-base font-semibold text-brass mb-1">
              {recette.nom}
              {portions === null && recette.portions > 0 && (
                <span className="font-normal text-cream-mute"> · {recette.portions} pers.</span>
              )}
            </h3>
          )}
          <ListeIngredients recette={recette} portions={portions ?? recette.portions} />
        </div>
      ))}
      {repas.manquantes.map((id) => (
        <p key={id} className="text-base text-cream-mute">Recette introuvable</p>
      ))}
    </section>
  );
}

function Etapes({
  repas,
  onLancer,
}: {
  repas: RepasAssemble;
  onLancer: (description: string, minutes: number) => void;
}) {
  const plusieurs = repas.presentes.length + repas.manquantes.length > 1;
  return (
    <section aria-label="Étapes" className="space-y-8">
      {repas.presentes.map(({ id, recette }) => {
        const etapes = etapesTriees(recette.etapes);
        return (
          <div key={id} className="space-y-4">
            {plusieurs && <h2 className="text-2xl font-serif">{recette.nom}</h2>}
            {etapes.length === 0 ? (
              <p className="text-lg text-cream-mute">Pas d'étapes détaillées pour cette recette.</p>
            ) : (
              <ol className="space-y-5">
                {etapes.map((etape, i) => (
                  <li key={`${etape.ordre}-${i}`} className="flex gap-4">
                    <span className="shrink-0 w-9 h-9 rounded-full bg-ebony-card border border-hairline flex items-center justify-center text-base font-semibold">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-lg md:text-xl leading-relaxed">{etape.description}</p>
                      {etape.dureeMinutes && etape.dureeMinutes > 0 ? (
                        <button
                          type="button"
                          onClick={() => onLancer(etape.description, etape.dureeMinutes!)}
                          className={`${BOUTON} bg-ebony-card border border-brass text-brass hover:bg-brass hover:text-ebony`}
                        >
                          <Timer aria-hidden className="h-5 w-5" />
                          Lancer {etape.dureeMinutes} min
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
      {repas.manquantes.map((id) => (
        <p key={id} className="text-lg text-cream-mute">Recette introuvable</p>
      ))}
    </section>
  );
}
