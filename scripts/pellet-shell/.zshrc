PROMPT='pellet %F{67}>_%f '
PROMPT_EOL_MARK=""
HISTFILE="${HOME}/.zsh_history"
HISTSIZE=2000
SAVEHIST=2000
setopt SHARE_HISTORY

# Resolve the locally-built CLI path. Falls back to globally installed `pellet`.
PELLET_CLI="${PELLET_CLI:-${ZDOTDIR}/../../cli/dist/index.js}"
if [ -f "$PELLET_CLI" ]; then
  alias pellet="node $PELLET_CLI"
fi
# Note: the wallet's TerminalCard triggers `pellet` via WS after the welcome
# typewriter completes — we don't auto-launch here to avoid colliding with it.
# To force-launch in a non-wallet shell, just type `pellet`.
