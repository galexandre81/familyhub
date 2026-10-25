import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHubCss } from "../dist/index.js";

const sortie = resolve(dirname(fileURLToPath(import.meta.url)), "../../../apps/hub/src/styles/ambiance.css");
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, renderHubCss());
console.log("écrit", sortie);
