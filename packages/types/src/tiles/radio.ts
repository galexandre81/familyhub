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
 * Stations par défaut (seed), testées le 25.10.2026 sur l'iPad mini 1 (iOS 9,
 * Safari) : flux MP3 en HTTP simple. L'iPad ne reconnaît plus une partie des
 * certificats actuels (Let's Encrypt, ZeroSSL…) : en HTTPS, Radio France,
 * Infomaniak ou Radio Paradise échouaient, alors que les flux SRG SSR (qui
 * redirigent vers HTTP) marchaient. Safari accepte l'audio HTTP dans une page
 * HTTPS (contenu mixte « passif ») ; une app installée sur l'écran d'accueil
 * pourrait le bloquer.
 *
 * Suisse (SRG SSR), France (Radio France, Infomaniak), international.
 */
export const defaultRadioStations: RadioStation[] = [
  { id: "rts-la-1ere", nom: "RTS La 1ère", url: "http://stream.srg-ssr.ch/m/la-1ere/mp3_128" },
  { id: "couleur-3", nom: "Couleur 3", url: "http://stream.srg-ssr.ch/m/couleur3/mp3_128" },
  { id: "option-musique", nom: "Option Musique", url: "http://stream.srg-ssr.ch/m/option-musique/mp3_128" },
  { id: "rts-espace-2", nom: "Espace 2 (classique)", url: "http://stream.srg-ssr.ch/m/espace-2/mp3_128" },
  { id: "radio-swiss-jazz", nom: "Radio Swiss Jazz", url: "http://stream.srg-ssr.ch/m/rsj/mp3_128" },
  { id: "radio-swiss-pop", nom: "Radio Swiss Pop", url: "http://stream.srg-ssr.ch/m/rsp/mp3_128" },
  { id: "radio-swiss-classic", nom: "Radio Swiss Classic", url: "http://stream.srg-ssr.ch/m/rsc_fr/mp3_128" },
  { id: "france-inter", nom: "France Inter", url: "http://icecast.radiofrance.fr/franceinter-midfi.mp3" },
  { id: "franceinfo", nom: "franceinfo", url: "http://icecast.radiofrance.fr/franceinfo-midfi.mp3" },
  { id: "france-culture", nom: "France Culture", url: "http://icecast.radiofrance.fr/franceculture-midfi.mp3" },
  { id: "fip", nom: "FIP", url: "http://icecast.radiofrance.fr/fip-midfi.mp3" },
  { id: "radio-nova", nom: "Radio Nova", url: "http://novazz.ice.infomaniak.ch/novazz-128.mp3" },
  { id: "tsf-jazz", nom: "TSF Jazz", url: "http://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3" },
  { id: "radio-classique", nom: "Radio Classique", url: "http://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3" },
  { id: "bbc-world-service", nom: "BBC World Service (English)", url: "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service" },
  { id: "kexp", nom: "KEXP Seattle", url: "http://kexp-mp3-128.streamguys1.com/kexp128.mp3" },
  { id: "radio-paradise", nom: "Radio Paradise", url: "http://stream-uk1.radioparadise.com/mp3-192" },
];
