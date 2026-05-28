const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function readBuildInfo() {
  const file = path.join(process.resourcesPath, "build-info.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function shortSha(sha) {
  if (!sha || typeof sha !== "string") return null;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function formatAboutDetail() {
  const info = readBuildInfo();
  const lines = [];
  if (info?.lampCommit) lines.push(`Lamp engine: ${shortSha(info.lampCommit)}`);
  if (info?.tortoiseCommit) lines.push(`Tortoise: ${shortSha(info.tortoiseCommit)}`);
  if (info?.stagedAt) lines.push(`Lamp staged: ${info.stagedAt}`);
  if (info?.builtAt) lines.push(`Desktop built: ${info.builtAt}`);
  if (!lines.length) {
    lines.push(
      app.isPackaged
        ? "Component versions are recorded on builds after v0.2.4."
        : "Run npm run predist before packaging to record component versions."
    );
  }
  return lines.join("\n");
}

module.exports = { readBuildInfo, formatAboutDetail, shortSha };
