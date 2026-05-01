import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { IntegratedSystem } from "../system/IntegratedSystem";
import { AgentBrick } from "../agent/AgentBrick";

export interface SystemServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly seedState?: Readonly<Record<string, unknown>>;
}

export function startSystemServer(options: SystemServerOptions = {}): void {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 6890;
  const system = new IntegratedSystem({ seedState: options.seedState });
  const agent = new AgentBrick();

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(system, agent, request, response);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Unhandled server error"
      });
    }
  });

  server.listen(port, host, () => {
    process.stdout.write(`SB689 complete system live on http://${host}:${port}\n`);
  });
}

async function routeRequest(
  system: IntegratedSystem,
  agent: AgentBrick,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const method = request.method ?? "GET";
  const url = request.url ?? "/";

  if (method === "GET" && url === "/") {
    sendHtml(response, INDEX_HTML);
    return;
  }

  if (method === "GET" && url === "/app.js") {
    sendJavaScript(response, APP_JS);
    return;
  }

  if (method === "GET" && url === "/styles.css") {
    sendCss(response, STYLES_CSS);
    return;
  }

  if (method === "GET" && url === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "SB689 complete system",
      status: system.status().status,
      ledgerValid: system.ledgerValid()
    });
    return;
  }

  if (method === "GET" && url === "/api/ledger") {
    sendJson(response, 200, {
      ok: true,
      ledgerValid: system.ledgerValid(),
      entries: system.ledgerEntries()
    });
    return;
  }

  if (method === "GET" && url === "/api/omega/status") {
    sendJson(response, 200, { ok: true, omega: system.status() });
    return;
  }

  if (method === "POST" && url === "/api/omega/tick") {
    const body = await readJsonBody(request);
    const liveState = asRecord(body.liveState);
    const pulseAlive = typeof body.pulseAlive === "boolean" ? body.pulseAlive : true;

    sendJson(response, 200, {
      ok: true,
      omega: system.tick({
        liveState,
        pulseAlive
      })
    });
    return;
  }

  if (method === "POST" && url === "/api/omega/connect") {
    sendJson(response, 200, { ok: true, handshake: system.connectToStitch() });
    return;
  }

  if (method === "POST" && url === "/api/runtime/run") {
    const body = await readJsonBody(request);
    const intentText = typeof body.text === "string" ? body.text.trim() : "";
    const intentId =
      typeof body.id === "string" && body.id.trim().length > 0
        ? body.id.trim()
        : `ui-${Date.now()}`;

    if (intentText.length === 0) {
      sendJson(response, 400, {
        ok: false,
        error: "Field 'text' is required for /api/runtime/run"
      });
      return;
    }

    const result = await system.process(
      {
        id: intentId,
        text: intentText,
        metadata: asRecord(body.metadata)
      },
      {
        liveState: asRecord(body.liveState),
        pulseAlive: typeof body.pulseAlive === "boolean" ? body.pulseAlive : true
      }
    );

    sendJson(response, 200, { ok: true, result, ledgerValid: system.ledgerValid() });
    return;
  }

  if (method === "GET" && url === "/api/agent/status") {
    sendJson(response, 200, { ok: true, agent: agent.status() });
    return;
  }

  if (method === "POST" && url === "/api/agent/configure") {
    const body = await readJsonBody(request);
    agent.configure({
      name: typeof body.name === "string" ? body.name : undefined,
      persona: typeof body.persona === "string" ? body.persona : undefined,
      avatarDataUrl: typeof body.avatarDataUrl === "string" ? body.avatarDataUrl : undefined
    });
    sendJson(response, 200, { ok: true, agent: agent.status() });
    return;
  }

  if (method === "POST" && url === "/api/agent/communicate") {
    const body = await readJsonBody(request);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length === 0) {
      sendJson(response, 400, { ok: false, error: "Field 'message' is required." });
      return;
    }
    sendJson(response, 200, { ok: true, result: agent.communicate({ message }) });
    return;
  }

  if (method === "POST" && url === "/api/agent/decide") {
    const body = await readJsonBody(request);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const options = Array.isArray(body.options)
      ? (body.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      : [];
    if (question.length === 0) {
      sendJson(response, 400, { ok: false, error: "Field 'question' is required." });
      return;
    }
    if (options.length < 2) {
      sendJson(response, 400, { ok: false, error: "At least two non-empty options are required." });
      return;
    }
    sendJson(response, 200, { ok: true, result: agent.decide({ question, options }) });
    return;
  }

  if (method === "POST" && url === "/api/agent/advise") {
    const body = await readJsonBody(request);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length === 0) {
      sendJson(response, 400, { ok: false, error: "Field 'query' is required." });
      return;
    }
    sendJson(response, 200, { ok: true, result: agent.advise({ query }) });
    return;
  }

  sendJson(response, 404, { ok: false, error: "Not found" });
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendJavaScript(response: ServerResponse, body: string): void {
  response.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendCss(response: ServerResponse, body: string): void {
  response.writeHead(200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SB689 Complete System</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <p class="eyebrow">SB688 + SB689</p>
        <h1>Complete System Console</h1>
        <p class="subtitle">Unified runtime, resilience supervisor, audit ledger, and live operator panel.</p>
      </header>

      <section class="panel action-panel">
        <h2>Run Request</h2>
        <label for="intentText">Intent</label>
        <textarea id="intentText" rows="4">Build one complete SB688 and SB689 system response.</textarea>

        <div class="inline-controls">
          <label class="toggle">
            <input id="pulseAlive" type="checkbox" checked />
            <span>Pulse alive</span>
          </label>
          <button id="runIntent" class="btn btn-primary">Run Runtime + Omega Tick</button>
          <button id="tickOnly" class="btn">Tick Omega Only</button>
          <button id="connectStitch" class="btn">Connect To Stitch</button>
        </div>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Runtime Result</h2>
          <pre id="runtimeResult">No runtime execution yet.</pre>
        </article>
        <article class="panel">
          <h2>Omega Status</h2>
          <pre id="omegaStatus">No omega status loaded.</pre>
        </article>
      </section>

      <section class="panel">
        <h2>Ledger</h2>
        <button id="refreshLedger" class="btn">Refresh Ledger</button>
        <pre id="ledgerResult">No ledger data loaded.</pre>
      </section>

      <section class="panel agent-panel" id="agentScreen">
        <header class="agent-header">
          <div class="agent-avatar-wrap">
            <div class="agent-avatar" id="agentAvatarPreview" aria-label="Agent avatar preview">
              <span class="agent-avatar-placeholder" id="agentAvatarPlaceholder">&#129776;</span>
              <img id="agentAvatarImg" src="" alt="Agent avatar" style="display:none;" />
            </div>
            <label class="btn agent-upload-btn" for="agentAvatarInput" title="Upload avatar image">
              &#128247; Upload Avatar
              <input id="agentAvatarInput" type="file" accept="image/*" aria-label="Upload agent avatar" />
            </label>
          </div>
          <div class="agent-identity">
            <h2 id="agentNameDisplay">Sovereign Agent</h2>
            <p class="agent-persona-display" id="agentPersonaDisplay">A precise, logical, data-researched AI advisor.</p>
            <div class="agent-config-row">
              <input id="agentNameInput" class="agent-text-input" type="text" placeholder="Agent name" value="Sovereign Agent" aria-label="Agent name" />
              <input id="agentPersonaInput" class="agent-text-input" type="text" placeholder="Agent persona" value="A precise, logical, data-researched AI advisor." aria-label="Agent persona" />
              <button id="agentSaveConfig" class="btn btn-primary">Save Config</button>
            </div>
          </div>
        </header>

        <div class="agent-body grid">
          <article class="panel agent-sub-panel">
            <h3>&#128172; Communicate</h3>
            <div class="agent-chat" id="agentChat" aria-live="polite" aria-label="Agent chat history"></div>
            <div class="agent-chat-input-row">
              <input id="agentMessageInput" class="agent-text-input" type="text" placeholder="Type a message…" aria-label="Chat message input" />
              <button id="agentSendMessage" class="btn btn-primary">Send</button>
            </div>
          </article>

          <article class="panel agent-sub-panel">
            <h3>&#9878; Decide</h3>
            <input id="agentDecideQuestion" class="agent-text-input" type="text" placeholder="Decision question…" aria-label="Decision question" />
            <textarea id="agentDecideOptions" class="agent-textarea" rows="3" placeholder="Option A&#10;Option B&#10;Option C" aria-label="Decision options (one per line)"></textarea>
            <button id="agentDecideBtn" class="btn btn-primary">Decide</button>
            <pre id="agentDecideResult" class="agent-result">No decision yet.</pre>
          </article>

          <article class="panel agent-sub-panel">
            <h3>&#128161; Advise</h3>
            <textarea id="agentAdviseQuery" class="agent-textarea" rows="3" placeholder="Ask for advice on any topic…" aria-label="Advice query"></textarea>
            <button id="agentAdviseBtn" class="btn btn-primary">Get Advice</button>
            <pre id="agentAdviseResult" class="agent-result">No advice yet.</pre>
          </article>
        </div>
      </section>
    </main>
    <script src="/app.js" defer></script>
  </body>
</html>`;

const STYLES_CSS = `:root {
  --bg-0: #041016;
  --bg-1: #0c2a38;
  --bg-2: #123f4e;
  --panel: rgba(255, 255, 255, 0.92);
  --ink: #13242a;
  --ink-soft: #39535d;
  --accent: #d69d28;
  --accent-strong: #9a2e1d;
  --edge: #8bbdc8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--ink);
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at 20% -10%, #2e7f91 0%, transparent 50%),
    radial-gradient(circle at 100% 0%, #15404f 0%, transparent 38%),
    linear-gradient(145deg, var(--bg-0), var(--bg-1) 45%, var(--bg-2));
  min-height: 100vh;
}

.shell {
  width: min(1100px, 92vw);
  margin: 2rem auto;
  display: grid;
  gap: 1rem;
}

.hero {
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #f7fbfc;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(14, 26, 33, 0.92), rgba(24, 67, 80, 0.72));
  animation: slide-up 420ms ease-out;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.18rem;
  text-transform: uppercase;
  color: #f7c86d;
}

.subtitle {
  margin-bottom: 0;
  color: #d8e7ec;
}

.panel {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: var(--panel);
  backdrop-filter: blur(3px);
  padding: 1rem;
  animation: fade-in 520ms ease-out;
}

h1,
h2 {
  margin-top: 0;
}

.action-panel textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--edge);
  padding: 0.8rem;
  resize: vertical;
  color: var(--ink);
}

.inline-controls {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
}

.toggle {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  color: var(--ink-soft);
  margin-right: 0.4rem;
}

.btn {
  border: 1px solid #305764;
  background: #f4f7f8;
  color: #193440;
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  cursor: pointer;
  transition: transform 120ms ease, background-color 120ms ease;
}

.btn:hover {
  transform: translateY(-1px);
  background: #eaf1f4;
}

.btn-primary {
  background: linear-gradient(120deg, var(--accent), #f2cb68);
  border-color: #9f7618;
  color: #3d2400;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

pre {
  margin: 0;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
  border: 1px solid #c8d9df;
  background: #ffffff;
  border-radius: 8px;
  padding: 0.8rem;
  color: #263f49;
}

@media (max-width: 640px) {
  .shell {
    width: 94vw;
    margin-top: 1.2rem;
  }

  .inline-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .btn {
    width: 100%;
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ── Agent Screen ──────────────────────────────────────────────────────────── */

.agent-panel {
  border-top: 3px solid var(--accent);
}

.agent-header {
  display: flex;
  gap: 1.2rem;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.agent-avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.agent-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: linear-gradient(135deg, #0e2835, #1d5468);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.agent-avatar-placeholder {
  font-size: 2.4rem;
  line-height: 1;
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-upload-btn {
  font-size: 0.78rem;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}

.agent-upload-btn input[type="file"] {
  display: none;
}

.agent-identity {
  flex: 1;
  min-width: 200px;
}

.agent-identity h2 {
  margin-bottom: 0.2rem;
  color: var(--ink);
}

.agent-persona-display {
  color: var(--ink-soft);
  font-style: italic;
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
}

.agent-config-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.agent-text-input {
  flex: 1;
  min-width: 140px;
  border-radius: 8px;
  border: 1px solid var(--edge);
  padding: 0.5rem 0.7rem;
  color: var(--ink);
  font-family: inherit;
  font-size: 0.9rem;
}

.agent-textarea {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--edge);
  padding: 0.6rem 0.8rem;
  color: var(--ink);
  font-family: inherit;
  font-size: 0.88rem;
  resize: vertical;
  margin-bottom: 0.5rem;
}

.agent-body {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.agent-sub-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.6);
}

.agent-sub-panel h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
  color: var(--ink);
}

.agent-chat {
  min-height: 120px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--edge);
  border-radius: 8px;
  padding: 0.6rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.agent-chat-bubble {
  padding: 0.4rem 0.7rem;
  border-radius: 10px;
  font-size: 0.88rem;
  max-width: 92%;
  line-height: 1.4;
  word-break: break-word;
}

.agent-chat-bubble.user {
  align-self: flex-end;
  background: linear-gradient(120deg, var(--accent), #f2cb68);
  color: #3d2400;
}

.agent-chat-bubble.agent {
  align-self: flex-start;
  background: #e8f3f7;
  color: var(--ink);
}

.agent-chat-input-row {
  display: flex;
  gap: 0.5rem;
}

.agent-chat-input-row .agent-text-input {
  flex: 1;
}

.agent-result {
  min-height: 80px;
  max-height: 220px;
  overflow: auto;
  font-size: 0.82rem;
  margin-top: 0.4rem;
}`;

const APP_JS = `const runtimeResult = document.getElementById("runtimeResult");
const omegaStatus = document.getElementById("omegaStatus");
const ledgerResult = document.getElementById("ledgerResult");
const intentText = document.getElementById("intentText");
const pulseAlive = document.getElementById("pulseAlive");

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

async function callApi(path, payload) {
  const response = await fetch(path, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });

  const body = await response.json();
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || "Request failed (" + response.status + ")");
  }
  return body;
}

async function runIntent() {
  const text = intentText.value.trim();
  if (!text) {
    runtimeResult.textContent = "Intent text is required.";
    return;
  }

  try {
    const body = await callApi("/api/runtime/run", {
      text,
      pulseAlive: pulseAlive.checked
    });

    runtimeResult.textContent = pretty(body.result.runtime);
    omegaStatus.textContent = pretty(body.result.omega);
  } catch (error) {
    runtimeResult.textContent = String(error);
  }
}

async function tickOnly() {
  try {
    const body = await callApi("/api/omega/tick", { pulseAlive: pulseAlive.checked });
    omegaStatus.textContent = pretty(body.omega);
  } catch (error) {
    omegaStatus.textContent = String(error);
  }
}

async function connectToStitch() {
  try {
    const body = await callApi("/api/omega/connect", {});
    omegaStatus.textContent = pretty({ handshake: body.handshake, status: await callApi("/api/omega/status") });
  } catch (error) {
    omegaStatus.textContent = String(error);
  }
}

async function refreshLedger() {
  try {
    const body = await callApi("/api/ledger");
    ledgerResult.textContent = pretty(body);
  } catch (error) {
    ledgerResult.textContent = String(error);
  }
}

document.getElementById("runIntent").addEventListener("click", runIntent);
document.getElementById("tickOnly").addEventListener("click", tickOnly);
document.getElementById("connectStitch").addEventListener("click", connectToStitch);
document.getElementById("refreshLedger").addEventListener("click", refreshLedger);

// ── Agent Screen ────────────────────────────────────────────────────────────

const agentNameInput = document.getElementById("agentNameInput");
const agentPersonaInput = document.getElementById("agentPersonaInput");
const agentNameDisplay = document.getElementById("agentNameDisplay");
const agentPersonaDisplay = document.getElementById("agentPersonaDisplay");
const agentAvatarImg = document.getElementById("agentAvatarImg");
const agentAvatarPlaceholder = document.getElementById("agentAvatarPlaceholder");
const agentAvatarInput = document.getElementById("agentAvatarInput");
const agentChat = document.getElementById("agentChat");
const agentMessageInput = document.getElementById("agentMessageInput");
const agentDecideQuestion = document.getElementById("agentDecideQuestion");
const agentDecideOptions = document.getElementById("agentDecideOptions");
const agentDecideResult = document.getElementById("agentDecideResult");
const agentAdviseQuery = document.getElementById("agentAdviseQuery");
const agentAdviseResult = document.getElementById("agentAdviseResult");

function appendChatBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = "agent-chat-bubble " + role;
  bubble.textContent = text;
  agentChat.appendChild(bubble);
  agentChat.scrollTop = agentChat.scrollHeight;
}

agentAvatarInput.addEventListener("change", function () {
  const file = agentAvatarInput.files && agentAvatarInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (event) {
    const dataUrl = event.target.result;
    agentAvatarImg.src = dataUrl;
    agentAvatarImg.style.display = "block";
    agentAvatarPlaceholder.style.display = "none";
    try {
      await callApi("/api/agent/configure", { avatarDataUrl: dataUrl });
    } catch (err) {
      console.error("Avatar save failed:", err);
    }
  };
  reader.readAsDataURL(file);
});

document.getElementById("agentSaveConfig").addEventListener("click", async function () {
  const name = agentNameInput.value.trim();
  const persona = agentPersonaInput.value.trim();
  if (!name) { agentNameInput.focus(); return; }
  try {
    const body = await callApi("/api/agent/configure", { name, persona });
    agentNameDisplay.textContent = body.agent.name;
    agentPersonaDisplay.textContent = body.agent.persona;
  } catch (err) {
    agentNameDisplay.textContent = String(err);
  }
});

document.getElementById("agentSendMessage").addEventListener("click", async function () {
  const message = agentMessageInput.value.trim();
  if (!message) { agentMessageInput.focus(); return; }
  appendChatBubble("user", message);
  agentMessageInput.value = "";
  try {
    const body = await callApi("/api/agent/communicate", { message });
    appendChatBubble("agent", body.result.reply);
  } catch (err) {
    appendChatBubble("agent", "Error: " + String(err));
  }
});

agentMessageInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") document.getElementById("agentSendMessage").click();
});

