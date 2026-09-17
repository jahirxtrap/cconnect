#!/bin/sh
set -e

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  curl -fsSL https://astral.sh/uv/install.sh | sh
  PATH="$HOME/.local/bin:$PATH"
  export PATH
fi

uv tool install --upgrade cconnect
uv tool update-shell >/dev/null 2>&1 || true

echo
echo "CConnect installed. Serve it with:  cconnect"
echo "Everything it can do:               cconnect --help"
