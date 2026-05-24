const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { lampRoot } = require("./lamp-server");
const { pythonBin, hasBundledPython } = require("./python-runtime");

const SETUP_PORT = Number(process.env.LAMP_SETUP_PORT || 7701);

function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function waitForSetup(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetchJson(`${url}/api/status`, 2000)
        .then(resolve)
        .catch(() => {
          if (Date.now() > deadline) reject(new Error("Setup server did not start"));
          else setTimeout(tick, 300);
        });
    };
    tick();
  });
}

class SetupManager {
  constructor(app) {
    this.app = app;
    this.child = null;
    this.baseUrl = `http://127.0.0.1:${SETUP_PORT}`;
  }

  daemonScript() {
    return path.join(this.app.getAppPath(), "scripts", "setup-daemon.py");
  }

  async startDaemon() {
    if (this.child) return this.baseUrl;
    const root = lampRoot(this.app);
    const script = this.daemonScript();
    const args = [
      script,
      "--port",
      String(SETUP_PORT),
      "--lamp-root",
      root,
    ];
    const py = pythonBin(this.app);
    this.child = spawn(py, args, {
      cwd: this.app.getAppPath(),
      env: {
        ...process.env,
        LAMP_ROOT: root,
        PYTHONUNBUFFERED: "1",
        LAMP_BUNDLED_PYTHON: hasBundledPython(this.app) ? "1" : "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stdout?.on("data", (d) => process.stdout.write(`[setup] ${d}`));
    this.child.stderr?.on("data", (d) => process.stderr.write(`[setup] ${d}`));
    this.child.on("exit", (code) => {
      console.log(`[setup] daemon exited ${code}`);
      this.child = null;
    });
    await waitForSetup(this.baseUrl);
    return this.baseUrl;
  }

  async getStatus() {
    await this.startDaemon();
    return fetchJson(`${this.baseUrl}/api/status`);
  }

  async needsWizard() {
    try {
      const s = await this.getStatus();
      return !s.skip_wizard;
    } catch (e) {
      console.warn("[setup] status check failed, showing wizard:", e.message);
      return true;
    }
  }

  async resetWizard() {
    await this.startDaemon();
    await fetch(`${this.baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
  }

  stop() {
    if (!this.child) return;
    this.child.kill("SIGTERM");
    this.child = null;
  }
}

module.exports = { SetupManager, SETUP_PORT };
