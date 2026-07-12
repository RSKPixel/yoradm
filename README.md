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

## Notes

- Never commit `backend/.env` or `frontend/.env`
- Alembic only manages `yoradm_*` tables; Tally tables are never migrated by this app
# yoradm
