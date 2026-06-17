import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { Profil, Absence, RepasKey } from "@family-hub/types";
import { useCreateProfil, useUpdateProfil } from "../lib/mutations";
import ProfilBadge from "./ProfilBadge";

type ContrainteMedicale = NonNullable<Profil["contraintesMedicales"]>[number];
type Tolerance = NonNullable<Profil["tolerances"]>[number];

const REPAS_OPTIONS: { key: RepasKey; label: string }[] = [
  { key: "petitDej", label: "Petit-déj" },
  { key: "dej", label: "Déj" },
  { key: "diner", label: "Dîner" },
];

// Convention JS getDay : 0 = dimanche … 6 = samedi. Affichage Lun→Dim.
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

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
  const [reglesMenage, setReglesMenage] = useState<string[]>(existing?.reglesMenage ?? []);
  const [contraintesMedicales, setContraintesMedicales] = useState<ContrainteMedicale[]>(
    existing?.contraintesMedicales ?? [],
  );
  const [tolerances, setTolerances] = useState<Tolerance[]>(existing?.tolerances ?? []);
  const [absences, setAbsences] = useState<Absence[]>(existing?.absences ?? []);
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
      // profilId des absences = id du profil édité (ou "" à la création :
      // le backend / une migration peut le réécrire, mais on le pose dès qu'on l'a).
      const profilId = existing?.id ?? "";
      const cleanedContraintes: ContrainteMedicale[] = contraintesMedicales
        .map((c) => ({
          terme: c.terme.trim(),
          ...(c.type ? { type: c.type } : {}),
          ...(c.adaptation && c.adaptation.trim()
            ? { adaptation: c.adaptation.trim() }
            : {}),
        }))
        .filter((c) => c.terme.length > 0);
      const cleanedTolerances: Tolerance[] = tolerances
        .map((t) => ({
          terme: t.terme.trim(),
          formesInterdites: t.formesInterdites,
          formesAutorisees: t.formesAutorisees,
        }))
        .filter((t) => t.terme.length > 0);
      const cleanedAbsences: Absence[] = absences
        .map<Absence>((a) => ({ ...a, profilId }))
        .filter((a) =>
          a.kind === "interval"
            ? a.from.length > 0 && a.to.length > 0
            : a.weekdays.length > 0 && a.repas.length > 0,
        );

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
        reglesMenage,
        contraintesMedicales: cleanedContraintes,
        tolerances: cleanedTolerances,
        absences: cleanedAbsences,
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
            placeholder="Marie"
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
              aria-pressed={couleur === c}
              className={`w-11 h-11 rounded-full border-2 transition ${
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
            className="w-11 h-11 rounded-full cursor-pointer border-0 bg-transparent"
            aria-label="Couleur personnalisée"
          />
        </div>
      </Field>

      <Field label="Emoji (optionnel)">
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={() => setEmoji(undefined)}
            aria-pressed={!emoji}
            aria-label="Aucun emoji"
            className={`w-11 h-11 rounded-md border flex items-center justify-center text-text-secondaire ${
              !emoji ? "border-accent-chaud" : "border-bordure"
            }`}
            title="Aucun"
          >
            <X size={14} aria-hidden="true" />
          </button>
          {EMOJIS_PRESET.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              aria-label={`Emoji ${e}`}
              className={`w-11 h-11 rounded-md border flex items-center justify-center text-xl transition ${
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

      <ChipsField
        label="Règles ménage"
        placeholder="ex: pas de plat épicé le soir, toujours un féculent au dej"
        chips={reglesMenage}
        onChange={setReglesMenage}
        hint="Mets ici les règles structurées (instructions), pas dans les notes libres."
      />

      <ContraintesMedicalesEditor rows={contraintesMedicales} onChange={setContraintesMedicales} />

      <TolerancesEditor rows={tolerances} onChange={setTolerances} />

      <AbsencesEditor rows={absences} onChange={setAbsences} />

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          className="input"
          placeholder="ex: ne mange pas de légumineuses entières — ballonnements ; OK houmous"
        />
        <span className="block text-xs text-text-secondaire mt-1">
          Notes = informations descriptives uniquement, pas d'instructions (utilise Règles ménage
          pour des règles).
        </span>
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
  hint,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  onChange: (v: string[]) => void;
  hint?: string;
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
        {hint && <span className="block text-xs text-text-secondaire">{hint}</span>}
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
                  <X size={12} aria-hidden="true" />
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
            <Plus size={14} aria-hidden="true" />
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

/** Variante compacte de ChipsField (sans wrapper Field), pour les sous-listes. */
function MiniChips({
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

  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-text-secondaire">{label}</span>
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
                onClick={() => onChange(chips.filter((_, idx) => idx !== i))}
                className="text-text-secondaire hover:text-accent-chaud"
                aria-label={`Retirer ${c}`}
              >
                <X size={12} aria-hidden="true" />
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
          <Plus size={14} aria-hidden="true" />
          Ajouter
        </button>
      </div>
    </div>
  );
}

function ContraintesMedicalesEditor({
  rows,
  onChange,
}: {
  rows: ContrainteMedicale[];
  onChange: (v: ContrainteMedicale[]) => void;
}) {
  function update(i: number, patch: Partial<ContrainteMedicale>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function addRow() {
    onChange([...rows, { terme: "", type: "medical" }]);
  }

  return (
    <Field label="Contraintes médicales / strictes (bloquant)">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-md border border-bordure p-2 space-y-2"
          >
            <div className="flex gap-2 items-start">
              <input
                type="text"
                value={row.terme}
                onChange={(e) => update(i, { terme: e.target.value })}
                className="input flex-1"
                placeholder="ex: arachides, gluten"
              />
              <select
                value={row.type ?? "medical"}
                onChange={(e) =>
                  update(i, { type: e.target.value as "medical" | "strict" })
                }
                className="input w-32"
                aria-label="Type de contrainte"
              >
                <option value="medical">Médical</option>
                <option value="strict">Strict</option>
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="btn-secondary text-sm px-2"
                aria-label="Retirer cette contrainte"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <input
              type="text"
              value={row.adaptation ?? ""}
              onChange={(e) => update(i, { adaptation: e.target.value })}
              className="input w-full"
              placeholder="Adaptation (optionnel) — ex: remplacer par tofu"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          <Plus size={14} aria-hidden="true" />
          Ajouter une contrainte
        </button>
      </div>
    </Field>
  );
}

function TolerancesEditor({
  rows,
  onChange,
}: {
  rows: Tolerance[];
  onChange: (v: Tolerance[]) => void;
}) {
  function update(i: number, patch: Partial<Tolerance>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function addRow() {
    onChange([...rows, { terme: "", formesInterdites: [], formesAutorisees: [] }]);
  }

  return (
    <Field label="Tolérances digestives (conditionnel)">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-md border border-bordure p-2 space-y-2"
          >
            <div className="flex gap-2 items-start">
              <input
                type="text"
                value={row.terme}
                onChange={(e) => update(i, { terme: e.target.value })}
                className="input flex-1"
                placeholder="ex: légumineuses"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="btn-secondary text-sm px-2"
                aria-label="Retirer cette tolérance"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <MiniChips
              label="Formes interdites"
              placeholder="ex: entières"
              chips={row.formesInterdites}
              onChange={(v) => update(i, { formesInterdites: v })}
            />
            <MiniChips
              label="Formes autorisées"
              placeholder="ex: mixées, houmous"
              chips={row.formesAutorisees}
              onChange={(v) => update(i, { formesAutorisees: v })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          <Plus size={14} aria-hidden="true" />
          Ajouter une tolérance
        </button>
      </div>
    </Field>
  );
}

function RepasMultiSelect({
  selected,
  onChange,
}: {
  selected: RepasKey[];
  onChange: (v: RepasKey[]) => void;
}) {
  function toggle(k: RepasKey) {
    onChange(selected.includes(k) ? selected.filter((r) => r !== k) : [...selected, k]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {REPAS_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => toggle(o.key)}
          aria-pressed={selected.includes(o.key)}
          className={`px-2.5 py-1 rounded-full text-sm border transition ${
            selected.includes(o.key)
              ? "border-accent-chaud bg-bordure"
              : "border-bordure hover:bg-bordure"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AbsencesEditor({
  rows,
  onChange,
}: {
  rows: Absence[];
  onChange: (v: Absence[]) => void;
}) {
  function update(i: number, next: Absence) {
    onChange(rows.map((r, idx) => (idx === i ? next : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function addRow() {
    onChange([...rows, { kind: "interval", profilId: "", from: "", to: "", repas: [] }]);
  }
  function changeKind(i: number, kind: Absence["kind"]) {
    const next: Absence =
      kind === "interval"
        ? { kind: "interval", profilId: "", from: "", to: "", repas: [] }
        : { kind: "recurring", profilId: "", weekdays: [], repas: [] };
    update(i, next);
  }

  return (
    <Field label="Absences">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-bordure p-2 space-y-2">
            <div className="flex gap-2 items-center">
              <select
                value={row.kind}
                onChange={(e) => changeKind(i, e.target.value as Absence["kind"])}
                className="input w-40"
                aria-label="Type d'absence"
              >
                <option value="interval">Ponctuelle (dates)</option>
                <option value="recurring">Récurrente</option>
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="btn-secondary text-sm px-2 ml-auto"
                aria-label="Retirer cette absence"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {row.kind === "interval" ? (
              <>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="block text-xs text-text-secondaire mb-1">Du</span>
                    <input
                      type="date"
                      value={row.from}
                      onChange={(e) => update(i, { ...row, from: e.target.value })}
                      className="input w-full"
                    />
                  </label>
                  <label className="flex-1">
                    <span className="block text-xs text-text-secondaire mb-1">Au</span>
                    <input
                      type="date"
                      value={row.to}
                      onChange={(e) => update(i, { ...row, to: e.target.value })}
                      className="input w-full"
                    />
                  </label>
                </div>
                <div>
                  <span className="block text-xs text-text-secondaire mb-1">
                    Repas (optionnel — vide = tous)
                  </span>
                  <RepasMultiSelect
                    selected={row.repas ?? []}
                    onChange={(v) =>
                      update(i, { ...row, repas: v.length > 0 ? v : undefined })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="block text-xs text-text-secondaire mb-1">Jours</span>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_OPTIONS.map((d) => {
                      const active = row.weekdays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() =>
                            update(i, {
                              ...row,
                              weekdays: active
                                ? row.weekdays.filter((w) => w !== d.value)
                                : [...row.weekdays, d.value],
                            })
                          }
                          aria-pressed={active}
                          className={`px-2.5 py-1 rounded-full text-sm border transition ${
                            active
                              ? "border-accent-chaud bg-bordure"
                              : "border-bordure hover:bg-bordure"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <span className="block text-xs text-text-secondaire mb-1">Repas</span>
                  <RepasMultiSelect
                    selected={row.repas}
                    onChange={(v) => update(i, { ...row, repas: v })}
                  />
                </div>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          <Plus size={14} aria-hidden="true" />
          Ajouter une absence
        </button>
      </div>
    </Field>
  );
}
