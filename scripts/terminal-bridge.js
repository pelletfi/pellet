#!/usr/bin/env node

const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const PORT = parseInt(process.env.PELLET_TERMINAL_PORT || "7778", 10);
const SHELL = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "/bin/zsh");

let activeConnection = null;

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

console.log(`pellet terminal bridge listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  if (activeConnection) {
    ws.close(4001, "another session is already active");
    return;
  }

  const onboarded = require("fs").existsSync(
    require("path").join(os.homedir(), ".pellet", ".onboarded")
  );
  const shellCmd = onboarded ? SHELL : require("path").resolve(__dirname, "welcome.sh");

  const term = pty.spawn(shellCmd, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: {
      ...process.env,
      PELLET_WALLET: "1",
      TERM: "xterm-256color",
      SHELL: SHELL,
    },
  });

  activeConnection = ws;

  term.onData((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ws.on("message", (msg) => {
    const str = msg.toString();
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    term.write(str);
  });

  ws.on("close", () => {
    term.kill();
    activeConnection = null;
  });

  term.onExit(() => {
    if (ws.readyState === 1) ws.close(1000, "shell exited");
    activeConnection = null;
  });
});
