#!/usr/bin/env node

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const PORT = parseInt(process.env.PELLET_TERMINAL_PORT || "7778", 10);
const SHELL = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "/bin/zsh");
const SCROLLBACK_SIZE = 4096;

let term = null;
let scrollback = "";
let interacted = false;
let client = null;
let sessionAddr = null;
let cleanupTimer = null;

function spawnPty() {
  const onboarded = require("fs").existsSync(
    require("path").join(os.homedir(), ".pellet", ".onboarded")
  );
  const welcomeScript = require("path").resolve(__dirname, "welcome.sh");
  const shellCmd = onboarded ? SHELL : "/bin/bash";
  const shellArgs = onboarded ? [] : [welcomeScript];

  term = pty.spawn(shellCmd, shellArgs, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: {
      ...process.env,
      PELLET_WALLET: "1",
      TERM: "xterm-256color",
      SHELL: SHELL,
      ZDOTDIR: require("path").resolve(__dirname, "pellet-shell"),
    },
  });

  scrollback = "";
  interacted = false;

  term.onData((data) => {
    scrollback += data;
    if (scrollback.length > SCROLLBACK_SIZE) {
      scrollback = scrollback.slice(-SCROLLBACK_SIZE);
    }
    if (client?.readyState === 1) client.send(data);
  });

  term.onExit(() => {
    term = null;
    scrollback = "";
    if (client?.readyState === 1) client.close(1000, "shell exited");
    client = null;
  });
}

spawnPty();

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
console.log(`pellet terminal bridge listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  if (client) {
    client.removeAllListeners?.();
    client.close(4001, "replaced by new connection");
    client = null;
  }

  if (!term) spawnPty();

  client = ws;

  let initSent = false;

  function sendInit() {
    if (initSent) return;
    initSent = true;
    ws.send(JSON.stringify({ type: "init", fresh: !interacted }));
    if (scrollback.length > 0) ws.send(scrollback);
    setTimeout(() => { if (term) term.resize(term.cols, term.rows); }, 50);
  }

  ws.on("message", (msg) => {
    const str = msg.toString();
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "session") {
        if (sessionAddr && parsed.address !== sessionAddr) {
          if (term) term.kill();
          spawnPty();
        }
        sessionAddr = parsed.address;
        sendInit();
        return;
      }
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        if (term) term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    interacted = true;
    if (term) term.write(str);
  });

  // Fallback if client never sends session message.
  setTimeout(() => sendInit(), 200);

  ws.on("close", () => {
    if (client === ws) {
      client = null;
      cleanupTimer = setTimeout(() => {
        if (!client && term) {
          term.kill();
          term = null;
          scrollback = "";
          interacted = false;
          sessionAddr = null;
        }
      }, 5000);
    }
  });
});
