import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const { name, version } = JSON.parse(await readFile("package.json", "utf8"));
const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, {
  signal: AbortSignal.timeout(30_000),
});
if (response.status === 404) {
  execFileSync("npm", ["publish", "--access", "public", "--provenance"], { stdio: "inherit" });
} else {
  if (!response.ok) throw new Error(`npm registry returned ${response.status}; publication aborted`);
  const published = await response.json() as { name: string; version: string };
  if (published.name !== name || published.version !== version) throw new Error("Unexpected npm registry response");
  console.log(`${name}@${version} is already published`);
}
