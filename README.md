# Balbi Golf — Full Stack (Complete)

This bundle contains your **feature-complete backend** and **frontend** ready for Railway.

## Deploy (backend first)
```bash
bash deploy_backend.sh
```
- Pushes `.env.production` to Railway project **responsible-generosity**
- Deploys backend
- Waits for `/ready` or `/health`
- Auto-seeds demo data via `/api/admin/seed` (uses `SEED_TOKEN`)

## Deploy (frontend second)
```bash
export VITE_API_BASE_URL=https://responsible-generosity.up.railway.app
bash deploy_frontend.sh
```
- Builds frontend on Railway and serves `dist/` via `serve`

## Local dev
Backend:
```bash
cd backend_api && npm install && cp .env.example .env && npm run dev
```
Frontend:
```bash
cd frontend_app && npm install && cp .env.sample .env && npm run dev
```
