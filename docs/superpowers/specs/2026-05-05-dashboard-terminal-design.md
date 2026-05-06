# Dashboard Terminal Integration

Replace the chat interface with an embedded terminal emulator. The terminal is the primary interaction surface — users type agent CLIs (claude, codex, etc.) directly in the dashboard.

## Layout Changes

### Main Column (left, flex: 2.2)
- **Was:** 7-day signed payments table
- **Now:** Embedded terminal (xterm.js)
- Terminal fills the card container, minimal "TERMINAL" uppercase label header matching existing card style
- No window chrome (no traffic lights) — card border/shadow defines boundary

### Right Rail (flex: 1)
Card order top to bottom:
1. Agent Identity card (unchanged)
2. Signed Payments card (moved from main column) — compact, scrollable, fixed height, shows full transaction list with internal scroll. "View all" link to transactions page
3. Session Keys card (unchanged)
4. Pending Authorizations card (unchanged)

### Mobile (<600px)
Single column: terminal on top (~50vh fixed height), rail cards below in scrollable area.

### Navigation
- Remove "Chat" from nav bar
- Add "Txs" in its place, linking to full transactions page
- Full chat page (`/wallet/chat`, `/oli/wallet/chat`) remains accessible but is no longer in primary nav

## Terminal Component

### TerminalCard.tsx
React client component wrapping xterm.js.

**Dependencies:**
- `@xterm/xterm` — terminal emulator
- `@xterm/addon-fit` — auto-resize to container
- `@xterm/addon-webgl` — GPU-accelerated rendering

**Theming:**
- Follows dashboard theme (light/dark)
- Reads CSS custom properties: `--bg`, `--fg`, and derived colors
- Light mode: white background, dark text
- Dark mode: dark background, light text
- Font: Commit Mono (matches dashboard), falls back to ui-monospace

**Behavior:**
- On mount, attempts websocket connection to `ws://localhost:7778/terminal`
- Connected state: live interactive terminal, user can type freely
- Disconnected state: shows connection instructions inside the terminal area (monospace styled, not a modal)
- Auto-reconnects on disconnect with backoff
- Fits to container on resize (addon-fit)

### Connection Instructions (disconnected state)
Rendered inside the terminal card area in monospace, not a separate UI:
```
  pellet terminal

  start your local bridge to connect:

    npx pellet-terminal

  or add to your dev script:

    "dev": "next dev & npx pellet-terminal"
```

## Backend: Local WebSocket Bridge

### pellet-terminal binary
Lightweight local-only websocket server. Ships as an npx-runnable package or script in the repo.

**What it does:**
1. Starts websocket server on `localhost:7778`
2. On connection, spawns user's shell (`$SHELL` or `/bin/zsh`)
3. Pipes stdin/stdout/stderr between websocket and shell process
4. Sets wallet-aware environment variables (`PELLET_WALLET_ADDRESS`, `PELLET_SESSION_KEY`, etc.) so agents have wallet context
5. Single connection at a time (rejects additional connections)

**Security:**
- Binds to `localhost` only — not accessible from network
- No authentication needed (local machine trust model)
- Shell runs as the current user with their normal permissions

**Implementation:**
- Node.js script using `ws` library + `node-pty` for PTY allocation
- PTY required for proper terminal behavior (colors, cursor movement, ctrl-c, etc.)
- Can be a script at `scripts/terminal-bridge.js` initially, extracted to a package later

## Components Removed

- `ChatRailCard.tsx` — replaced by TerminalCard
- `ChatDrawer.tsx` — replaced by TerminalCard on mobile too
- Chat rail card CSS (in specimen-wallet.css)
- Chat drawer CSS (in ChatDrawer.tsx inline styles)

**Not removed:**
- Chat SSE endpoints (`/api/wallet/chat/stream`, `/api/wallet/chat/reply`) — agents still use these
- Full chat page component (`SpecimenWalletChat.tsx`) — remains accessible, just not in primary nav
- Chat message database tables — still needed for agent communication

## Components Modified

- `SpecimenWalletDashboard.tsx` — swap ChatRailCard for TerminalCard in main column, move signed payments to rail
- `Dashboard.tsx` — same layout swap
- `WalletTabs.tsx` or nav component — "Chat" → "Txs"
- `specimen-wallet.css` — update column content styles, add terminal card styles
- `specimen-wallet-pages.css` — add transactions full page styles if needed

## New Files

- `app/wallet/dashboard/TerminalCard.tsx` — xterm.js wrapper component
- `scripts/terminal-bridge.js` — local websocket PTY server
- `app/oli/wallet/dashboard/txs/page.tsx` — full transactions page (does not exist yet)
- `app/wallet/dashboard/txs/page.tsx` — canonical route equivalent

## Port Convention

WebSocket bridge runs on `localhost:7778`. Chosen to avoid conflicts with common dev ports (3000, 3001, 5173, 8080). Configurable via `PELLET_TERMINAL_PORT` env var.
