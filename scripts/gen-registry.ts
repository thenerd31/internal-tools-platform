import fs from "node:fs";
import path from "node:path";
import {
  APPS_DIR,
  GENERATED_PATH,
  generateRegistrySource,
} from "../src/platform/registry/generate";

fs.mkdirSync(path.dirname(GENERATED_PATH), { recursive: true });
const source = generateRegistrySource(APPS_DIR);
fs.writeFileSync(GENERATED_PATH, source);

const appCount = (source.match(/^import manifest/gm) ?? []).length;
console.log(`gen-registry: wrote ${GENERATED_PATH} (${appCount} apps)`);
