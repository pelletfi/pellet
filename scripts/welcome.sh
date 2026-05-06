#!/usr/bin/env bash
set -euo pipefail

FLAG="$HOME/.pellet/.onboarded"

if [[ -f "$FLAG" ]]; then
  exec "$SHELL"
fi

clear

cat << 'ART'

  pellet

ART

echo ""
echo "  which agent? (type name)"
printf "  > "
read -r AGENT_NAME

AGENT_NAME=$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | xargs)

if [[ -z "$AGENT_NAME" ]]; then
  echo ""
  echo "  no agent specified — dropping to shell"
  echo ""
  exec "$SHELL"
fi

MCP_ENTRY='{ "command": "npx", "args": ["pellet-mcp"] }'

case "$AGENT_NAME" in
  claude)
    CONFIG="$HOME/.claude/settings.json"
    if [[ -f "$CONFIG" ]]; then
      echo ""
      echo "  found claude at $CONFIG"
      echo "  add pellet wallet to claude's MCP servers? (y/n)"
      printf "  > "
      read -r CONFIRM
      if [[ "$CONFIRM" =~ ^[Yy] ]]; then
        node -e "
          const fs = require('fs');
          const cfg = JSON.parse(fs.readFileSync('$CONFIG', 'utf8'));
          cfg.mcpServers = cfg.mcpServers || {};
          cfg.mcpServers.pellet = { command: 'npx', args: ['pellet-mcp'] };
          fs.writeFileSync('$CONFIG', JSON.stringify(cfg, null, 2) + '\n');
        "
        echo ""
        echo "  done. launching claude..."
      else
        echo ""
        echo "  skipped. launching claude..."
      fi
    else
      echo ""
      echo "  claude config not found at $CONFIG"
      echo "  add this to your MCP config:"
      echo ""
      echo "    \"pellet\": $MCP_ENTRY"
      echo ""
      echo "  launching claude..."
    fi
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec claude
    ;;
  codex)
    echo ""
    echo "  add this MCP server to your codex config:"
    echo ""
    echo "    \"pellet\": $MCP_ENTRY"
    echo ""
    echo "  launching codex..."
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec codex
    ;;
  *)
    echo ""
    echo "  to connect $AGENT_NAME, add this MCP server:"
    echo ""
    echo "    \"pellet\": $MCP_ENTRY"
    echo ""
    echo "  dropping to shell..."
    echo ""
    mkdir -p "$HOME/.pellet"
    touch "$FLAG"
    exec "$SHELL"
    ;;
esac
