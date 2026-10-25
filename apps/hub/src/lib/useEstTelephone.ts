import { useEffect, useState } from "react";

/** Téléphone = largeur < 768 px. */
export const REQUETE_TELEPHONE = "(max-width: 767px)";

/** Vrai sur un écran de téléphone ; suit les redimensionnements. */
export function useEstTelephone(): boolean {
  const [tel, setTel] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(REQUETE_TELEPHONE).matches === true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(REQUETE_TELEPHONE);
    const maj = () => setTel(mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);
  return tel;
}
