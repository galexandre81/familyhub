import { useEffect, useId, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Check, ExternalLink, X } from "lucide-react";
import { useCreateDisplayToken } from "../lib/mutations";

interface SetupTokenModalProps {
  householdId: string;
  displayId: string;
  displayNom: string;
  onClose: () => void;
}

export default function SetupTokenModal({
  householdId,
  displayId,
  displayNom,
  onClose,
}: SetupTokenModalProps) {
  const create = useCreateDisplayToken();
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [longUrl, setLongUrl] = useState<string | null>(null);
  const [shortId, setShortId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"short" | "long" | "code" | null>(null);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    create
      .mutateAsync({ householdId, displayId })
      .then((res) => {
        const base = window.location.origin;
        setShortUrl(base + res.shortUrl);
        setLongUrl(base + res.setupUrl);
        setShortId(res.setupShortId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, displayId]);

  /* Dialog a11y : focus initial sur le bouton fermer + restauration au démontage. */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  /* Escape ferme + piège le focus à l'intérieur du dialog (Tab cyclique). */
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, summary, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function copy(text: string, kind: "short" | "long" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* noop */
    }
  }

  const shortHost = shortUrl ? shortUrl.replace(/^https?:\/\//, "") : "";

  return (
    <div
      className="fixed inset-0 bg-bg-sombre/50 flex items-center justify-center p-6 z-50 overflow-auto"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="tile-card max-w-2xl w-full space-y-5 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondaire hover:text-accent-chaud flex items-center justify-center min-h-11 min-w-11"
          aria-label="Fermer"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div>
          <h2 id={titleId} className="text-xl">Configurer « {displayNom} »</h2>
          <p className="text-text-secondaire text-sm mt-1">
            Trois façons de transférer la config sur ton iPad. Le code est valide 30 minutes.
          </p>
        </div>

        {create.isPending && <p className="text-text-secondaire">Génération du lien…</p>}
        {error && <p className="text-accent-chaud text-sm">{error}</p>}

        {shortUrl && shortId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold mb-1">Option 1 — Code à 6 chiffres</p>
                <p className="text-text-secondaire text-xs">
                  Tape sur l'iPad dans Safari : <code className="bg-bg-principal px-1.5 py-0.5 rounded">{shortHost.split("/")[0]}/d/{shortId}</code>
                </p>
              </div>
              <div className="bg-bg-principal rounded-md p-4 text-center">
                <p className="font-mono text-3xl tracking-widest text-accent-chaud">
                  {shortId}
                </p>
                <button
                  onClick={() => copy(shortId, "code")}
                  className="mt-2 text-xs text-text-secondaire hover:text-accent-chaud flex items-center gap-1 mx-auto"
                >
                  {copied === "code" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  {copied === "code" ? "Copié" : "Copier le code"}
                </button>
              </div>

              <div className="pt-2 border-t border-bordure">
                <p className="text-sm font-semibold mb-1">Option 2 — Lien court</p>
                <div className="bg-bg-principal rounded-md p-2 break-all text-xs font-mono">
                  {shortUrl}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => copy(shortUrl, "short")} className="btn-secondary text-xs flex items-center gap-1">
                    {copied === "short" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    {copied === "short" ? "Copié" : "Copier"}
                  </button>
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-xs flex items-center gap-1"
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                    Tester
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Option 3 — QR code</p>
              <p className="text-text-secondaire text-xs">
                Scan avec un téléphone moderne (l'iPad mini 1 en iOS 9 ne scanne pas nativement).
                Une fois ouvert sur le téléphone, partage l'URL vers l'iPad par AirDrop / iMessage.
              </p>
              <div className="bg-white p-4 rounded-md flex items-center justify-center">
                <QRCode value={shortUrl} size={200} />
              </div>
            </div>
          </div>
        )}

        {longUrl && (
          <details className="text-sm">
            <summary className="cursor-pointer text-text-secondaire hover:text-accent-chaud">
              Lien long de secours
            </summary>
            <div className="mt-2 bg-bg-principal rounded-md p-2 break-all text-xs font-mono">
              {longUrl}
            </div>
            <button
              onClick={() => copy(longUrl, "long")}
              className="mt-2 btn-secondary text-xs flex items-center gap-1"
            >
              {copied === "long" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied === "long" ? "Copié" : "Copier"}
            </button>
          </details>
        )}
      </div>
    </div>
  );
}
