import { useState, type FormEvent } from "react";
import type {
  CalendarConfig,
  ClockConfig,
  LivreRecettesConfig,
  RadioConfig,
  RadioStation,
  RecipeTodayConfig,
  TileType,
  TimerConfig,
  TimerPreset,
  WeatherConfig,
  WeatherLocation,
} from "@family-hub/types";
import {
  defaultCalendarConfig,
  defaultClockConfig,
  defaultLivreRecettesConfig,
  defaultRadioStations,
  defaultRecipeTodayConfig,
  defaultTimerPresets,
} from "@family-hub/types";
import {
  useCreateTile,
  useRefreshRecipeTodayTile,
  useRefreshWeeklyMenuTile,
  useSyncCalendarTile,
} from "../lib/mutations";
import { searchCity, formatCityLabel, type GeocodingResult } from "../lib/geocoding";
import { Trash2, Plus, Search, Star } from "lucide-react";

interface TileFormProps {
  householdId: string;
  /** Localisation par défaut du foyer pour pré-remplir weather */
  defaultLocation?: { ville: string; lat: number; lon: number };
  onCreated?: (tileId: string) => void;
  onCancel?: () => void;
}

const SUPPORTED_TYPES: TileType[] = [
  "clock",
  "weather",
  "calendar",
  "radio",
  "timer",
  "livre-recettes",
  "recipe-today",
  "weekly-menu",
];

const TYPE_LABELS: Partial<Record<TileType, string>> = {
  clock: "Horloge",
  weather: "Météo",
  calendar: "Calendrier",
  radio: "Radio",
  timer: "Minuteur",
  "livre-recettes": "Livre de recettes",
  "recipe-today": "Recette du jour",
  "weekly-menu": "Menu de la semaine",
};

const DEFAULT_REFRESH: Partial<Record<TileType, number>> = {
  clock: 0,
  weather: 1800,
  calendar: 900,
  radio: 0,
  timer: 0,
  "livre-recettes": 0,
  "recipe-today": 1800,
  "weekly-menu": 3600,
};

