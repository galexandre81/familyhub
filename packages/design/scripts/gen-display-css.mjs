import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderDisplayCss } from "../dist/index.js";

const sortie = resolve(dirname(fileURLToPath(import.meta.url)), "../../../apps/display/public/css/ambiance.css");
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, renderDisplayCss());
console.log("écrit", sortie);
