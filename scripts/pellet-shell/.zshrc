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

# Auto-launch the agent REPL on shell start (skip with PELLET_AGENT_AUTOSTART=0).
if [ "${PELLET_AGENT_AUTOSTART:-1}" = "1" ]; then
  pellet 2>/dev/null
fi
