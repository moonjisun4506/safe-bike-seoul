import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const names = ["SEOUL_API_KEY", "DATA_GO_KR_API_KEY", "KAKAO_REST_API_KEY", "KMA_SERVICE_KEY"];
const secrets = names.flatMap(name => {
  const value = process.env[name]?.trim();
  if (!value) return [];
  const variants = new Set([value, encodeURIComponent(value)]);
  try { variants.add(decodeURIComponent(value)); } catch { /* not encoded */ }
  return [...variants].filter(v => v.length >= 8).map(value => ({ name, value }));
});
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  }))).flat();
}
// Inspect everything publicly served from the project, including source maps.
const targets = [...await files(".next/static"), ...await files("public")];
let leaked = false;
for (const file of targets) {
  const content = await readFile(file, "utf8");
  for (const secret of secrets) {
    if (content.includes(secret.value)) {
      // Report only the variable name and filename, never its value.
      console.error(`FAIL: ${secret.name} found in ${file}`);
      leaked = true;
    }
  }
}
if (leaked) process.exit(1);
console.log(`PASS: ${targets.length} public files checked; ${names.filter(n => process.env[n]?.trim()).length} configured server keys checked.`);
if (!secrets.length) console.log("No server keys configured; repeat after configuring .env.");

