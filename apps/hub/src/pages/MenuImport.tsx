import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, usePlan, useProfils } from "../lib/queries";
import { parsePlanImport, type PlanImport } from "../lib/planImportSchema";
import { importPlanFromJson, type ImportPlanResult } from "../lib/planImporter";

export default function MenuImport() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId") ?? undefined;
  const navigate = useNavigate();

  const { data: plan, isLoading: loadingPlan } = usePlan(householdId, planId);
  const { data: profils } = useProfils(householdId);

  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[] | null>(null);
  const [validated, setValidated] = useState<PlanImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportPlanResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleValidate() {
    setErrors(null);
    setValidated(null);
    const out = parsePlanImport(raw);
    if (out.ok) {
      setValidated(out.data);
    } else {
      setErrors(out.errors);
    }
  }

  async function handleImport() {
    if (!householdId || !planId || !validated || !profils) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await importPlanFromJson({
        householdId,
        planId,
        data: validated,
        profils,
      });
      setResult(res);
      // Petit délai pour que l'utilisateur voie le récap, puis redirige.
      setTimeout(() => navigate("/menu"), 2500);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  if (!householdId) return null;
  if (!planId) {
    return (
      <div className="space-y-3">
        <p>Aucun planId dans l'URL.</p>
        <Link to="/menu" className="btn-secondary">
          Retour au menu
        </Link>
      </div>
    );
  }
  if (loadingPlan) {
    return <p className="text-cream-mute">Chargement du plan…</p>;
  }
  if (!plan) {
    return (
      <div className="space-y-3">
        <p>Plan introuvable. Il a peut-être été supprimé.</p>
        <Link to="/menu" className="btn-secondary">
          Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/menu/nouveau" className="text-cream-mute hover:text-cream">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl flex items-center gap-3">
          <Upload size={26} className="text-brass" />
          Importer le plan depuis Claude.ai
        </h1>
      </div>

      <div className="tile-card space-y-2">
        <p className="text-cream-mute text-sm">
          Colle ci-dessous le JSON renvoyé par Claude.ai. Le format est
          validé avant import. Tu peux corriger côté Claude et re-coller si la
          validation échoue.
        </p>
      </div>

      <div className="tile-card space-y-3">
        <label className="block text-sm text-cream-mute">JSON Claude.ai</label>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setValidated(null);
            setErrors(null);
            setResult(null);
            setImportError(null);
          }}
          placeholder='{"recettes": [...], "slots": [...], "shoppingList": {...}, ...}'
          rows={12}
          className="input font-mono text-xs"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleValidate}
            disabled={!raw.trim()}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Valider le JSON
          </button>
          {validated && !result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Import en cours…
                </>
              ) : (
                <>
                  <Upload size={14} /> Importer et activer le plan
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {errors && errors.length > 0 && (
        <div className="tile-card border-copper space-y-2">
          <p className="text-copper font-semibold flex items-center gap-2">
            <XCircle size={16} />
            JSON invalide ({errors.length} erreur{errors.length > 1 ? "s" : ""})
          </p>
          <ul className="space-y-1 text-sm">
            {errors.map((err, i) => (
              <li key={i} className="text-cream-mute">
                <code className="text-xs bg-ebony-ridge px-1 rounded">·</code> {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validated && !result && (
        <div className="tile-card border-sage space-y-3">
          <p className="text-sage font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            JSON valide
          </p>
          <ul className="text-sm text-cream-mute space-y-1">
            <li>{validated.recettes.length} recette{validated.recettes.length > 1 ? "s" : ""}</li>
            <li>
              {validated.batchSessions.length} session
              {validated.batchSessions.length > 1 ? "s" : ""} de batch cooking
            </li>
            <li>
              {validated.slots.length} slot
              {validated.slots.length > 1 ? "s" : ""} de repas (dont{" "}
              {validated.slots.filter((s) => s.recetteTempIds.length > 0).length}
              {" "}avec recettes)
            </li>
            <li>{validated.shoppingList.items.length} items de courses</li>
          </ul>
          {validated.commentaireGeneral && (
            <div className="border-t border-wood-dark pt-3">
              <p className="eyebrow mb-1">Commentaire de Claude</p>
              <p className="text-sm italic font-serif">
                {validated.commentaireGeneral}
              </p>
            </div>
          )}
          <p className="text-cream-mute text-xs">
            Importer va remplacer les slots/courses du plan en cours et le
            passer en actif. Le plan actif précédent (s'il y en a un) sera
            archivé.
          </p>
        </div>
      )}

      {importError && (
        <div className="tile-card border-copper">
          <p className="text-copper text-sm">Erreur à l'import : {importError}</p>
        </div>
      )}

      {result && (
        <div className="tile-card border-sage space-y-2">
          <p className="text-sage font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            Plan importé et activé
          </p>
          <ul className="text-sm text-cream-mute space-y-1">
            <li>
              {result.recettesCreated} recette
              {result.recettesCreated > 1 ? "s" : ""} créée
              {result.recettesCreated > 1 ? "s" : ""}, {result.recettesReused} réutilisée
              {result.recettesReused > 1 ? "s" : ""} (dédup hash)
            </li>
            <li>{result.slotsCreated} slots</li>
            <li>{result.batchSessionsCreated} session(s) de batch</li>
            <li>{result.shoppingItemsCreated} items de courses</li>
            {result.archivedPreviousPlanIds.length > 0 && (
              <li>
                {result.archivedPreviousPlanIds.length} plan(s) actif(s)
                précédent(s) archivé(s)
              </li>
            )}
          </ul>
          <p className="text-cream-mute text-xs">Redirection vers le menu…</p>
        </div>
      )}
    </div>
  );
}
