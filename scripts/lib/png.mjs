// Encodeur PNG minimal, sans dépendance : IHDR + IDAT (compressé par node:zlib)
// + IEND, CRC32 calculé ici. Image RVB 8 bits sans alpha, non entrelacée.
//
// Utilisé par scripts/generate-display-icon.mjs et scripts/generate-hub-icons.mjs.
import { deflateSync } from "node:zlib";

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

/**
 * Encode une image carrée ou rectangulaire en PNG.
 * @param {number} largeur
 * @param {number} hauteur
 * @param {(x: number, y: number) => [number, number, number]} pixel couleur RVB de (x, y)
 * @returns {Buffer}
 */
export function encoderPng(largeur, hauteur, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // RVB, sans alpha
  ihdr[10] = 0; // compression deflate
  ihdr[11] = 0; // filtrage standard
  ihdr[12] = 0; // non entrelacé

  // Chaque ligne : 1 octet de filtre (0 = aucun) + largeur pixels RVB.
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  let o = 0;
  for (let y = 0; y < hauteur; y++) {
    brut[o++] = 0;
    for (let x = 0; x < largeur; x++) {
      const [r, v, b] = pixel(x, y);
      brut[o++] = r;
      brut[o++] = v;
      brut[o++] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}
