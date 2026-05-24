/* Lamp Desktop — fully automatic first-run setup */

const API = "";

async function api(action, body = {}) {
  const res = await fetch(`${API}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`Setup failed (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("ndjson")) return res;
  return res.json();
}

async function status() {
  const res = await fetch(`${API}/api/status`);
  return res.json();
}

const $ = (id) => document.getElementById(id);
const stepList = $("stepList");
const logEl = $("log");
const helpEl = $("help");
const progressFill = $("progressFill");
const progressLabel = $("progressLabel");

const steps = new Map();

function addStep(id, text) {
  let li = steps.get(id);
  if (!li) {
    li = document.createElement("li");
    li.className = "step-item";
    li.innerHTML = `<span class="dot"></span><span class="label"></span>`;
    stepList.appendChild(li);
    steps.set(id, li);
  }
  li.querySelector(".label").textContent = text;
  li.classList.remove("fail", "active", "done");
  return li;
}

function setStep(id, state, text) {
  const li = addStep(id, text);
  li.classList.add(state);
  if (state === "active") progressLabel.textContent = text;
}

function appendLog(text) {
  logEl.hidden = false;
  logEl.textContent = (logEl.textContent ? logEl.textContent + "\n" : "") + text;
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(pct) {
  progressFill.style.width = `${Math.min(100, pct)}%`;
}

function showHelp(msg, openUrl) {
  helpEl.hidden = false;
  helpEl.innerHTML = `<p><strong>We need a little help</strong></p><p>${msg}</p>`;
  if (openUrl) {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = openUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Open download page";
    helpEl.appendChild(a);
  }
  const retry = document.createElement("button");
  retry.className = "btn secondary";
  retry.textContent = "Try again";
  retry.onclick = () => location.reload();
  helpEl.appendChild(retry);
}

async function runBootstrap() {
  const res = await api("bootstrap");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let stepCount = 0;
  let doneCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);

      if (ev.t === "step") {
        if (ev.state === "start") {
          stepCount += 1;
          setStep(ev.id, "active", ev.text);
          setProgress((doneCount / Math.max(stepCount, 6)) * 100);
        } else if (ev.state === "done") {
          doneCount += 1;
          setStep(ev.id, "done", ev.text);
          setProgress((doneCount / Math.max(stepCount, 6)) * 100);
        } else if (ev.state === "fail") {
          setStep(ev.id, "fail", ev.text);
        }
      }
      if (ev.t === "log") appendLog(ev.text);
      if (ev.t === "error") {
        showHelp(ev.msg || "Setup failed", ev.open_url);
        return false;
      }
      if (ev.t === "done" && ev.ok) {
        setProgress(100);
        progressLabel.textContent = "Lamp is ready!";
        $("title").textContent = "You're all set";
        $("subtitle").textContent = "Opening Lamp…";
        setTimeout(() => {
          if (window.lampSetupComplete) window.lampSetupComplete();
        }, 1200);
        return true;
      }
    }
  }
  return false;
}

async function main() {
  try {
    const s = await status();
    if (s.skip_wizard) {
      progressLabel.textContent = "Already set up";
      setProgress(100);
      setTimeout(() => window.lampSetupComplete?.(), 400);
      return;
    }
    if (!s.steps.python.ok) {
      showHelp(
        s.steps.python.hint ||
          "Python is required. Install Python 3.10+ and reopen Lamp, or use a Lamp build that includes Python.",
        "https://www.python.org/downloads/"
      );
      return;
    }
    await runBootstrap();
  } catch (e) {
    showHelp(e.message || String(e));
  }
}

main();
