import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const apiRoot = join(webRoot, "..", "api");
const entry = join(webRoot, "..", "api", "dist", "main.js");
const binariesDir = join(webRoot, "src-tauri", "binaries");
const mode = process.argv[2] || "host";

const targets = {
  "aarch64-apple-darwin": { pkg: "node24-macos-arm64", ext: "" },
  "x86_64-apple-darwin": { pkg: "node24-macos-x64", ext: "" },
  "x86_64-unknown-linux-gnu": { pkg: "node24-linux-x64", ext: "" },
  "x86_64-pc-windows-msvc": { pkg: "node24-win-x64", ext: ".exe" },
};

if (!existsSync(entry)) {
  throw new Error(`API build entry not found: ${entry}`);
}

mkdirSync(binariesDir, { recursive: true });
patchPrismaDefaultExport();

const requestedTargets = mode === "all" ? Object.keys(targets) : [hostTriple()];
for (const triple of requestedTargets) {
  const target = targets[triple];
  if (!target) throw new Error(`Unsupported sidecar target: ${triple}`);
  const tempOutput = join(binariesDir, `mira-api-${target.pkg}${target.ext}`);
  const finalOutput = join(binariesDir, `mira-api-${triple}${target.ext}`);
  rmSync(tempOutput, { force: true });
  rmSync(finalOutput, { force: true });

  run("pkg", [entry, "--targets", target.pkg, "--output", tempOutput, "--public", "--public-packages", "*", "--no-bytecode"]);
  renameSync(tempOutput, finalOutput);
  console.log(`Built ${finalOutput}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: webRoot, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function hostTriple() {
  try {
    const value = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
    if (value) return value;
  } catch {
    const value = execFileSync("rustc", ["-Vv"], { encoding: "utf8" }).split(/\r?\n/).find((line) => line.startsWith("host:"));
    if (value) return value.replace("host:", "").trim();
  }
  throw new Error("Unable to determine Rust host target triple");
}

function patchPrismaDefaultExport() {
  const prismaDefault = join(apiRoot, "node_modules", ".prisma", "client", "default.js");
  if (!existsSync(prismaDefault)) return;
  writeFileSync(prismaDefault, "module.exports = require('./index.js');\n", "utf8");
}