document.getElementById("agentDecideBtn").addEventListener("click", async function () {
  const question = agentDecideQuestion.value.trim();
  const options = agentDecideOptions.value
    .split("\\n")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
  if (!question) { agentDecideQuestion.focus(); return; }
  if (options.length < 2) {
    agentDecideResult.textContent = "Please enter at least two options (one per line).";
    return;
  }
  try {
    const body = await callApi("/api/agent/decide", { question, options });
    agentDecideResult.textContent = pretty(body.result);
  } catch (err) {
    agentDecideResult.textContent = String(err);
  }
});

document.getElementById("agentAdviseBtn").addEventListener("click", async function () {
  const query = agentAdviseQuery.value.trim();
  if (!query) { agentAdviseQuery.focus(); return; }
  try {
    const body = await callApi("/api/agent/advise", { query });
    agentAdviseResult.textContent = pretty(body.result);
  } catch (err) {
    agentAdviseResult.textContent = String(err);
  }
});

void (async () => {
  await refreshLedger();
  const health = await callApi("/api/health");
  omegaStatus.textContent = pretty(health);
  try {
    const agentStatus = await callApi("/api/agent/status");
    agentNameDisplay.textContent = agentStatus.agent.name;
    agentNameInput.value = agentStatus.agent.name;
    agentPersonaDisplay.textContent = agentStatus.agent.persona;
    agentPersonaInput.value = agentStatus.agent.persona;
  } catch {
    // non-fatal
  }
})();`;
