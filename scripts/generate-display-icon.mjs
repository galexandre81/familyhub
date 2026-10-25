// Génère apps/display/public/icons/icon-180.png : icône « écran d'accueil » de l'iPad
// (apple-touch-icon + manifest.json). 180×180, fond #EEF4EA (« fond jour » du design
// system) avec un carré central plus sombre. PNG minimal écrit à la main (IHDR +
// IDAT compressé par node:zlib + IEND, CRC32 calculé ici) : aucune dépendance.
//
// Usage : node scripts/generate-display-icon.mjs   (le PNG produit est versionné)
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../apps/display/public/icons/icon-180.png");

const TAILLE = 180;
const FOND = [0xee, 0xf4, 0xea]; // #EEF4EA
const CARRE = [0x3e, 0x5c, 0x46]; // vert sombre, lisible sur le fond clair
const MARGE = 54; // carré central de 72×72

const TABLE_CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE_CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TAILLE, 0);
ihdr.writeUInt32BE(TAILLE, 4);
ihdr[8] = 8; // 8 bits par canal
ihdr[9] = 2; // RVB, sans alpha
ihdr[10] = 0; // compression deflate
ihdr[11] = 0; // filtrage standard
ihdr[12] = 0; // non entrelacé

// Chaque ligne : 1 octet de filtre (0 = aucun) + TAILLE pixels RVB.
const brut = Buffer.alloc(TAILLE * (1 + TAILLE * 3));
let o = 0;
for (let y = 0; y < TAILLE; y++) {
  brut[o++] = 0;
  for (let x = 0; x < TAILLE; x++) {
    const dedans = x >= MARGE && x < TAILLE - MARGE && y >= MARGE && y < TAILLE - MARGE;
    const [r, v, b] = dedans ? CARRE : FOND;
    brut[o++] = r;
    brut[o++] = v;
    brut[o++] = b;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloc("IHDR", ihdr),
  bloc("IDAT", deflateSync(brut, { level: 9 })),
  bloc("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`[icon] ${OUT} (${png.length} octets, ${TAILLE}×${TAILLE})`);
