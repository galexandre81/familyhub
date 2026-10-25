import { useEffect, useState } from "react";
import { millisecondesAvantMinute } from "./aujourdhui";

/** Heure courante, recalculée à chaque minute pleine. */
export function useMaintenant(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Aligné sur les minutes pleines : « dans 1 h 30 » change pile à la minute.
    let id: number;
    const planifier = () => {
      id = window.setTimeout(() => {
        setNow(new Date());
        planifier();
      }, millisecondesAvantMinute(new Date()));
    };
    planifier();
    return () => window.clearTimeout(id);
  }, []);
  return now;
}
