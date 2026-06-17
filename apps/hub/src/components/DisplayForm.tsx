import { useState, type FormEvent } from "react";
import type { DisplayDeviceType, GridConfig, Resolution, Theme } from "@family-hub/types";
import { useCreateDisplay } from "../lib/mutations";

interface DisplayFormProps {
  householdId: string;
  onCreated?: (displayId: string) => void;
  onCancel?: () => void;
}

const PRESETS: Record<DisplayDeviceType, { resolution: Resolution; gridConfig: GridConfig }> = {
  "ipad-mini-1": { resolution: { w: 1024, h: 768 }, gridConfig: { cols: 4, rows: 3, gap: 16 } },
  "modern-tablet": { resolution: { w: 1280, h: 800 }, gridConfig: { cols: 4, rows: 3, gap: 16 } },
  desktop: { resolution: { w: 1920, h: 1080 }, gridConfig: { cols: 6, rows: 4, gap: 20 } },
  mobile: { resolution: { w: 375, h: 667 }, gridConfig: { cols: 2, rows: 4, gap: 12 } },
};

const TYPE_LABELS: Record<DisplayDeviceType, string> = {
  "ipad-mini-1": "iPad mini 1 (iOS 9)",
  "modern-tablet": "Tablette moderne",
  desktop: "PC / écran fixe",
  mobile: "Mobile",
};

export default function DisplayForm({ householdId, onCreated, onCancel }: DisplayFormProps) {
  const create = useCreateDisplay();
  const [nom, setNom] = useState("Cuisine iPad");
  const [type, setType] = useState<DisplayDeviceType>("ipad-mini-1");
  const [resolution, setResolution] = useState<Resolution>(PRESETS["ipad-mini-1"].resolution);
  const [grid, setGrid] = useState<GridConfig>(PRESETS["ipad-mini-1"].gridConfig);
  const [theme, setTheme] = useState<Theme>("light");
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(t: DisplayDeviceType) {
    setType(t);
    const preset = PRESETS[t];
    setResolution(preset.resolution);
    setGrid(preset.gridConfig);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) {
      setError("Le nom de l'écran est requis");
      return;
    }
    try {
      const id = await create.mutateAsync({
        householdId,
        nom: nom.trim(),
        type,
        resolution,
        theme,
        gridConfig: grid,
      });
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">Nouvel écran</h2>
        <p className="text-text-secondaire text-sm">
          Une fois créé, tu pourras générer un lien de configuration à ouvrir sur l'appareil cible.
        </p>
      </div>

      <Field label="Nom" required>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="input"
          placeholder="Cuisine iPad, Bureau…"
          autoFocus
        />
      </Field>

      <Field label="Type d'appareil">
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as DisplayDeviceType)}
          className="input"
        >
          {(Object.keys(PRESETS) as DisplayDeviceType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Résolution de l'écran</legend>
        <Field label="Largeur (px)">
          <input
            type="number"
            value={resolution.w}
            onChange={(e) => setResolution((r) => ({ ...r, w: Number(e.target.value) }))}
            className="input"
          />
        </Field>
        <Field label="Hauteur (px)">
          <input
            type="number"
            value={resolution.h}
            onChange={(e) => setResolution((r) => ({ ...r, h: Number(e.target.value) }))}
            className="input"
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="sr-only">Disposition de la grille</legend>
        <Field label="Colonnes">
          <input
            type="number"
            min={1}
            value={grid.cols}
            onChange={(e) => setGrid((g) => ({ ...g, cols: Number(e.target.value) }))}
            className="input"
          />
        </Field>
        <Field label="Lignes">
          <input
            type="number"
            min={1}
            value={grid.rows}
            onChange={(e) => setGrid((g) => ({ ...g, rows: Number(e.target.value) }))}
            className="input"
          />
        </Field>
        <Field label="Espacement (px)">
          <input
            type="number"
            min={0}
            value={grid.gap}
            onChange={(e) => setGrid((g) => ({ ...g, gap: Number(e.target.value) }))}
            className="input"
          />
        </Field>
      </fieldset>

      <Field label="Thème">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="input"
        >
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
          <option value="auto">Automatique</option>
        </select>
      </Field>

      {error && <p className="text-accent-chaud text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? "Création…" : "Créer l'écran"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-text-secondaire mb-1">
        {label}
        {required && <span className="text-accent-chaud"> *</span>}
      </span>
      {children}
    </label>
  );
}
