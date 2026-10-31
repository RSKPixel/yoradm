# Yoradm — Dhall Mill ERP

Full-stack ERP foundation with JWT auth, role-based access, and read-only access to existing Tally sync tables (`tallydata_*`). App-owned tables use the `yoradm_` prefix.

## Stack

- **Frontend:** React 19, Vite, React Router, Tailwind CSS, Axios (JavaScript)
- **Backend:** FastAPI, SQLAlchemy 2, Alembic, MySQL
- **Auth:** JWT access + refresh tokens, bcrypt, Admin/User RBAC

## Project layout

```
yoradm/
├── backend/          # FastAPI API
├── frontend/         # React SPA
├── docker/           # Docker Compose + Dockerfiles
├── mobile/           # Expo app for salesmen (receivables)
└── README.md
```

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill MySQL + JWT values
alembic upgrade head
python scripts/seed_admin.py
uvicorn app.main:app --reload --port 8003
```

API docs: http://localhost:8003/docs

### Default admin (from `.env`)

- Username: `admin`
- Password: `ChangeMe123!`

Change these before any real deployment.

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: http://localhost:5175

## Docker (production)

MySQL is **not** included — point Compose at your existing MySQL host.

`docker/.env` is **gitignored** and is never uploaded with the repo. On every new server you must create it first:

```bash
cd /path/to/yoradm/docker          # use the real path on that server
cp .env.example .env
nano .env                          # set MYSQL_*, JWT_SECRET_KEY, CORS_ORIGINS, YORADM_PORT
docker compose up --build -d
docker compose exec backend python scripts/seed_admin.py   # first run only
```

App: http://localhost:8001 (or `YORADM_PORT` from `.env`)

- `frontend` — nginx serves the SPA and proxies `/api` → backend
- `backend` — Alembic migrate on start, then uvicorn on port 8003 (internal)
- Use `MYSQL_HOST=host.docker.internal` if MySQL runs on the Docker host; otherwise use the remote host/IP reachable from the container
- Do not copy your laptop path into the server — always `cd` into the server’s `yoradm/docker` directory before `docker compose`

## Auth & security

- Access tokens (short-lived) + refresh tokens (rotated, stored hashed)
- All APIs except `/api/v1/health`, `/api/v1/auth/login`, `/api/v1/auth/refresh` require JWT
- Admin-only: `/api/v1/users/*` and frontend `/users`
- Axios client retries once after automatic refresh on 401
- `tallydata_*` tables are mapped as ORM models and exposed read-only

## Key endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/refresh` | Public |
| POST | `/api/v1/auth/logout` | Public (refresh body) |
| GET | `/api/v1/auth/me` | Auth |
| CRUD | `/api/v1/users` | Admin |
| GET | `/api/v1/tally/dashboard` | Auth |
| GET | `/api/v1/tally/{accounts,inventory,sales,purchases,stock-summary,receivables}` | Auth |
| GET | `/api/v1/tally/receivables/representatives` | Auth |
| GET | `/api/v1/tally/receivables/analysis` | Auth |

## Notes

- Never commit `backend/.env`, `frontend/.env`, or `docker/.env`
- Alembic only manages `yoradm_*` tables; Tally tables are never migrated by this app

## Mobile app (salesmen)

Expo app in `mobile/` for salesmen to see receivables for their own Tally representatives only. There is no salesman login: each phone is authorised in person and the phone itself is the credential.

**Authorising a phone (web → Settings → Mobile Access):**

1. Enter the salesman's name, tick their Tally representatives, and click *Get activation code*.
2. On the salesman's phone, open YORA DM and enter the 8-character code. It works once and expires after 15 minutes (*New code* re-issues it).
3. To change what a phone sees, *Edit* its representatives; it applies on the phone's next request.

**Security model:**

- On activation the phone generates a random device ID + secret, kept in the hardware keystore; the server stores only a hash. A session (15-minute token) needs that secret, so the app's data can't be reached from any other phone.
- The phone must have a screen lock; the app asks for PIN/fingerprint on every open and after 60 s in the background.
- Rep scope comes only from the server-side mapping; a phone with no reps sees nothing.
- Mobile tokens (`/api/v1/m/*`) and web tokens are not interchangeable.
- *Revoke* signs the phone out immediately and the app wipes its credentials.
- Screenshots blocked, no data stored offline, HTTPS only in release builds. Activation and sessions are rate-limited per IP.
- Every mobile request is logged (Mobile Access → Recent mobile activity).

**Build:**

```bash
cd mobile
npm install
npx expo start -c                       # development / Expo Go (set EXPO_PUBLIC_API_URL in .env.local)
npx eas-cli@latest init                 # first time only: links the app to an Expo project
npx eas-cli@latest build -p android --profile preview      # APK
./scripts/build-apk.sh                  # or build on the home server, as with yorapet3
```

Release builds talk to `https://dm.yoratech.com/api/v1` and refuse plain HTTP.
