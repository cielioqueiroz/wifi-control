import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const directory = resolve("release", "wifi-control-windows");
const metadata = JSON.parse(await readFile("package.json", "utf8"));
await mkdir(join(directory, "bin"), { recursive: true });
await build({
  entryPoints: ["apps/agent/src/index.ts"],
  outfile: join(directory, "bin", "agent.cjs"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: false
});
await cp("apps/web/out", join(directory, "web"), { recursive: true });
await cp("scripts/serve-web.mjs", join(directory, "bin", "serve-web.mjs"));
for (const name of ["start.ps1", "stop.ps1", "configure-router.ps1"])
  await cp(join("scripts", name), join(directory, name));
await cp("docs/WINDOWS.md", join(directory, "LEIA-ME.md"));
await writeFile(
  join(directory, "manifest.json"),
  JSON.stringify(
    {
      name: "wifi-control",
      version: metadata.version,
      requires: "Node.js 24",
      localOnly: true
    },
    null,
    2
  )
);
console.info(`Pacote criado em ${directory}`);
