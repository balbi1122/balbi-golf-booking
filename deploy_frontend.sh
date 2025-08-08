#!/usr/bin/env bash
set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  echo "Installing Railway CLI..."
  curl -fsSL https://railway.app/install.sh | sh
  export PATH="$HOME/.railway/bin:$PATH"
fi

cd "$(dirname "$0")/frontend_app"

echo "Railway login…"
railway login || true

echo "Linking to project: responsible-generosity"
railway link --project responsible-generosity

if [ -z "${VITE_API_BASE_URL:-}" ]; then
  echo "Set VITE_API_BASE_URL to your backend URL, e.g.:"
  echo "  export VITE_API_BASE_URL=https://responsible-generosity.up.railway.app"
  exit 1
fi

echo "Setting VITE_API_BASE_URL for frontend service…"
railway variables set VITE_API_BASE_URL="$VITE_API_BASE_URL"

echo "Deploying frontend…"
railway up

echo "Frontend deploy complete. Railway will show the frontend service URL."
