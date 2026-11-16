#!/bin/sh
# Starts Eluvo on this computer. On a Mac, double-click this file. On Linux, run:  sh start.command
cd "$(dirname "$0")" || exit 1
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Eluvo needs Node.js, which is not installed on this computer."
  echo "Get the LTS version from https://nodejs.org and install it."
  echo "Then open this file again."
  echo
  exit 1
fi
exec node tools/start.mjs "$@"
