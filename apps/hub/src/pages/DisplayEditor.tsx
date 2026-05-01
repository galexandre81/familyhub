import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, X } from "lucide-react";
import type { DisplayLayoutEntry, TilePosition } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useDisplay,
  useTiles,
} from "../lib/queries";
import { useRefreshWeatherTile, useUpdateDisplayLayout } from "../lib/mutations";
import SetupTokenModal from "../components/SetupTokenModal";

export default function DisplayEditor() {
  const { displayId } = useParams();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: display } = useDisplay(householdId, displayId);
  const { data: tiles } = useTiles(householdId);
  const updateLayout = useUpdateDisplayLayout();
  const refreshWeather = useRefreshWeatherTile();

  const [layout, setLayout] = useState<DisplayLayoutEntry[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  useEffect(() => {
    if (display?.layout) setLayout(display.layout);
  }, [display?.layout]);

  if (!householdId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Écran</h1>
        <p className="text-text-secondaire">Crée d'abord un foyer.</p>
      </div>
    );
  }

  if (!display) {
    return <p className="text-text-secondaire">Chargement de l'écran…</p>;
  }

  const cols = display.gridConfig.cols;
  const rows = display.gridConfig.rows;
  const tilesById = new Map(tiles?.map((t) => [t.id, t]) ?? []);
  const usedTileIds = new Set(layout.map((e) => e.tileId));
  const availableTiles = (tiles ?? []).filter((t) => !usedTileIds.has(t.id));

  function addTileToLayout(tileId: string) {
    const next = findFreeSpot(layout, cols, rows);
    if (!next) {
      window.alert("Plus de place dans la grille. Retire une tuile ou agrandis la grille.");
      return;
    }
    setLayout([...layout, { tileId, position: next }]);
  }

  function removeFromLayout(tileId: string) {
    setLayout(layout.filter((e) => e.tileId !== tileId));
  }

  function updatePosition(tileId: string, patch: Partial<TilePosition>) {
    setLayout(
      layout.map((e) =>
        e.tileId === tileId ? { ...e, position: { ...e.position, ...patch } } : e,
      ),
    );
  }

  function save() {
    void updateLayout.mutate({ householdId: householdId!, displayId: display!.id, layout });
  }

  async function refreshTilesData() {
    setRefreshStatus(null);
    const weatherTilesInLayout = layout
      .map((e) => tilesById.get(e.tileId))
      .filter((t): t is NonNullable<typeof t> => !!t && t.type === "weather");
    if (weatherTilesInLayout.length === 0) {
      setRefreshStatus("Aucune tuile météo dans le layout.");
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const t of weatherTilesInLayout) {
      try {
        await refreshWeather.mutateAsync({ householdId: householdId!, tileId: t.id });
        ok++;
      } catch {
        fail++;
      }
    }
    setRefreshStatus(
      fail === 0
        ? `${ok} tuile${ok > 1 ? "s" : ""} météo rafraîchie${ok > 1 ? "s" : ""}.`
        : `${ok} OK, ${fail} échec(s).`,
    );
    setTimeout(() => setRefreshStatus(null), 4000);
  }

  const dirty = JSON.stringify(layout) !== JSON.stringify(display.layout);

  return (
    <div className="space-y-6">
      <Link to="/displays" className="text-sm text-text-secondaire hover:text-accent-chaud flex items-center gap-1">
        <ArrowLeft size={14} /> Retour aux écrans
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl">{display.nom}</h1>
          <p className="text-text-secondaire mt-1">
            {display.type} · {display.resolution.w}×{display.resolution.h} ·{" "}
            grille {cols}×{rows}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshTilesData}
            disabled={refreshWeather.isPending}
            className="btn-secondary flex items-center gap-1"
            title="Force le pré-calcul météo (Open-Meteo)"
          >
            <RefreshCw size={14} className={refreshWeather.isPending ? "animate-spin" : ""} />
            Rafraîchir
          </button>
          <button
            onClick={() => setSetupOpen(true)}
            className="btn-secondary"
          >
            Configurer cet écran
          </button>
          <button
            onClick={save}
            disabled={!dirty || updateLayout.isPending}
            className="btn-primary disabled:opacity-50"
          >
            {updateLayout.isPending ? "Sauvegarde…" : dirty ? "Enregistrer" : "À jour"}
          </button>
        </div>
      </header>

      {refreshStatus && (
        <p className="text-sm text-accent-secondaire">{refreshStatus}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-xl">Aperçu de la grille</h2>
        <GridPreview cols={cols} rows={rows} layout={layout} tilesById={tilesById} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Tuiles dans le layout</h2>
        {layout.length === 0 ? (
          <p className="text-text-secondaire text-sm">Aucune tuile assignée.</p>
        ) : (
          <ul className="space-y-2">
            {layout.map((entry) => {
              const tile = tilesById.get(entry.tileId);
              return (
                <li key={entry.tileId} className="tile-card flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">{tile?.nom ?? "(tuile supprimée)"}</p>
                    <p className="text-xs text-text-secondaire">{tile?.type}</p>
                  </div>
                  <PositionInputs
                    cols={cols}
                    rows={rows}
                    position={entry.position}
                    onChange={(patch) => updatePosition(entry.tileId, patch)}
                  />
                  <button
                    onClick={() => removeFromLayout(entry.tileId)}
                    className="text-text-secondaire hover:text-accent-chaud"
                    aria-label="Retirer du layout"
                  >
                    <X size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Tuiles disponibles</h2>
        {availableTiles.length === 0 ? (
          <p className="text-text-secondaire text-sm">
            Toutes les tuiles sont déjà dans le layout.{" "}
            <Link to="/tiles" className="text-accent-chaud">Crée-en une nouvelle</Link>.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableTiles.map((t) => (
              <li key={t.id} className="tile-card flex items-center justify-between">
                <div>
                  <p className="tile-title m-0">{t.type}</p>
                  <p className="font-semibold">{t.nom}</p>
                </div>
                <button
                  onClick={() => addTileToLayout(t.id)}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {setupOpen && (
        <SetupTokenModal
          householdId={householdId}
          displayId={display.id}
          displayNom={display.nom}
          onClose={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}

function PositionInputs({
  cols,
  rows,
  position,
  onChange,
}: {
  cols: number;
  rows: number;
  position: TilePosition;
  onChange: (patch: Partial<TilePosition>) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      <Num label="col" max={cols - 1} value={position.col} onChange={(v) => onChange({ col: v })} />
      <Num label="row" max={rows - 1} value={position.row} onChange={(v) => onChange({ row: v })} />
      <Num label="w" min={1} max={cols} value={position.w} onChange={(v) => onChange({ w: v })} />
      <Num label="h" min={1} max={rows} value={position.h} onChange={(v) => onChange({ h: v })} />
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="block text-text-secondaire text-[10px] uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input w-16 px-2 py-1 text-sm"
      />
    </label>
  );
}

function GridPreview({
  cols,
  rows,
  layout,
  tilesById,
}: {
  cols: number;
  rows: number;
  layout: DisplayLayoutEntry[];
  tilesById: Map<string, { type: string; nom: string }>;
}) {
  return (
    <div
      className="relative bg-bg-card border border-bordure rounded-tile overflow-hidden"
      style={{ aspectRatio: `${cols} / ${rows}` }}
    >
      {/* grid lines */}
      {Array.from({ length: cols + 1 }, (_, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 border-l border-bordure/40"
          style={{ left: `${(i / cols) * 100}%` }}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-bordure/40"
          style={{ top: `${(i / rows) * 100}%` }}
        />
      ))}
      {layout.map((entry) => {
        const tile = tilesById.get(entry.tileId);
        const p = entry.position;
        return (
          <div
            key={entry.tileId}
            className="absolute bg-accent-chaud/10 border border-accent-chaud rounded-md flex flex-col items-center justify-center text-center p-2"
            style={{
              left: `${(p.col / cols) * 100}%`,
              top: `${(p.row / rows) * 100}%`,
              width: `${(p.w / cols) * 100}%`,
              height: `${(p.h / rows) * 100}%`,
            }}
          >
            <p className="text-xs text-accent-chaud font-semibold truncate w-full">
              {tile?.nom ?? "?"}
            </p>
            <p className="text-[10px] text-text-secondaire">{tile?.type}</p>
          </div>
        );
      })}
    </div>
  );
}

function findFreeSpot(
  layout: DisplayLayoutEntry[],
  cols: number,
  rows: number,
): TilePosition | null {
  const occupied = new Set<string>();
  for (const e of layout) {
    for (let c = e.position.col; c < e.position.col + e.position.w; c++) {
      for (let r = e.position.row; r < e.position.row + e.position.h; r++) {
        occupied.add(`${c},${r}`);
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied.has(`${c},${r}`)) {
        return { col: c, row: r, w: 1, h: 1 };
      }
    }
  }
  return null;
}
