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
 */
export const defaultRadioStations: RadioStation[] = [
  { id: "france-inter", nom: "France Inter", url: "https://icecast.radiofrance.fr/franceinter-midfi.mp3" },
  { id: "france-info", nom: "France Info", url: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3" },
  { id: "france-culture", nom: "France Culture", url: "https://icecast.radiofrance.fr/franceculture-midfi.mp3" },
  { id: "france-musique", nom: "France Musique", url: "https://icecast.radiofrance.fr/francemusique-midfi.mp3" },
  { id: "rts-la-1ere", nom: "RTS La 1ère", url: "https://stream.srg-ssr.ch/m/la-1ere/mp3_128" },
  { id: "couleur-3", nom: "Couleur 3", url: "https://stream.srg-ssr.ch/m/couleur3/mp3_128" },
];
