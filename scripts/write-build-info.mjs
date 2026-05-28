#!/usr/bin/env node
/** Write resources/build-info.json for packaged About / diagnostics. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let meta = {};
const metaPath = path.join(root, "lamp", ".desktop-build-meta.json");
if (fs.existsSync(metaPath)) {
  meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

const info = {
  desktopVersion: pkg.version,
  lampCommit: meta.lampCommit ?? null,
  tortoiseCommit: meta.tortoiseCommit ?? null,
  lampSource: meta.lampSource ?? null,
  stagedAt: meta.stagedAt ?? null,
  builtAt: new Date().toISOString(),
};

const outDir = path.join(root, "resources");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "build-info.json");
fs.writeFileSync(outPath, `${JSON.stringify(info, null, 2)}\n`);
console.log(`ok: wrote ${outPath}`);
