/**
 * Adresse secrète iCal d'un agenda Google (Paramètres et partage →
 * « Adresse secrète au format iCal »). Stockée par foyer dans
 * `households/{hid}/private/calendar.icalUrl` ; les règles Firestore exigent
 * qu'elle commence par https://.
 */
export function isValidIcalUrl(value: string): boolean {
  const v = value.trim();
  return /^https:\/\/\S+$/.test(v);
}
