import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChefHat, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useDraftPlan,
  usePlan,
  usePlanRecettes,
  usePlanSlots,
  useProfils,
} from "../lib/queries";
import {
  useAcceptSlot,
  useCreateMealPlan,
  useDeleteMealPlan,
  useGenerateMealPlan,
  useRegenerateSlot,
  useRefuseSlot,
  useValidateMealPlan,
} from "../lib/mutations";
import PresenceGrid, {
  buildDefaultPresence,
  presenceToApi,
  type PresenceState,
} from "../components/kitchenBuddy/PresenceGrid";
import MealPlanGrid from "../components/kitchenBuddy/MealPlanGrid";
import PlanStatusBar from "../components/kitchenBuddy/PlanStatusBar";

type WizardStep = "date" | "presence" | "contexte" | "review";

export default function KitchenBuddyWizard() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);
  const navigate = useNavigate();

  // Si un draft existe déjà, on saute directement au review
  const initialStep: WizardStep = draftPlan ? "review" : "date";
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [error, setError] = useState<string | null>(null);

  const [dateDebut, setDateDebut] = useState<string>(nextMondayISO());
  const [presence, setPresence] = useState<PresenceState>({});
  const [batchOk, setBatchOk] = useState(false);
  const [style, setStyle] = useState("");
  const [frigo, setFrigo] = useState("");

  const profilIds = useMemo(() => (profils ?? []).map((p) => p.id), [profils]);

  // Init présence par défaut quand on connaît les profils
  useMemo(() => {
    if (profilIds.length && Object.keys(presence).length === 0) {
      setPresence(buildDefaultPresence(profilIds));
    }
  }, [profilIds, presence]);

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
        <Link to="/kitchen-buddy" className="text-cream-mute hover:text-cream">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl flex items-center gap-3">
          <ChefHat size={26} className="text-brass" />
          Nouveau plan
        </h1>
      </div>

      <Stepper current={step} hasDraft={!!draftPlan} />

      {step === "date" && (
        <StepDate
          dateDebut={dateDebut}
          setDateDebut={setDateDebut}
          onNext={() => setStep("presence")}
        />
      )}

      {step === "presence" && (
        <StepPresence
          profils={profils}
          presence={presence}
          setPresence={setPresence}
          onPrev={() => setStep("date")}
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
          onAbandon={handleAbandonDraft}
          onValidated={() => navigate("/kitchen-buddy")}
        />
      )}
    </div>
  );
}

function Stepper({ current, hasDraft }: { current: WizardStep; hasDraft: boolean }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "date", label: "Date" },
    { key: "presence", label: "Présence" },
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
          <div key={s.key} className="flex items-center gap-2">
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
  onNext,
}: {
  dateDebut: string;
  setDateDebut: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="tile-card space-y-4">
      <div>
        <h2 className="text-xl mb-1">Quand commence la semaine ?</h2>
        <p className="text-cream-mute text-sm">
          Par défaut, lundi prochain. Tu peux choisir un autre lundi si tu planifies à l'avance.
        </p>
      </div>
      <input
        type="date"
        value={dateDebut}
        onChange={(e) => setDateDebut(e.target.value)}
        className="input"
      />
      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StepPresence({
  profils,
  presence,
  setPresence,
  onPrev,
  onNext,
}: {
  profils: Array<{ id: string; nom: string; initiale: string; couleur: string; emoji?: string }>;
  presence: PresenceState;
  setPresence: (p: PresenceState) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="tile-card">
        <h2 className="text-xl mb-1">Qui mange à quels repas ?</h2>
        <p className="text-cream-mute text-sm">
          Par défaut tout le monde est présent à tous les repas. Décoche les exceptions
          (école, dîner chez des amis, déjeuner au bureau…).
        </p>
      </div>
      <PresenceGrid
        profils={profils as never}
        presence={presence}
        onChange={setPresence}
      />
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={14} /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} />
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
  error: string | null;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
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

      {error && <p className="text-copper text-sm">{error}</p>}

      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <ArrowLeft size={14} /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Création…
            </>
          ) : (
            <>
              Créer le brouillon <ArrowRight size={14} />
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
  onAbandon,
  onValidated,
}: {
  householdId: string;
  planId: string;
  profils: Array<{ id: string; nom: string; initiale: string; couleur: string; emoji?: string }>;
  onAbandon: () => void;
  onValidated: () => void;
}) {
  const { data: plan } = usePlan(householdId, planId);
  const { data: slots } = usePlanSlots(householdId, planId);
  const { data: recettesById } = usePlanRecettes(householdId, slots);
  const generate = useGenerateMealPlan();
  const validate = useValidateMealPlan();
  const accept = useAcceptSlot();
  const refuse = useRefuseSlot();
  const regen = useRegenerateSlot();

  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const profilsById: Record<string, never> = useMemo(
    () => Object.fromEntries(profils.map((p) => [p.id, p])) as never,
    [profils],
  );

  const hasGeneration = (slots ?? []).some((s) => s.recetteIds.length > 0);

  async function handleGenerate() {
    setGenError(null);
    try {
      await generate.mutateAsync({ householdId, planId });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function withBusy(slotId: string, action: () => Promise<unknown>) {
    setBusySlotId(slotId);
    try {
      await action();
    } finally {
      setBusySlotId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="tile-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl mb-1">Brouillon de plan</h2>
          <p className="text-cream-mute text-sm">
            {hasGeneration
              ? "Revoir les propositions, accepter ou régénérer slot par slot."
              : "Lance la génération pour obtenir des propositions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAbandon}
            className="btn-secondary text-sm"
          >
            Abandonner
          </button>
          {!hasGeneration && (
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {generate.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Génération en cours…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Générer le plan
                </>
              )}
            </button>
          )}
          {hasGeneration && (
            <>
              <button
                onClick={handleGenerate}
                disabled={generate.isPending}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Re-générer tout
              </button>
              <button
                onClick={async () => {
                  await validate.mutateAsync({ householdId, planId });
                  onValidated();
                }}
                disabled={validate.isPending}
                className="btn-primary text-sm"
              >
                {validate.isPending ? "Validation…" : "Valider le plan"}
              </button>
            </>
          )}
        </div>
      </div>

      <PlanStatusBar tokensUsed={plan?.tokensUsed} llmModel={plan?.llmModel} />

      {genError && (
        <div className="tile-card border-copper">
          <p className="text-copper text-sm">{genError}</p>
        </div>
      )}

      {slots && slots.length > 0 && (
        <MealPlanGrid
          slots={slots}
          recettesById={recettesById ?? {}}
          profilsById={profilsById}
          busySlotId={busySlotId}
          onAccept={(slotId) =>
            withBusy(slotId, () => accept.mutateAsync({ householdId, planId, slotId }))
          }
          onRefuse={(slotId) =>
            withBusy(slotId, () => refuse.mutateAsync({ householdId, planId, slotId }))
          }
          onRegenerate={(slotId, userFeedback) =>
            withBusy(slotId, () =>
              regen.mutateAsync({ householdId, planId, slotId, userFeedback }),
            )
          }
        />
      )}
    </div>
  );
}

function nextMondayISO(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=dim, 1=lun
  const daysUntilMonday = (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}
