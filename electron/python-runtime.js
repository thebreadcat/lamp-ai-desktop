const fs = require("node:fs");
const path = require("node:path");

/**
 * Prefer Python bundled with the app (no user install), then LAMP_PYTHON, then python3 on PATH.
 */
function bundledPythonCandidates(app) {
  const bases = [];
  if (app?.isPackaged) {
    bases.push(path.join(process.resourcesPath, "python"));
  }
  bases.push(path.join(app?.getAppPath?.() || "", "resources", "python"));
  return bases;
}

function pythonBin(app) {
  const fromEnv = process.env.LAMP_PYTHON?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const names =
    process.platform === "win32"
      ? ["python.exe", "python3.exe"]
      : ["python3", "python", "bin/python3"];

  for (const base of bundledPythonCandidates(app)) {
    for (const name of names) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) return p;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

function hasBundledPython(app) {
  const bin = pythonBin(app);
  if (bin === "python3" || bin === "python") return false;
  return fs.existsSync(bin);
}

module.exports = { pythonBin, hasBundledPython, bundledPythonCandidates };
