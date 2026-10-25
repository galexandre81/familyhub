import { useState } from "react";
import { AlertCircle, Check, Copy, Link2, Share2, UserPlus } from "lucide-react";
import { useCreateInvitation } from "../lib/mutations";
import { lienInvitation } from "../lib/invitations";

interface Props {
  householdId: string;
  nomFoyer: string;
  /** Seul un parent peut inviter (la fonction `createInvitation` le vérifie aussi). */
  parent: boolean;
}

/**
 * Paramètres → « Inviter un parent » : crée un lien à usage unique (7 jours)
 * que la personne ouvre avec son propre compte Google ; elle entre dans le
 * foyer comme parent. Pas encore d'invitation d'enfant.
 */
export default function InviterMembre({ householdId, nomFoyer, parent }: Props) {
  const creer = useCreateInvitation();
  const [lien, setLien] = useState<string | null>(null);
  const [etat, setEtat] = useState<"idle" | "copie" | "echec">("idle");
  const peutPartager = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function genererLien() {
    setEtat("idle");
    try {
      const { code } = await creer.mutateAsync({ householdId });
      setLien(lienInvitation(window.location.origin, code));
    } catch {
      /* message affiché via creer.isError */
    }
  }

  async function copier(texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copie");
      setTimeout(() => setEtat("idle"), 2500);
    } catch {
      setEtat("echec");
    }
  }

  async function partager(texte: string) {
    if (peutPartager) {
      try {
        await navigator.share({
          title: "Family Hub",
          text: `Rejoins le foyer ${nomFoyer} sur Family Hub`,
          url: texte,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        /* repli : copie */
      }
    }
    await copier(texte);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl">Inviter un parent</h2>
      <div className="tile-card space-y-4">
        <p className="text-text-secondaire text-base">
          La personne ouvre le lien et se connecte avec son compte Google : elle entre dans le
          foyer comme parent, avec les mêmes droits que toi. Lien valable 7 jours, une seule fois.
        </p>

        {!parent && (
          <p className="flex items-center gap-2 text-base">
            <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" />
            <span>Seul un parent du foyer peut inviter.</span>
          </p>
        )}

        {parent && !lien && (
          <button
            type="button"
            onClick={() => void genererLien()}
            disabled={creer.isPending}
            className="btn-primary inline-flex min-h-[48px] items-center gap-2"
          >
            <UserPlus aria-hidden="true" size={16} />
            {creer.isPending ? "Création…" : "Inviter un parent"}
          </button>
        )}

        {creer.isError && (
          <p role="alert" className="flex items-center gap-2 text-base">
            <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" />
            <span>Le lien n'a pas pu être créé — réessaie.</span>
          </p>
        )}

        {lien && (
          <>
            <p className="flex items-center gap-2 text-base break-all">
              <Link2 aria-hidden="true" size={16} className="shrink-0 text-text-secondaire" />
              <span>{lien}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void partager(lien)}
                className="btn-primary inline-flex min-h-[48px] items-center gap-2"
              >
                {peutPartager ? (
                  <>
                    <Share2 aria-hidden="true" size={16} />
                    Partager
                  </>
                ) : etat === "copie" ? (
                  <>
                    <Check aria-hidden="true" size={16} />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" size={16} />
                    Copier
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void genererLien()}
                disabled={creer.isPending}
                className="btn-secondary inline-flex min-h-[48px] items-center gap-2"
              >
                <UserPlus aria-hidden="true" size={16} />
                Nouveau lien
              </button>
            </div>
            {etat === "copie" && peutPartager && (
              <p role="status" className="flex items-center gap-2 text-base">
                <Check aria-hidden="true" size={16} />
                Lien copié
              </p>
            )}
            {etat === "echec" && (
              <p role="alert" className="flex items-center gap-2 text-base">
                <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-brass" />
                <span>Copie impossible — sélectionne le lien ci-dessus.</span>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
