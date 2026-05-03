// Copies apps/display/public/* into apps/hub/dist/display/ so the single Firebase
// Hosting site can serve both the React hub (root) and the vanilla display (/display/*).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "apps/display/public");
const DEST = resolve(ROOT, "apps/hub/dist/display");

if (!existsSync(SRC)) {
  console.warn(`[copy-display] source absent: ${SRC} — skipping`);
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`[copy-display] copied ${SRC} -> ${DEST}`);
