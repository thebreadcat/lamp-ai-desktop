const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const DEFAULT_PORT = 7700;

function lampRoot(app) {
  const fromEnv = process.env.LAMP_PATH?.trim();
  if (fromEnv && fs.existsSync(path.join(fromEnv, "lamp.py"))) {
    return path.resolve(fromEnv);
  }
  if (!app.isPackaged) {
    const dev = path.join(app.getAppPath(), "lamp");
    if (fs.existsSync(path.join(dev, "lamp.py"))) return dev;
  }
  const bundled = path.join(process.resourcesPath, "lamp");
  if (fs.existsSync(path.join(bundled, "lamp.py"))) return bundled;
  throw new Error(
    "Lamp not found. Set LAMP_PATH or run: git submodule update --init --recursive"
  );
}

function pythonBin() {
  return process.env.LAMP_PYTHON?.trim() || "python3";
}

function port() {
  const n = Number(process.env.LAMP_PORT || DEFAULT_PORT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT;
}

function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else if (Date.now() > deadline) reject(new Error("Lamp server timeout"));
        else setTimeout(tick, 400);
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Lamp server timeout"));
        else setTimeout(tick, 400);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

class LampServer {
  constructor(app) {
    this.app = app;
    this.child = null;
    this._port = port();
  }

  get baseUrl() {
    return `http://127.0.0.1:${this._port}`;
  }

  async start() {
    if (this.child) return this.baseUrl;
    const root = lampRoot(this.app);
    const script = path.join(root, "lamp.py");
    const args = [script, "--host", "127.0.0.1", "--port", String(this._port)];
    this.child = spawn(pythonBin(), args, {
      cwd: root,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stdout?.on("data", (d) => process.stdout.write(`[lamp] ${d}`));
    this.child.stderr?.on("data", (d) => process.stderr.write(`[lamp] ${d}`));
    this.child.on("exit", (code, signal) => {
      console.log(`[lamp] exited code=${code} signal=${signal}`);
      this.child = null;
    });
    await waitForHttp(this.baseUrl);
    return this.baseUrl;
  }

  stop() {
    if (!this.child) return;
    this.child.kill("SIGTERM");
    this.child = null;
  }
}

module.exports = { LampServer, port, lampRoot };
