import { ChevronDown } from "lucide-react";

/** Une ligne de l'écran qui s'ouvre au toucher : titre, une phrase de résumé, puis le détail. */
export default function LigneRepliee({
  titre,
  resume,
  children,
}: {
  titre: string;
  resume: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl bg-ebony-card border border-hairline">
      <summary className="flex items-center gap-3 px-4 py-3 min-h-14 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[17px] font-semibold text-cream">{titre}</span>
          <span className="text-[15px] text-cream-mute">{resume}</span>
        </span>
        <ChevronDown size={22} aria-hidden="true" className="shrink-0 text-cream-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-3 border-t border-hairline flex flex-col gap-4">{children}</div>
    </details>
  );
}
