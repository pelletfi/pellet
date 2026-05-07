PROMPT='pellet %F{67}>_%f '
HISTFILE="${HOME}/.zsh_history"
HISTSIZE=2000
SAVEHIST=2000
setopt SHARE_HISTORY

if [[ -z "$PELLET_HINT_SHOWN" ]]; then
  export PELLET_HINT_SHOWN=1
  print -P "%F{240}type your agent name · it pays as it works%f"
  print
fi
