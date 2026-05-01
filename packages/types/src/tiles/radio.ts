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
 * Stations par défaut (seed) — uniquement des flux HTTPS testés iOS 9.3.6 friendly.
 *
 * CDN qui marchent sur iOS 9 : stream.srg-ssr.ch (Suisse), stream-uk1.radioparadise.com,
 * npr-ice.streamguys1.com. Ce qui ne marche pas : Infomaniak (TLS strict), impek,
 * radiofrance (icecast et HLS), BBC (migration vers Sounds avec auth).
 *
 * Mix : 3 ambiances Radio Paradise (éclectique sans pub), 1 news anglais (NPR),
 * 4 stations RTS/SRG SSR (FR + culture + jazz CH).
 */
export const defaultRadioStations: RadioStation[] = [
  { id: "radio-paradise", nom: "Radio Paradise", url: "https://stream-uk1.radioparadise.com/mp3-192" },
  { id: "radio-paradise-mellow", nom: "Radio Paradise · Mellow", url: "https://stream-uk1.radioparadise.com/mellow-192" },
  { id: "radio-paradise-world", nom: "Radio Paradise · World", url: "https://stream-uk1.radioparadise.com/world-etc-192" },
  { id: "npr-news", nom: "NPR News (English)", url: "https://npr-ice.streamguys1.com/live.mp3" },
  { id: "rts-la-1ere", nom: "RTS La 1ère", url: "https://stream.srg-ssr.ch/m/la-1ere/mp3_128" },
  { id: "couleur-3", nom: "Couleur 3", url: "https://stream.srg-ssr.ch/m/couleur3/mp3_128" },
  { id: "rts-espace-2", nom: "RTS Espace 2 (classique)", url: "https://stream.srg-ssr.ch/m/espace-2/mp3_128" },
  { id: "radio-swiss-jazz", nom: "Radio Swiss Jazz", url: "https://stream.srg-ssr.ch/m/rsj/mp3_128" },
];
