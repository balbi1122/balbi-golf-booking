#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://responsible-generosity.up.railway.app}"
SEED_TOKEN="${SEED_TOKEN:-please-change-this}"

if ! command -v railway >/dev/null 2>&1; then
  echo "Installing Railway CLI..."
  curl -fsSL https://railway.app/install.sh | sh
  export PATH="$HOME/.railway/bin:$PATH"
fi

cd "$(dirname "$0")/backend_api"

echo "Railway login…"
railway login || true

echo "Linking to project: responsible-generosity"
railway link --project responsible-generosity

echo "Pushing backend env vars from ../.env.production"
if [ -f "../.env.production" ]; then
  railway variables --from-file ../.env.production
else
  echo "WARNING: ../.env.production not found; skipping var push."
fi

echo "Deploying backend…"
railway up

echo "Waiting for backend readiness at $APP_URL ..."
ATTEMPTS=36; SLEEP=5; READY=0
for i in $(seq 1 $ATTEMPTS); do
  if curl -fsS "$APP_URL/ready" >/dev/null 2>&1 || curl -fsS "$APP_URL/health" >/dev/null 2>&1; then READY=1; break; fi
  echo "[$i/$ATTEMPTS] Not ready yet...retrying in ${SLEEP}s"; sleep $SLEEP
done
if [ "$READY" -eq 1 ]; then echo "Backend ready: $APP_URL"; else echo "Backend not ready yet (timeout)."; fi

echo "Auto-seeding backend (if token set)…"
curl -fsSL -X POST "$APP_URL/api/admin/seed" -H "x-seed-token: $SEED_TOKEN" || true
echo "Backend deploy complete."
