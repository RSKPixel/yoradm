#!/usr/bin/env bash
# Run on the home server: pulls the latest code and builds the YORA DM APK locally.
# The APK lands in mobile/build/. Started outside tmux, it re-runs itself inside a
# tmux session so the build survives an SSH disconnect.
set -euo pipefail

SESSION="yoradm-apk"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

if [ -z "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "A build is already running. Attach with: tmux attach -t $SESSION"
    exit 1
  fi
  tmux new-session -s "$SESSION" "bash '$SCRIPT'; echo; echo 'Press Enter to close.'; read"
  exit 0
fi

cd "$(dirname "$SCRIPT")/.."

echo "==> Updating code"
git pull --ff-only

echo "==> Installing dependencies"
# shellcheck disable=SC1090
source ~/.android-env
npm ci

if ! node -e "process.exit(require('./app.json').expo?.extra?.eas?.projectId ? 0 : 1)"; then
  echo "This app isn't linked to an Expo project yet. Run once, then commit app.json:"
  echo "  cd $(pwd) && npx eas-cli@latest init"
  exit 1
fi

mkdir -p build
APK="build/yora-dm-$(date +%Y%m%d-%H%M).apk"

echo "==> Building $APK"
npx eas-cli@latest build -p android --profile preview --local --non-interactive --output "$APK"

echo
echo "Done: $(pwd)/$APK"
echo "Copy to the Mac:  scp \"$(whoami)@$(hostname -I 2>/dev/null | awk '{print $1}'):$(pwd)/$APK\" ~/Downloads/"
