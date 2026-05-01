export interface RadioStation {
  id: string;
  nom: string;
  url: string;
  logoUrl?: string;
}

export interface RadioConfig {
  stations: RadioStation[];
  defaultStationId: string;
}

/**
 * Stations par défaut (seed) — France & Suisse romande, flux HTTPS publics.
 *
 * Pour les stations Radio France, on utilise les flux HLS (.m3u8) plutôt que les MP3
 * directs depuis icecast.radiofrance.fr : iOS 9 Safari ne supporte plus ces derniers
 * (erreur MEDIA_ERR_SRC_NOT_SUPPORTED) alors que HLS est natif iOS depuis iOS 3.
 */
export const defaultRadioStations: RadioStation[] = [
  { id: "france-inter", nom: "France Inter", url: "https://stream.radiofrance.fr/franceinter/franceinter_hifi.m3u8" },
  { id: "france-info", nom: "France Info", url: "https://stream.radiofrance.fr/franceinfo/franceinfo_hifi.m3u8" },
  { id: "france-culture", nom: "France Culture", url: "https://stream.radiofrance.fr/franceculture/franceculture_hifi.m3u8" },
  { id: "france-musique", nom: "France Musique", url: "https://stream.radiofrance.fr/francemusique/francemusique_hifi.m3u8" },
  { id: "rts-la-1ere", nom: "RTS La 1ère", url: "https://stream.srg-ssr.ch/m/la-1ere/mp3_128" },
  { id: "couleur-3", nom: "Couleur 3", url: "https://stream.srg-ssr.ch/m/couleur3/mp3_128" },
];
