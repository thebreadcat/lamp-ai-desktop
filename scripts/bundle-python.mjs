#!/usr/bin/env node
/**
 * Download python-build-standalone into resources/python for offline installs.
 * Uses latest release assets from astral-sh/python-build-standalone.
 */
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "resources", "python");
const PYTHON_MINOR = "3.12";

const TRIPLES = {
  "arm64-darwin": "aarch64-apple-darwin",
  "x64-darwin": "x86_64-apple-darwin",
  "x64-linux": "x86_64-unknown-linux-gnu",
  "arm64-linux": "aarch64-unknown-linux-gnu",
  "x64-win32": "x86_64-pc-windows-msvc",
};

function platformKey() {
  const { platform, arch } = process;
  if (platform === "darwin") return arch === "arm64" ? "arm64-darwin" : "x64-darwin";
  if (platform === "linux") return arch === "arm64" ? "arm64-linux" : "x64-linux";
  if (platform === "win32") return "x64-win32";
  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "lamp-desktop-build" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "lamp-desktop-build" } });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

function pickAsset(assets, triple) {
  const prefix = `cpython-${PYTHON_MINOR}.`;
  return assets.find(
    (a) =>
      a.name.startsWith(prefix) &&
      a.name.includes(`${triple}-install_only`) &&
      a.name.endsWith("-install_only.tar.gz") &&
      !a.name.includes("stripped")
  );
}

async function main() {
  const key = platformKey();
  const triple = TRIPLES[key];
  const tag = process.env.PYTHON_STANDALONE_TAG || (await fetchJson(
    "https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest"
  )).tag_name;

  const release = process.env.PYTHON_STANDALONE_TAG
    ? await fetchJson(
        `https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/${tag}`
      )
    : await fetchJson(
        "https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest"
      );

  const asset = pickAsset(release.assets, triple);
  if (!asset) {
    throw new Error(`No Python ${PYTHON_MINOR} install_only asset for ${triple} in release ${release.tag_name}`);
  }

  const tmp = path.join(ROOT, ".cache", asset.name);
  await fs.mkdir(path.dirname(tmp), { recursive: true });
  if (!(await fs.stat(tmp).catch(() => null))) {
    console.log("Downloading", asset.browser_download_url);
    await download(asset.browser_download_url, tmp);
  } else {
    console.log("Using cached", tmp);
  }

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  console.log("Extracting to", OUT);
  if (process.platform === "win32") {
    execSync(`tar -xzf "${tmp}" -C "${OUT}" --strip-components=1`, { stdio: "inherit" });
  } else {
    execSync(`tar -xzf "${tmp}" -C "${OUT}" --strip-components=1`, { stdio: "inherit" });
  }

  const bin =
    process.platform === "win32"
      ? path.join(OUT, "python.exe")
      : path.join(OUT, "bin", "python3");
  await fs.access(bin);
  console.log("OK:", bin, `(${release.tag_name})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
