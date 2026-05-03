import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { Profil } from "@family-hub/types";
import { useCreateProfil, useUpdateProfil } from "../lib/mutations";
import ProfilBadge from "./ProfilBadge";

interface ProfilFormProps {
  householdId: string;
  existing?: Profil & { id: string };
  onSaved?: () => void;
  onCancel?: () => void;
}

const COULEURS_PRESET = [
  "#E07A5F", // corail (accent-chaud)
  "#81B29A", // vert sauge
  "#F2CC8F", // moutarde
  "#3D405B", // bleu nuit
  "#9B5DE5", // violet
  "#F15BB5", // rose
  "#00BBF9", // cyan
  "#00F5D4", // menthe
];

const EMOJIS_PRESET = [
  "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐶", "🐱",
  "🐰", "🦄", "🐝", "🦋", "🌸", "🌟", "🍀", "🍓",
  "🚀", "⚽", "🎨", "🎸", "📚", "🍕", "🧸", "🎲",
];

export default function ProfilForm({
  householdId,
  existing,
  onSaved,
  onCancel,
}: ProfilFormProps) {
  const create = useCreateProfil();
  const update = useUpdateProfil();
  const isEdit = !!existing;

  const [nom, setNom] = useState(existing?.nom ?? "");
  const [initiale, setInitiale] = useState(existing?.initiale ?? "");
  const [couleur, setCouleur] = useState(existing?.couleur ?? COULEURS_PRESET[0]);
  const [emoji, setEmoji] = useState<string | undefined>(existing?.emoji);
  const [regimes, setRegimes] = useState<string[]>(existing?.regimes ?? []);
  const [aversions, setAversions] = useState<string[]>(existing?.aversions ?? []);
  const [objectifs, setObjectifs] = useState<string[]>(existing?.objectifsNutrition ?? []);
  const [prefsCuisson, setPrefsCuisson] = useState<string[]>(existing?.prefsCuisson ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  // Auto-fill initiale à partir du nom si pas encore touché
  function handleNomChange(v: string) {
    setNom(v);
    if (!existing && !initiale && v.trim()) {
      setInitiale(v.trim().charAt(0).toUpperCase());
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) {
      setError("Le nom est requis");
      return;
    }
    if (!initiale.trim()) {
      setError("L'initiale est requise");
      return;
    }
    if (initiale.trim().length > 2) {
      setError("L'initiale doit faire 1 ou 2 caractères");
      return;
    }
    try {
      const profilData = {
        nom: nom.trim(),
        initiale: initiale.trim(),
        couleur,
        emoji,
        regimes,
        aversions,
        objectifsNutrition: objectifs,
        prefsCuisson,
        notes: notes.trim() || undefined,
      };
      if (isEdit) {
        await update.mutateAsync({
          householdId,
          profilId: existing.id,
          patch: profilData,
        });
      } else {
        await create.mutateAsync({ householdId, profil: profilData });
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="tile-card space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl mb-1">{isEdit ? "Modifier le profil" : "Nouveau profil"}</h2>
          <p className="text-text-secondaire text-sm">
            Identité visuelle + contraintes alimentaires utilisées par Kitchen Buddy.
          </p>
        </div>
        <ProfilBadge
          initiale={initiale || "?"}
          couleur={couleur}
          emoji={emoji}
          size="lg"
          showEmojiBeside
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Nom" required className="col-span-2">
          <input
            type="text"
            value={nom}
            onChange={(e) => handleNomChange(e.target.value)}
            className="input"
            placeholder="Julie"
          />
        </Field>
        <Field label="Initiale" required>
          <input
            type="text"
            value={initiale}
            onChange={(e) => setInitiale(e.target.value.slice(0, 2))}
            maxLength={2}
            className="input text-center font-semibold"
            placeholder="J"
          />
        </Field>
      </div>

      <Field label="Couleur">
        <div className="flex flex-wrap gap-2 items-center">
          {COULEURS_PRESET.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCouleur(c)}
              className={`w-9 h-9 rounded-full border-2 transition ${
                couleur === c ? "border-text-principal scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Couleur ${c}`}
            />
          ))}
          <input
            type="color"
            value={couleur}
            onChange={(e) => setCouleur(e.target.value)}
            className="w-9 h-9 rounded-full cursor-pointer border-0 bg-transparent"
            aria-label="Couleur personnalisée"
          />
        </div>
      </Field>

      <Field label="Emoji (optionnel)">
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={() => setEmoji(undefined)}
            className={`w-9 h-9 rounded-md border flex items-center justify-center text-text-secondaire ${
              !emoji ? "border-accent-chaud" : "border-bordure"
            }`}
            title="Aucun"
          >
            <X size={14} />
          </button>
          {EMOJIS_PRESET.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`w-9 h-9 rounded-md border flex items-center justify-center text-xl transition ${
                emoji === e ? "border-accent-chaud bg-bordure" : "border-bordure hover:bg-bordure"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>

      <ChipsField
        label="Régimes"
        placeholder="ex: végétarien le midi, sans porc"
        chips={regimes}
        onChange={setRegimes}
      />
      <ChipsField
        label="Aversions"
        placeholder="ex: courgettes, coriandre"
        chips={aversions}
        onChange={setAversions}
      />
      <ChipsField
        label="Objectifs nutrition"
        placeholder="ex: + protéines, moins de sucre"
        chips={objectifs}
        onChange={setObjectifs}
      />
      <ChipsField
        label="Préférences cuisson"
        placeholder="ex: rapide <20min, four ok"
        chips={prefsCuisson}
        onChange={setPrefsCuisson}
      />

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          className="input"
          placeholder="ex: ne mange pas de légumineuses entières — ballonnements ; OK houmous"
        />
      </Field>

      {error && <p className="text-accent-chaud text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le profil"}
        </button>
      </div>
    </form>
  );
}

function ChipsField({
  label,
  placeholder,
  chips,
  onChange,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || chips.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...chips, v]);
    setDraft("");
  }

  function remove(i: number) {
    onChange(chips.filter((_, idx) => idx !== i));
  }

  return (
    <Field label={label}>
      <div className="space-y-2">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bordure text-sm"
              >
                {c}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-text-secondaire hover:text-accent-chaud"
                  aria-label={`Retirer ${c}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="input flex-1"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Ajouter
          </button>
        </div>
      </div>
    </Field>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-sm text-text-secondaire mb-1">
        {label}
        {required && <span className="text-accent-chaud"> *</span>}
      </span>
      {children}
    </label>
  );
}
