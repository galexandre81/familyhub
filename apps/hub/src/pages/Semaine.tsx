import { CalendarDays } from "lucide-react";

/** Provisoire : le menu de la semaine (téléphone) remplace ce contenu à la tâche suivante. */
export default function Semaine() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-12">
      <CalendarDays size={40} className="text-cream-mute" aria-hidden="true" />
      <p className="text-lg text-cream">Le menu de la semaine arrive bientôt ici</p>
    </div>
  );
}
