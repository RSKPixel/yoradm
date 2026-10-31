#!/usr/bin/env bash
# Run on the Mac: copies the app to the build server and starts an APK build
# there in tmux, so you can keep working. The APK lands in $REMOTE_DIR/build/.
set -euo pipefail

SERVER="${SERVER:-saravanakumar@192.168.0.160}"
REMOTE_DIR="${REMOTE_DIR:-servers/yoradm/mobile}"
cd "$(dirname "$0")/.."

# .env.local is excluded so the APK uses the production API from .env.
rsync -az --delete \
  --exclude node_modules --exclude .expo --exclude .git --exclude build \
  --exclude '.env*.local' \
  ./ "$SERVER:$REMOTE_DIR/"

ssh "$SERVER" "tmux new-session -d -s yoradm-apk 'bash -lc \"source ~/.android-env; cd $REMOTE_DIR && npm ci && mkdir -p build && npx eas-cli@latest build -p android --profile preview --local --non-interactive --output build/yoradm-sales-\$(date +%Y%m%d-%H%M).apk; echo; echo Build finished. Press Enter.; read\"'"

echo "Build started on $SERVER."
echo "Watch it:   ssh -t $SERVER tmux attach -t yoradm-apk   (detach: Ctrl+B then D)"
echo "Get APK:    scp '$SERVER:$REMOTE_DIR/build/*.apk' ."
