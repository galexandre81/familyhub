import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Check,
  Copy,
  Download,
  Loader2,
  Upload,
  Users,
} from "lucide-react";
import ProfilBadge from "../components/ProfilBadge";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useDraftPlan,
  useHouseholds,
  usePlanSlots,
  useProfils,
} from "../lib/queries";
import {
  useCreateMealPlan,
  useDeleteMealPlan,
} from "../lib/mutations";
import PresenceGrid, {
  buildDefaultExpress,
  buildDefaultPresence,
  presenceToApi,
  type ExpressState,
  type PresenceState,
} from "../components/menu/PresenceGrid";
import { buildPlanMd, PLAN_PROMPT_TEMPLATE, realDayLabel, type PresenceMap } from "../lib/planMd";
import type { Profil } from "@family-hub/types";

type WizardStep = "date" | "attendance" | "presence" | "contexte" | "review";

type NbJours = 3 | 5 | 7 | 10;
type PremierRepas = "midi" | "soir";
interface PetitDejRotation {
  actif: boolean;
  nbFormules: 2 | 3;
}

export default function MenuWizard() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);

  // Si un draft existe déjà, on saute directement au review
  const initialStep: WizardStep = draftPlan ? "review" : "date";
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [error, setError] = useState<string | null>(null);

  const [dateDebut, setDateDebut] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  /** Nombre de jours couverts par le plan (n'importe quel jour de départ). */
  const [nbJours, setNbJours] = useState<NbJours>(7);
  /** Premier repas cuisiné du jour 1. */
  const [premierRepas, setPremierRepas] = useState<PremierRepas>("midi");
  /** Rotation des petits-déjeuners express (off par défaut). */
  const [petitDejRotation, setPetitDejRotation] = useState<PetitDejRotation>({
    actif: false,
    nbFormules: 2,
  });
  /**
   * Qui est présent cette semaine ? Filtre week-level avant la grille fine
   * par slot. Permet d'exclure Pop/Mima en 1 clic s'ils ne sont pas là.
   * Vide tant qu'on n'a pas chargé les profils.
   */
  const [attendees, setAttendees] = useState<string[]>([]);
  const [presence, setPresence] = useState<PresenceState>({});
  const [express, setExpress] = useState<ExpressState>(buildDefaultExpress(7));
  const [batchOk, setBatchOk] = useState(false);
  const [style, setStyle] = useState("");
  const [frigo, setFrigo] = useState("");
  /** Jour de la semaine où on fait les courses (0=lundi…6=dimanche).
   *  Empêche Claude de placer le batch cooking ce jour-là. -1 = pas défini. */
  const [jourCoursesIdx, setJourCoursesIdx] = useState<number>(-1);

  const profilIds = useMemo(() => (profils ?? []).map((p) => p.id), [profils]);

  // Init présence + attendees par défaut quand on connaît les profils.
  // La présence par défaut applique déjà les absences déclarées des profils.
  useMemo(() => {
    if (profilIds.length && Object.keys(presence).length === 0) {
      setPresence(buildDefaultPresence(profilIds, nbJours, dateDebut, profils));
    }
    if (profilIds.length && attendees.length === 0) {
      setAttendees(profilIds);
    }
  }, [profilIds, presence, attendees, nbJours, dateDebut, profils]);

  /**
   * Profils affichés dans la grille fine (step "presence") : uniquement ceux
   * cochés à la step "attendance". Si rien n'est coché (cas avant init),
   * fallback sur tous les profils.
   */
  const attendingProfils = useMemo(() => {
    if (!profils) return [];
    if (attendees.length === 0) return profils;
    return profils.filter((p) => attendees.includes(p.id));
  }, [profils, attendees]);

  /**
   * Transition attendance → presence : rebuild la grille fine pour ne contenir
   * que les attendees (si on a changé la sélection depuis le dernier passage).
   */
  function goToPresenceFromAttendance() {
    const attendingProfilsList = (profils ?? []).filter((p) => attendees.includes(p.id));
    // Rebuild la grille fine + auto-applique les absences déclarées de chaque attendee.
    setPresence(buildDefaultPresence(attendees, nbJours, dateDebut, attendingProfilsList));
    setExpress(buildDefaultExpress(nbJours));
    setStep("presence");
  }

  const create = useCreateMealPlan();
  const deletePlan = useDeleteMealPlan();

  async function handleStartReview() {
    if (!householdId) return;
    setError(null);
    try {
      await create.mutateAsync({
        householdId,
        dateDebutISO: new Date(dateDebut).toISOString(),
        contexte: { batchCookingOk: batchOk, style, frigoTexte: frigo },
        presence: presenceToApi(presence),
      });
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleAbandonDraft() {
    if (!householdId || !draftPlan) return;
    if (!confirm("Abandonner le brouillon ? Tout son contenu sera supprimé.")) return;
    await deletePlan.mutateAsync({ householdId, planId: draftPlan.id });
    setStep("date");
  }

  if (!householdId) return null;

  if (!profils || profils.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Nouveau plan</h1>
        <div className="tile-card text-center py-8">
          <p className="mb-3">Aucun profil dans le foyer.</p>
          <p className="text-cream-mute text-sm mb-4">
            Crée au moins un profil par membre de la famille pour pouvoir générer des plans.
          </p>
          <Link to="/parametres/profils" className="btn-primary inline-block">
            Créer un profil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/menu"
          aria-label="Retour au menu"
          className="text-cream-mute hover:text-cream"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <h1 className="text-3xl flex items-center gap-3">
          <ChefHat size={26} className="text-brass" aria-hidden="true" />
          Nouveau plan
        </h1>
      </div>

      <Stepper current={step} hasDraft={!!draftPlan} />

      {step === "date" && (
        <StepDate
          dateDebut={dateDebut}
          setDateDebut={setDateDebut}
          nbJours={nbJours}
          setNbJours={setNbJours}
          premierRepas={premierRepas}
          setPremierRepas={setPremierRepas}
          onNext={() => setStep("attendance")}
        />
      )}

      {step === "attendance" && (
        <StepAttendance
          profils={profils}
          attendees={attendees}
          setAttendees={setAttendees}
          onPrev={() => setStep("date")}
          onNext={goToPresenceFromAttendance}
        />
      )}

      {step === "presence" && (
        <StepPresence
          profils={attendingProfils}
          presence={presence}
          setPresence={setPresence}
          express={express}
          setExpress={setExpress}
          nbJours={nbJours}
          dateDebut={dateDebut}
          petitDejRotation={petitDejRotation}
          setPetitDejRotation={setPetitDejRotation}
          onPrev={() => setStep("attendance")}
          onNext={() => setStep("contexte")}
        />
      )}

      {step === "contexte" && (
        <StepContexte
          batchOk={batchOk}
          setBatchOk={setBatchOk}
          style={style}
          setStyle={setStyle}
          frigo={frigo}
          setFrigo={setFrigo}
          jourCoursesIdx={jourCoursesIdx}
          setJourCoursesIdx={setJourCoursesIdx}
          nbJours={nbJours}
          dateDebut={dateDebut}
          error={error}
          onPrev={() => setStep("presence")}
          onNext={handleStartReview}
          loading={create.isPending}
        />
      )}

      {step === "review" && draftPlan && (
        <StepReview
          householdId={householdId}
          planId={draftPlan.id}
          profils={profils}
          express={express}
          jourCoursesIdx={jourCoursesIdx}
          premierRepas={premierRepas}
          petitDejRotation={petitDejRotation}
          onAbandon={handleAbandonDraft}
        />
      )}
    </div>
  );
}

function Stepper({ current, hasDraft }: { current: WizardStep; hasDraft: boolean }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "date", label: "Date" },
    { key: "attendance", label: "Qui est là" },
    { key: "presence", label: "Repas" },
    { key: "contexte", label: "Contexte" },
    { key: "review", label: "Revue" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < currentIdx || (hasDraft && s.key !== "review" && current === "review");
        const active = s.key === current;
        return (
          <div
            key={s.key}
            className="flex items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                active
                  ? "bg-brass text-ebony"
                  : done
                    ? "bg-sage/30 text-sage"
                    : "bg-ebony-card text-cream-mute"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`uppercase tracking-widest text-[10px] ${
                active ? "text-brass" : done ? "text-sage" : "text-cream-mute"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-wood-dark" />}
          </div>
        );
      })}
    </div>
  );
}

function StepDate({
  dateDebut,
  setDateDebut,
  nbJours,
  setNbJours,
  premierRepas,
  setPremierRepas,
  onNext,
}: {
  dateDebut: string;
  setDateDebut: (v: string) => void;
  nbJours: NbJours;
  setNbJours: (v: NbJours) => void;
  premierRepas: PremierRepas;
  setPremierRepas: (v: PremierRepas) => void;
  onNext: () => void;
}) {
  const NB_OPTIONS: NbJours[] = [3, 5, 7, 10];
  return (
    <div className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">Quand commence le plan ?</h2>
        <p className="text-cream-mute text-sm">
          Le plan démarre le jour que tu choisis — n'importe quel jour, pas
          forcément un lundi. Idéal pour planifier au fil de l'eau.
        </p>
      </div>
      <input
        type="date"
        value={dateDebut}
        onChange={(e) => setDateDebut(e.target.value)}
        className="input"
      />

      <div>
        <label className="block text-sm text-cream-mute mb-2">Durée du plan</label>
        <div className="inline-flex rounded-lg border border-bordure overflow-hidden">
          {NB_OPTIONS.map((n) => {
            const on = n === nbJours;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setNbJours(n)}
                aria-pressed={on}
                className={`px-4 min-h-11 text-sm transition ${
                  on ? "bg-brass text-ebony font-semibold" : "text-cream-mute hover:text-brass"
                }`}
              >
                {n} j
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm text-cream-mute mb-2">
          Premier repas cuisiné du jour 1
        </label>
        <div className="inline-flex rounded-lg border border-bordure overflow-hidden">
          {(["midi", "soir"] as PremierRepas[]).map((r) => {
            const on = r === premierRepas;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setPremierRepas(r)}
                aria-pressed={on}
                className={`px-4 min-h-11 text-sm transition ${
                  on ? "bg-brass text-ebony font-semibold" : "text-cream-mute hover:text-brass"
                }`}
              >
                {r === "midi" ? "Midi (déjeuner)" : "Soir (dîner)"}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-cream-mute mt-1">
          Les créneaux antérieurs du jour 1 ne seront pas cuisinés.
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StepAttendance({
  profils,
  attendees,
  setAttendees,
  onPrev,
  onNext,
}: {
  profils: Array<Profil & { id: string }>;
  attendees: string[];
  setAttendees: (next: string[]) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  function toggle(id: string) {
    setAttendees(
      attendees.includes(id)
        ? attendees.filter((x) => x !== id)
        : [...attendees, id],
    );
  }
  function selectAll() {
    setAttendees(profils.map((p) => p.id));
  }
  const noneSelected = attendees.length === 0;

  return (
    <div className="space-y-4">
      <div className="tile-card space-y-3">
        <div className="flex items-start gap-3">
          <Users size={20} className="text-brass shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h2 className="text-xl mb-1">Qui est là cette semaine ?</h2>
            <p className="text-cream-mute text-sm">
              Décoche les personnes qui ne sont pas là (ex: Pop / Mima qui ne
              viennent qu'occasionnellement). Tu pourras toujours les rajouter
              ponctuellement sur un repas spécifique à l'étape suivante.
            </p>
          </div>
        </div>
      </div>

      <div className="tile-card">
        <div className="flex flex-wrap gap-3 justify-center">
          {profils.map((p) => {
            const on = attendees.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition ${
                  on
                    ? "border-brass/40 bg-brass/5"
                    : "border-bordure bg-transparent opacity-50 hover:opacity-75"
                }`}
                title={on ? `${p.nom} : présent(e) cette semaine` : `${p.nom} : absent(e) cette semaine`}
              >
                <div className={on ? "" : "grayscale"}>
                  <ProfilBadge
                    initiale={p.initiale}
                    couleur={p.couleur}
                    emoji={p.emoji}
                    size="md"
                  />
                </div>
                <span className="text-xs">{p.nom}</span>
                <span
                  className={`text-[9px] uppercase tracking-widest ${
                    on ? "text-sage" : "text-cream-mute"
                  }`}
                >
                  {on ? "présent" : "absent"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] uppercase tracking-widest text-cream-mute hover:text-brass"
          >
            Tout cocher
          </button>
        </div>
        {noneSelected && (
          <p role="alert" className="text-copper text-xs text-center mt-3">
            Coche au moins une personne pour continuer.
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={14} aria-hidden="true" /> Précédent
        </button>
        <button
          onClick={onNext}
          disabled={noneSelected}
          className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StepPresence({
  profils,
  presence,
  setPresence,
  express,
  setExpress,
  nbJours,
  dateDebut,
  petitDejRotation,
  setPetitDejRotation,
  onPrev,
  onNext,
}: {
  profils: Array<Profil & { id: string }>;
  presence: PresenceState;
  setPresence: (p: PresenceState) => void;
  express: ExpressState;
  setExpress: (e: ExpressState) => void;
  nbJours: NbJours;
  dateDebut: string;
  petitDejRotation: PetitDejRotation;
  setPetitDejRotation: (v: PetitDejRotation) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="tile-card">
        <h2 className="text-xl mb-1">Qui mange à quels repas ?</h2>
        <p className="text-cream-mute text-sm">
          Par défaut tout le monde est présent à tous les repas (les absences
          déclarées dans les profils sont déjà retirées). Décoche les exceptions
          (école, dîner chez des amis, déjeuner au bureau…). Le toggle{" "}
          <span className="text-brass">⚡ express</span> force Claude à
          choisir une recette ≤ 15 min pour ce slot — utile les jours pressés.
          Tous les petits-déjs sont en express par défaut.
        </p>
      </div>
      <PresenceGrid
        profils={profils}
        presence={presence}
        onChange={setPresence}
        nbJours={nbJours}
        dateDebut={dateDebut}
        express={express}
        onChangeExpress={setExpress}
      />
      <div className="tile-card space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={petitDejRotation.actif}
            onChange={(e) =>
              setPetitDejRotation({ ...petitDejRotation, actif: e.target.checked })
            }
            className="w-4 h-4 rounded text-brass focus:ring-brass"
          />
          <span className="text-sm">
            Petits-déjeuners en rotation (réutiliser quelques formules express au
            lieu d'un PDJ unique chaque jour)
          </span>
        </label>
        {petitDejRotation.actif && (
          <div className="flex items-center gap-2 pl-6">
            <span className="text-xs text-cream-mute">Nombre de formules :</span>
            <div className="inline-flex rounded-lg border border-bordure overflow-hidden">
              {([2, 3] as const).map((n) => {
                const on = n === petitDejRotation.nbFormules;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPetitDejRotation({ ...petitDejRotation, nbFormules: n })}
                    aria-pressed={on}
                    className={`px-3 min-h-11 text-sm transition ${
                      on ? "bg-brass text-ebony font-semibold" : "text-cream-mute hover:text-brass"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={14} aria-hidden="true" /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StepContexte({
  batchOk,
  setBatchOk,
  style,
  setStyle,
  frigo,
  setFrigo,
  jourCoursesIdx,
  setJourCoursesIdx,
  nbJours,
  dateDebut,
  error,
  onPrev,
  onNext,
  loading,
}: {
  batchOk: boolean;
  setBatchOk: (v: boolean) => void;
  style: string;
  setStyle: (v: string) => void;
  frigo: string;
  setFrigo: (v: string) => void;
  jourCoursesIdx: number;
  setJourCoursesIdx: (i: number) => void;
  nbJours: NbJours;
  dateDebut: string;
  error: string | null;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  // Libellés des jours = vraies dates du plan (jour réel + numéro), pas un
  // tableau fixe lundi→dimanche. L'index stocké reste 0..nbJours-1.
  const dateDebutObj = new Date(dateDebut);
  const JOURS = Array.from({ length: nbJours }, (_, i) =>
    realDayLabel(dateDebutObj, i),
  );
  return (
    <div className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">Contexte de la semaine</h2>
        <p className="text-cream-mute text-sm">
          Ces infos guident le LLM. Tout est optionnel sauf le batch cooking.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={batchOk}
          onChange={(e) => setBatchOk(e.target.checked)}
          className="w-4 h-4 rounded text-brass focus:ring-brass"
        />
        <span className="text-sm">
          Batch cooking OK le dimanche (préparer en avance pour la semaine)
        </span>
      </label>

      <div>
        <label className="block text-sm text-cream-mute mb-1">
          Jour des courses (optionnel)
        </label>
        <select
          value={jourCoursesIdx}
          onChange={(e) => setJourCoursesIdx(parseInt(e.target.value, 10))}
          className="input"
        >
          <option value={-1}>— Pas défini</option>
          {JOURS.map((j, i) => (
            <option key={i} value={i}>
              {j}
            </option>
          ))}
        </select>
        <p className="text-xs text-cream-mute mt-1">
          Si défini : Claude évite de placer la session de batch cooking ce
          jour-là (faire les courses + cuisiner en batch sur la même journée
          c'est trop).
        </p>
      </div>

      <div>
        <label className="block text-sm text-cream-mute mb-1">Style ou envie</label>
        <input
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={300}
          className="input"
          placeholder="ex: léger et végé cette semaine, on est crevés"
        />
      </div>

      <div>
        <label className="block text-sm text-cream-mute mb-1">À écouler du frigo</label>
        <textarea
          value={frigo}
          onChange={(e) => setFrigo(e.target.value)}
          rows={3}
          maxLength={2000}
          className="input"
          placeholder="ex: reste de poulet, 3 courgettes, 1 fromage blanc"
        />
        <p className="text-xs text-cream-mute mt-1">
          {frigo.length} / 2000 caractères. Ces ingrédients seront utilisés en priorité et
          n'iront pas dans la liste de courses.
        </p>
      </div>

      {error && <p role="alert" className="text-copper text-sm">{error}</p>}

      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <ArrowLeft size={14} aria-hidden="true" /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Création…
            </>
          ) : (
            <>
              Créer le brouillon <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function StepReview({
  householdId,
  planId,
  profils,
  express,
  jourCoursesIdx,
  premierRepas,
  petitDejRotation,
  onAbandon,
}: {
  householdId: string;
  planId: string;
  profils: Array<Profil & { id: string }>;
  express: ExpressState;
  jourCoursesIdx: number;
  premierRepas: PremierRepas;
  petitDejRotation: PetitDejRotation;
  onAbandon: () => void;
}) {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);
  const { data: slots } = usePlanSlots(householdId, planId);
  const { data: draftPlan } = useDraftPlan(householdId);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [downloadedMd, setDownloadedMd] = useState(false);

  const presence: PresenceMap = useMemo(() => {
    const out: PresenceMap = {};
    if (slots) {
      for (const s of slots) {
        out[`${s.jour}-${s.repas}`] = s.profilsPresents ?? [];
      }
    }
    return out;
  }, [slots]);

  const dateDebutISO = useMemo(() => {
    if (!draftPlan?.dateDebut) return new Date().toISOString().slice(0, 10);
    const ts = draftPlan.dateDebut as unknown;
    if (ts instanceof Date) return ts.toISOString().slice(0, 10);
    if (typeof ts === "object" && ts && "seconds" in ts) {
      return new Date((ts as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
    }
    if (typeof ts === "string") return ts.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }, [draftPlan]);

  // nbJours dérivé des slots réels (max index jour + 1) pour survivre au
  // rechargement du brouillon (non persisté dans la contexte du mealPlan).
  const nbJours = useMemo(() => {
    if (!slots || slots.length === 0) return 7;
    const maxJour = slots.reduce((m, s) => Math.max(m, s.jour), 0);
    return maxJour + 1;
  }, [slots]);

  const md = useMemo(() => {
    if (!draftPlan || !slots || !household) return "";
    return buildPlanMd({
      householdNom: household.nom,
      dateDebutISO,
      profils,
      presence,
      contexte: draftPlan.contexte,
      historiqueRecettes: [], // TODO 3.2+ : query recettes used in last 3 plans
      express,
      jourCoursesIdx,
      nbJours,
      premierRepas,
      petitDejRotation,
    });
  }, [
    draftPlan,
    slots,
    household,
    dateDebutISO,
    profils,
    presence,
    express,
    jourCoursesIdx,
    nbJours,
    premierRepas,
    petitDejRotation,
  ]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(PLAN_PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      alert(
        "Impossible de copier automatiquement. Sélectionne le texte ci-dessous et fais Ctrl+C.",
      );
    }
  }

  function handleDownloadMd() {
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-${dateDebutISO}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedMd(true);
    setTimeout(() => setDownloadedMd(false), 2500);
  }

  if (!slots || !household) {
    return (
      <div className="tile-card">
        <p className="text-cream-mute">Chargement du brouillon…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="tile-card space-y-2">
        <h2 className="text-xl">Brouillon prêt à exporter</h2>
        <p className="text-cream-mute text-sm">
          Le plan est en brouillon avec présence et contexte enregistrés.
          Suis les 4 étapes ci-dessous pour générer le menu via Claude.ai puis
          le réimporter.
        </p>
      </div>

      {/* Étape 1 — copier le prompt */}
      <div className="tile-card space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            1
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Copier le prompt pour Claude.ai</h3>
            <p className="text-cream-mute text-sm">
              Ouvre une nouvelle conversation Claude.ai (Pro ou web), colle ce
              prompt en premier message.
            </p>
          </div>
        </div>
        <button
          onClick={handleCopyPrompt}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          {copiedPrompt ? (
            <>
              <Check size={14} className="text-sage" aria-hidden="true" /> Copié
            </>
          ) : (
            <>
              <Copy size={14} aria-hidden="true" /> Copier le prompt
            </>
          )}
        </button>
      </div>

      {/* Étape 2 — télécharger le .md */}
      <div className="tile-card space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            2
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Télécharger le contexte du plan</h3>
            <p className="text-cream-mute text-sm">
              Ouvre le <code className="text-xs px-1 bg-ebony-ridge rounded">.md</code>{" "}
              dans un éditeur, copie tout le contenu, colle-le dans Claude.ai{" "}
              <em>après</em> le prompt (dans le même message ou en deuxième).
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadMd}
          disabled={!md}
          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40"
        >
          {downloadedMd ? (
            <>
              <Check size={14} className="text-sage" aria-hidden="true" /> Téléchargé
            </>
          ) : (
            <>
              <Download size={14} aria-hidden="true" /> Télécharger plan-{dateDebutISO}.md
            </>
          )}
        </button>
        <details className="text-xs text-cream-mute">
          <summary className="cursor-pointer hover:text-cream">
            Aperçu du contenu du .md
          </summary>
          <pre className="mt-2 p-3 bg-ebony-ridge rounded overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap">
            {md.length > 4000 ? md.slice(0, 4000) + "\n\n…(tronqué)" : md}
          </pre>
        </details>
      </div>

      {/* Étape 3 — itérer avec Claude */}
      <div className="tile-card">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            3
          </span>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold">Itérer le menu avec Claude</h3>
            <p className="text-cream-mute text-sm">
              Claude répond d'abord avec une <strong>proposition de menu en
              markdown</strong> (pas encore de JSON) et te demande si tu veux
              modifier quelque chose.
            </p>
            <p className="text-cream-mute text-sm">
              Tu peux lui demander des ajustements en langage naturel :
            </p>
            <ul className="text-xs text-cream-mute pl-4 space-y-0.5 italic">
              <li>« Remplace le mardi soir par autre chose »</li>
              <li>« Moins de viande sur la semaine »</li>
              <li>« Ajoute un dessert pour samedi »</li>
              <li>« Mets le poulet rôti avant jeudi (date limite frigo) »</li>
            </ul>
            <p className="text-cream-mute text-sm">
              Quand le menu te plaît, écris simplement <strong>« OK génère le
              JSON »</strong>. Claude renvoie alors le JSON dans un Artifact
              (téléchargeable en 1 clic) ou un bloc de code (bouton{" "}
              <em>Copy</em> en haut à droite).
            </p>
          </div>
        </div>
      </div>

      {/* Étape 4 — importer */}
      <div className="tile-card">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            4
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Importer le JSON ici</h3>
            <p className="text-cream-mute text-sm mb-3">
              Une fois le JSON copié (ou téléchargé puis ouvert), clique sur le
              bouton ci-dessous et colle-le dans la page d'import.
            </p>
            <Link
              to={`/menu/import?planId=${planId}`}
              className="btn-primary text-sm flex items-center gap-2 w-fit"
            >
              <Upload size={14} aria-hidden="true" /> J'ai le JSON, importer le plan →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer : abandonner */}
      <div className="flex items-center justify-end pt-2">
        <button onClick={onAbandon} className="text-cream-mute hover:text-copper text-xs">
          Abandonner ce brouillon
        </button>
      </div>
    </div>
  );
}