export default function TileForm({
  householdId,
  defaultLocation,
  onCreated,
  onCancel,
}: TileFormProps) {
  const create = useCreateTile();
  const [type, setType] = useState<TileType>("clock");
  const [nom, setNom] = useState("Horloge");
  const [error, setError] = useState<string | null>(null);

  // configs par type — séparées pour préserver les valeurs si on change de type
  const [clockCfg, setClockCfg] = useState<ClockConfig>(defaultClockConfig);
  const defaultLocId = `loc-${Date.now()}`;
  const [weatherCfg, setWeatherCfg] = useState<WeatherConfig>({
    locations: [
      {
        id: defaultLocId,
        ville: defaultLocation?.ville ?? "Le Brassus",
        lat: defaultLocation?.lat ?? 46.5833,
        lon: defaultLocation?.lon ?? 6.1833,
      },
    ],
    selectedLocationId: defaultLocId,
    forecastHours: [0, 6, 12],
  });
  const [radioCfg, setRadioCfg] = useState<RadioConfig>({
    stations: defaultRadioStations,
    defaultStationId: defaultRadioStations[0]?.id ?? "",
  });
  const [timerCfg, setTimerCfg] = useState<TimerConfig>({
    presets: defaultTimerPresets,
  });
  const [calendarCfg, setCalendarCfg] = useState<CalendarConfig>(defaultCalendarConfig);
  const [livreCfg, setLivreCfg] = useState<LivreRecettesConfig>(defaultLivreRecettesConfig);
  // Pas d'UI fields exposés pour recipe-today : on prend les défauts.
  const recipeTodayCfg: RecipeTodayConfig = defaultRecipeTodayConfig;

  const syncCalendar = useSyncCalendarTile();
  const refreshRecipeToday = useRefreshRecipeTodayTile();
  const refreshWeeklyMenu = useRefreshWeeklyMenuTile();

  function handleTypeChange(t: TileType) {
    setType(t);
    setNom(defaultNomFor(t, defaultLocation?.ville));
  }

  function getConfig(): Record<string, unknown> {
    switch (type) {
      case "clock":
        return clockCfg as unknown as Record<string, unknown>;
      case "weather":
        return weatherCfg as unknown as Record<string, unknown>;
      case "radio":
        return radioCfg as unknown as Record<string, unknown>;
      case "timer":
        return timerCfg as unknown as Record<string, unknown>;
      case "calendar":
        return calendarCfg as unknown as Record<string, unknown>;
      case "livre-recettes":
        return livreCfg as unknown as Record<string, unknown>;
      case "recipe-today":
        return recipeTodayCfg as unknown as Record<string, unknown>;
      default:
        return {};
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) {
      setError("Le nom de la tuile est requis");
      return;
    }
    try {
      const id = await create.mutateAsync({
        householdId,
        type,
        nom: nom.trim(),
        config: getConfig(),
        refreshIntervalSeconds: DEFAULT_REFRESH[type] ?? 0,
      });
      // Sync initiale calendrier — sinon le 1er affichage attend le scheduler 15 min.
      if (type === "calendar") {
        try {
          await syncCalendar.mutateAsync({ householdId, tileId: id });
        } catch (err) {
          // Non bloquant : la tuile est créée, le scheduler la couvrira au pire dans 15 min.
          console.warn("Sync initiale calendrier échouée", err);
        }
      }
      // Refresh initial recipe-today — sinon le 1er affichage attend 30 min.
      if (type === "recipe-today") {
        try {
          await refreshRecipeToday.mutateAsync({ householdId, tileId: id });
        } catch (err) {
          console.warn("Refresh initial recipe-today échoué", err);
        }
      }
      if (type === "weekly-menu") {
        try {
          await refreshWeeklyMenu.mutateAsync({ householdId, tileId: id });
        } catch (err) {
          console.warn("Refresh initial weekly-menu échoué", err);
        }
      }
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">Nouvelle tuile</h2>
        <p className="text-text-secondaire text-sm">
          La tuile devient utilisable après avoir été ajoutée au layout d'un écran.
        </p>
      </div>

      <Field label="Type">
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as TileType)}
          className="input"
        >
          {SUPPORTED_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Nom" required>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="input"
        />
      </Field>

      {type === "clock" && (
        <ClockFields config={clockCfg} onChange={setClockCfg} />
      )}
      {type === "weather" && (
        <WeatherFields config={weatherCfg} onChange={setWeatherCfg} />
      )}
      {type === "radio" && (
        <RadioFields config={radioCfg} onChange={setRadioCfg} />
      )}
      {type === "timer" && (
        <TimerFields config={timerCfg} onChange={setTimerCfg} />
      )}
      {type === "calendar" && (
        <CalendarFields config={calendarCfg} onChange={setCalendarCfg} />
      )}
      {type === "livre-recettes" && (
        <LivreRecettesFields config={livreCfg} onChange={setLivreCfg} />
      )}

      {error && <p className="text-accent-chaud text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? "Création…" : "Créer la tuile"}
        </button>
      </div>
    </form>
  );
}

function defaultNomFor(type: TileType, ville?: string): string {
  if (type === "clock") return "Horloge";
  if (type === "weather") return ville ? `Météo ${ville}` : "Météo";
  if (type === "radio") return "Radio";
  if (type === "timer") return "Minuteur";
  if (type === "calendar") return "Calendrier famille";
  if (type === "livre-recettes") return "Livre de recettes";
  if (type === "recipe-today") return "Recette du jour";
  if (type === "weekly-menu") return "Menu de la semaine";
  return "Tuile";
}

function LivreRecettesFields({
  config,
  onChange,
}: {
  config: LivreRecettesConfig;
  onChange: (c: LivreRecettesConfig) => void;
}) {
  const [tagInput, setTagInput] = useState("");

  function addTag() {
    const v = tagInput.trim();
    if (!v) return;
    if (config.filtreTags.includes(v)) {
      setTagInput("");
      return;
    }
    onChange({ ...config, filtreTags: [...config.filtreTags, v] });
    setTagInput("");
  }

  function removeTag(t: string) {
    onChange({ ...config, filtreTags: config.filtreTags.filter((x) => x !== t) });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondaire">
        La tuile affiche le compteur de recettes du foyer et les 3 dernières. Le tap ouvre la
        recherche plein écran avec filtres par tag.
      </p>

      <Field label="Filtre par tags (vide = toutes les recettes)">
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className="input flex-1"
            placeholder="ex: végétarien, rapide…"
          />
          <button
            type="button"
            onClick={addTag}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Ajouter
          </button>
        </div>
        {config.filtreTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {config.filtreTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => removeTag(t)}
                className="text-xs px-2 py-1 rounded-full border border-bordure hover:border-accent-chaud flex items-center gap-1"
              >
                {t}
                <Trash2 size={12} />
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Tri">
        <select
          value={config.tri}
          onChange={(e) =>
            onChange({ ...config, tri: e.target.value as LivreRecettesConfig["tri"] })
          }
          className="input"
        >
          <option value="recente">Plus récentes d'abord</option>
          <option value="alpha">Alphabétique</option>
          <option value="notation">Notation décroissante</option>
        </select>
      </Field>
    </div>
  );
}

function CalendarFields({
  config,
  onChange,
}: {
  config: CalendarConfig;
  onChange: (c: CalendarConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondaire">
        Le flux iCal du calendrier Google familial est stocké côté serveur (Secret Manager).
        Pour ajouter ou changer le calendrier source, il faut redéployer le secret
        <code className="mx-1 px-1 bg-bordure rounded">CALENDAR_ICAL_URL</code>.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horizon (jours)">
          <input
            type="number"
            min={1}
            max={90}
            value={config.daysAhead}
            onChange={(e) =>
              onChange({ ...config, daysAhead: Math.max(1, parseInt(e.target.value, 10) || 21) })
            }
            className="input"
          />
        </Field>
        <Field label="Nombre max d'événements">
          <input
            type="number"
            min={1}
            max={100}
            value={config.maxEvents}
            onChange={(e) =>
              onChange({ ...config, maxEvents: Math.max(1, parseInt(e.target.value, 10) || 60) })
            }
            className="input"
          />
        </Field>
      </div>
    </div>
  );
}

function TimerFields({
  config,
  onChange,
}: {
  config: TimerConfig;
  onChange: (c: TimerConfig) => void;
}) {
  function updatePreset(idx: number, patch: Partial<TimerPreset>) {
    const presets = [...config.presets];
    presets[idx] = { ...presets[idx], ...patch };
    onChange({ ...config, presets });
  }

  function removePreset(idx: number) {
    onChange({ ...config, presets: config.presets.filter((_, i) => i !== idx) });
  }

  function addPreset() {
    const id = `p-${Date.now()}`;
    onChange({
      ...config,
      presets: [...config.presets, { id, label: "Nouveau preset", seconds: 300 }],
    });
  }

  function fmtMinSec(seconds: number): { mins: number; secs: number } {
    return { mins: Math.floor(seconds / 60), secs: seconds % 60 };
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondaire">
        Les presets apparaîtront en boutons "Démarrage rapide" sur l'iPad. Sur l'écran tu pourras
        aussi lancer un minuteur custom directement.
      </p>

      <div className="space-y-2">
        {config.presets.map((p, idx) => {
          const { mins, secs } = fmtMinSec(p.seconds);
          return (
            <div key={p.id} className="flex gap-2 items-center">
              <input
                type="text"
                value={p.label}
                onChange={(e) => updatePreset(idx, { label: e.target.value })}
                className="input flex-1"
                placeholder="Label (Pâtes, Thé…)"
              />
              <input
                type="number"
                min={0}
                value={mins}
                onChange={(e) => updatePreset(idx, { seconds: Number(e.target.value) * 60 + secs })}
                className="input w-20 text-center"
                placeholder="min"
              />
              <span className="text-text-secondaire text-xs">min</span>
              <input
                type="number"
                min={0}
                max={59}
                value={secs}
                onChange={(e) => updatePreset(idx, { seconds: mins * 60 + Number(e.target.value) })}
                className="input w-20 text-center"
                placeholder="sec"
              />
              <span className="text-text-secondaire text-xs">sec</span>
              <button
                type="button"
                onClick={() => removePreset(idx)}
                className="text-text-secondaire hover:text-accent-chaud p-2"
                aria-label="Supprimer ce preset"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addPreset}
        className="btn-secondary text-sm flex items-center gap-1"
      >
        <Plus size={14} />
        Ajouter un preset
      </button>
    </div>
  );
}

function ClockFields({
  config,
  onChange,
}: {
  config: ClockConfig;
  onChange: (c: ClockConfig) => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <Field label="Format">
        <select
          value={config.format}
          onChange={(e) => onChange({ ...config, format: e.target.value as "24h" | "12h" })}
          className="input"
        >
          <option value="24h">24h</option>
          <option value="12h">12h (AM/PM)</option>
        </select>
      </Field>
      <Field label="Format date">
        <select
          value={config.dateFormat}
          onChange={(e) =>
            onChange({ ...config, dateFormat: e.target.value as "long" | "short" })
          }
          className="input"
        >
          <option value="long">Long (lundi 1 mai 2026)</option>
          <option value="short">Court (01/05/2026)</option>
        </select>
      </Field>
      <Checkbox
        label="Afficher les secondes"
        checked={config.showSeconds}
        onChange={(v) => onChange({ ...config, showSeconds: v })}
      />
      <Checkbox
        label="Afficher la date"
        checked={config.showDate}
        onChange={(v) => onChange({ ...config, showDate: v })}
      />
    </fieldset>
  );
}

function WeatherFields({
  config,
  onChange,
}: {
  config: WeatherConfig;
  onChange: (c: WeatherConfig) => void;
}) {
  function updateLocation(idx: number, patch: Partial<WeatherLocation>) {
    const locations = [...config.locations];
    locations[idx] = { ...locations[idx], ...patch };
    onChange({ ...config, locations });
  }

  function removeLocation(idx: number) {
    const locations = config.locations.filter((_, i) => i !== idx);
    let selectedLocationId = config.selectedLocationId;
    if (!locations.find((l) => l.id === selectedLocationId)) {
      selectedLocationId = locations[0]?.id ?? "";
    }
    onChange({ ...config, locations, selectedLocationId });
  }

  function addLocation() {
    const id = `loc-${Date.now()}`;
    onChange({
      ...config,
      locations: [
        ...config.locations,
        { id, ville: "", lat: 0, lon: 0 },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondaire">
        Ajoute autant de villes que tu veux. La ⭐ est celle affichée dans la tuile principale —
        tu pourras en changer en touchant la tuile sur l'iPad.
      </p>

      <div className="space-y-3">
        {config.locations.map((loc, idx) => (
          <LocationRow
            key={loc.id}
            location={loc}
            isSelected={loc.id === config.selectedLocationId}
            onChange={(patch) => updateLocation(idx, patch)}
            onSelect={() => onChange({ ...config, selectedLocationId: loc.id })}
            onRemove={config.locations.length > 1 ? () => removeLocation(idx) : undefined}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addLocation}
        className="btn-secondary text-sm flex items-center gap-1"
      >
        <Plus size={14} />
        Ajouter une ville
      </button>

      <Field label="Heures de prévision (séparées par virgule)">
        <input
          type="text"
          value={config.forecastHours.join(", ")}
          onChange={(e) =>
            onChange({
              ...config,
              forecastHours: e.target.value
                .split(",")
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n)),
            })
          }
          className="input"
          placeholder="0, 6, 12"
        />
      </Field>
    </div>
  );
}

function LocationRow({
  location,
  isSelected,
  onChange,
  onSelect,
  onRemove,
}: {
  location: WeatherLocation;
  isSelected: boolean;
  onChange: (patch: Partial<WeatherLocation>) => void;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GeocodingResult[] | null>(null);

  async function geocode() {
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const r = await searchCity(location.ville);
      if (r.length === 0) {
        setSearchError("Aucun résultat");
      } else if (r.length === 1) {
        applyResult(r[0]);
      } else {
        setSearchResults(r);
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSearching(false);
    }
  }

  function applyResult(r: GeocodingResult) {
    onChange({ ville: r.name, pays: r.country, lat: r.latitude, lon: r.longitude, timezone: r.timezone });
    setSearchResults(null);
  }

  return (
    <div className={`tile-card !p-3 space-y-2 ${isSelected ? "ring-2 ring-accent-chaud" : ""}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onSelect}
          className={isSelected ? "text-accent-chaud" : "text-text-secondaire hover:text-accent-chaud"}
          title={isSelected ? "Affichée dans la tuile" : "Choisir comme affichage principal"}
        >
          <Star size={18} fill={isSelected ? "currentColor" : "none"} />
        </button>
        <div className="flex-1 grid grid-cols-3 gap-2 items-end">
          <div className="col-span-3 flex gap-2">
            <input
              type="text"
              value={location.ville}
              onChange={(e) => onChange({ ville: e.target.value })}
              className="input flex-1"
              placeholder="Nom de la ville"
            />
            <button
              type="button"
              onClick={geocode}
              disabled={searching || !location.ville.trim()}
              className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap"
            >
              <Search size={12} />
              {searching ? "…" : "GPS"}
            </button>
          </div>
          <div>
            <span className="block text-[10px] text-text-secondaire">Latitude</span>
            <input
              type="number"
              step="0.0001"
              value={location.lat}
              onChange={(e) => onChange({ lat: Number(e.target.value) })}
              className="input text-xs"
            />
          </div>
          <div>
            <span className="block text-[10px] text-text-secondaire">Longitude</span>
            <input
              type="number"
              step="0.0001"
              value={location.lon}
              onChange={(e) => onChange({ lon: Number(e.target.value) })}
              className="input text-xs"
            />
          </div>
          <div>
            <span className="block text-[10px] text-text-secondaire">Pays</span>
            <input
              type="text"
              value={location.pays ?? ""}
              onChange={(e) => onChange({ pays: e.target.value })}
              className="input text-xs"
            />
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-text-secondaire hover:text-accent-chaud p-1"
            aria-label="Supprimer cette ville"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {searchError && <p className="text-accent-chaud text-xs">{searchError}</p>}

      {searchResults && searchResults.length > 1 && (
        <div className="border border-bordure rounded-md p-2 space-y-1 bg-bg-principal">
          <p className="text-xs text-text-secondaire mb-1">Plusieurs résultats :</p>
          {searchResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => applyResult(r)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-bordure text-xs"
            >
              {formatCityLabel(r)}
              {r.population ? ` · ${(r.population / 1000).toFixed(0)}k hab.` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RadioFields({
  config,
  onChange,
}: {
  config: RadioConfig;
  onChange: (c: RadioConfig) => void;
}) {
  function updateStation(idx: number, patch: Partial<RadioStation>) {
    const stations = [...config.stations];
    stations[idx] = { ...stations[idx], ...patch };
    onChange({ ...config, stations });
  }
  function removeStation(idx: number) {
    const stations = config.stations.filter((_, i) => i !== idx);
    let defaultStationId = config.defaultStationId;
    if (!stations.find((s) => s.id === defaultStationId)) {
      defaultStationId = stations[0]?.id ?? "";
    }
    onChange({ ...config, stations, defaultStationId });
  }
  function addStation() {
    const id = `station-${Date.now()}`;
    onChange({
      ...config,
      stations: [...config.stations, { id, nom: "Nouvelle station", url: "" }],
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {config.stations.map((s, idx) => (
          <div key={s.id} className="flex gap-2 items-start">
            <input
              type="text"
              value={s.nom}
              onChange={(e) => updateStation(idx, { nom: e.target.value })}
              className="input flex-1"
              placeholder="Nom"
            />
            <input
              type="url"
              value={s.url}
              onChange={(e) => updateStation(idx, { url: e.target.value })}
              className="input flex-[2]"
              placeholder="https://stream…"
            />
            <button
              type="button"
              onClick={() => removeStation(idx)}
              className="text-text-secondaire hover:text-accent-chaud p-2"
              aria-label="Supprimer cette station"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addStation} className="btn-secondary text-sm flex items-center gap-1">
        <Plus size={14} />
        Ajouter une station
      </button>

      <Field label="Station par défaut">
        <select
          value={config.defaultStationId}
          onChange={(e) => onChange({ ...config, defaultStationId: e.target.value })}
          className="input"
        >
          {config.stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
      </Field>
    </div>
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded text-accent-chaud focus:ring-accent-chaud"
      />
      {label}
    </label>
  );
}
