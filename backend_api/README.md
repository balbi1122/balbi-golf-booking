# Balbi Golf Backend API (MVP)

This is a functional backend API scaffold for your booking system. It includes:
- Health endpoints (`/ready`, `/health`)
- Availability calculation with 15-min slots, 15-min buffer, and 4/day limit
- Book endpoint with cash discount and prepaid handling
- Block time endpoint
- Seed endpoint (protected by `SEED_TOKEN`)
- Weather alert manual trigger stub
- SQLite (better-sqlite3) storage

## Quick start
```bash
npm install
cp .env.example .env
# Fill .env values
npm run dev
```

## Endpoints
- `GET /ready` → `{ ok: true }`
- `GET /health` → `{ status: 'ok' }`
- `GET /api/availability?date=YYYY-MM-DD&duration=30|45|60`
- `POST /api/book` → body: `{ date, time, duration, student:{ email, name, phone, address }, payment_type: 'card'|'cash'|'prepaid' }`
- `POST /api/admin/block` → body: `{ start: ISO, end: ISO, note }`
- `POST /api/admin/seed` → header: `x-seed-token: <SEED_TOKEN>`
- `POST /api/admin/weather/alert` → body: `{ date: 'YYYY-MM-DD' }`

> This is an MVP backend. Gmail/Twilio/Calendar/Sheets integration points are scaffolded in code and can be completed if you want this repo to be the single source of truth.


## Gmail token helper
Run `node get-token.js` to obtain and auto-write GMAIL_REFRESH_TOKEN into ../.env.production.
