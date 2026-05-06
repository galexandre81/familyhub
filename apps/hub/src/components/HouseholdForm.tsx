import { useState, type FormEvent } from "react";
import { Search, Check } from "lucide-react";
import type { HouseholdParametres } from "@family-hub/types";
import { useCreateHousehold, useUpdateHousehold } from "../lib/mutations";
import { searchCity, formatCityLabel, type GeocodingResult } from "../lib/geocoding";

interface HouseholdFormProps {
  uid: string;
  /** Si fourni, le formulaire est en mode édition. */
  existing?: { id: string; nom: string; parametres: HouseholdParametres };
  onSaved?: (householdId: string) => void;
  onCancel?: () => void;
}

const defaultsCreate: HouseholdParametres = {
  localisation: {
    ville: "Paris",
    pays: "France",
    lat: 48.8566,
    lon: 2.3522,
    timezone: "Europe/Paris",
  },
  langue: "fr",
  systemeUnites: "metric",
};

export default function HouseholdForm({ uid, existing, onSaved, onCancel }: HouseholdFormProps) {
  const create = useCreateHousehold();
  const update = useUpdateHousehold();
  const isEdit = !!existing;
  const pending = create.isPending || update.isPending;

  const [nom, setNom] = useState(existing?.nom ?? "Maison");
  const [params, setParams] = useState<HouseholdParametres>(
    existing?.parametres ?? defaultsCreate,
  );
  const [error, setError] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<GeocodingResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);

  function setLoc<K extends keyof HouseholdParametres["localisation"]>(
    key: K,
    value: HouseholdParametres["localisation"][K],
  ) {
    setParams((p) => ({ ...p, localisation: { ...p.localisation, [key]: value } }));
    setResolvedLabel(null);
  }

  async function handleGeocode() {
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const results = await searchCity(params.localisation.ville);
      if (results.length === 0) {
        setSearchError(`Aucun résultat pour « ${params.localisation.ville} »`);
      } else if (results.length === 1) {
        applyGeocoding(results[0]);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSearching(false);
    }
  }

  function applyGeocoding(r: GeocodingResult) {
    setParams((p) => ({
      ...p,
      localisation: {
        ...p.localisation,
        ville: r.name,
        pays: r.country,
        lat: r.latitude,
        lon: r.longitude,
        timezone: r.timezone,
      },
    }));
    setResolvedLabel(formatCityLabel(r));
    setSearchResults(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) {
      setError("Le nom du foyer est requis");
      return;
    }
    try {
      if (isEdit && existing) {
        await update.mutateAsync({
          uid,
          householdId: existing.id,
          patch: { nom: nom.trim(), parametres: params },
        });
        onSaved?.(existing.id);
      } else {
        const id = await create.mutateAsync({ uid, nom: nom.trim(), parametres: params });
        onSaved?.(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">{isEdit ? "Modifier le foyer" : "Créer un foyer"}</h2>
        <p className="text-text-secondaire text-sm">
          {isEdit
            ? "Mets à jour le nom ou la localisation."
            : "Tu pourras ajouter des écrans et des tuiles ensuite."}
        </p>
      </div>

      <Field label="Nom du foyer" required>
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="input"
          placeholder="Maison, Chalet…"
          autoFocus
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm text-text-secondaire">
          Localisation <span className="text-xs">(utilisée par la tuile météo)</span>
        </legend>

        <div className="flex gap-2 items-end">
          <Field label="Ville" className="flex-1">
            <input
              type="text"
              value={params.localisation.ville}
              onChange={(e) => setLoc("ville", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleGeocode();
                }
              }}
              className="input"
            />
          </Field>
          <button
            type="button"
            onClick={handleGeocode}
            disabled={searching || !params.localisation.ville.trim()}
            className="btn-secondary flex items-center gap-1 whitespace-nowrap h-fit"
            title="Rechercher les coordonnées GPS depuis la ville"
          >
            <Search size={14} />
            {searching ? "Recherche…" : "Rechercher"}
          </button>
        </div>

        {searchError && <p className="text-accent-chaud text-xs">{searchError}</p>}
        {resolvedLabel && (
          <p className="text-accent-secondaire text-xs flex items-center gap-1">
            <Check size={12} />
            {resolvedLabel} — coordonnées et fuseau horaire mis à jour
          </p>
        )}

        {searchResults && searchResults.length > 1 && (
          <div className="border border-bordure rounded-md p-2 space-y-1 bg-bg-principal">
            <p className="text-xs text-text-secondaire mb-1">Plusieurs résultats — choisis :</p>
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => applyGeocoding(r)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-bordure text-sm"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-text-secondaire">
                  {r.admin1 ? ` · ${r.admin1}` : ""}, {r.country}
                  {r.population ? ` · ${(r.population / 1000).toFixed(0)}k hab.` : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pays">
            <input
              type="text"
              value={params.localisation.pays}
              onChange={(e) => setLoc("pays", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Fuseau horaire">
            <input
              type="text"
              value={params.localisation.timezone}
              onChange={(e) => setLoc("timezone", e.target.value)}
              className="input"
              placeholder="Europe/Zurich"
            />
          </Field>
          <Field label="Latitude">
            <input
              type="number"
              step="0.0001"
              value={params.localisation.lat}
              onChange={(e) => setLoc("lat", Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="0.0001"
              value={params.localisation.lon}
              onChange={(e) => setLoc("lon", Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        <Field label="Langue">
          <select
            value={params.langue}
            onChange={(e) =>
              setParams((p) => ({ ...p, langue: e.target.value as "fr" | "en" }))
            }
            className="input"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
      </fieldset>

      {error && <p className="text-accent-chaud text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Sauvegarde…" : isEdit ? "Enregistrer" : "Créer le foyer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
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
