# NOVEXA NOWCAST

Advanced Convective-Scale Nowcasting & Early-Warning Platform for Maharashtra

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + MapLibre GL
  - Location: `frontend/`
  - Operational Command Center: Clean, authentic meteorological command experience
  - Scenario Lab: Synthetic weather experiments, multi-cell replay, sensitivity testing
- **Backend Engine**: FastAPI + NumPy + Pydantic v2
  - Location: `backend/`
  - Convective tracking, multi-hazard assessment, spatial district/regional risk mapping

---

## Quick Start

### 1. Start Backend (FastAPI)

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API runs at `http://127.0.0.1:8000`.
API Docs: `http://127.0.0.1:8000/docs`.

### 2. Start Frontend (Vite)

```powershell
cd frontend
pnpm install
pnpm dev
```
Access the application at `http://localhost:8443`.

---

## Documentation

- [API & Data Contract](file:///c:/IT/SIH/SIH_84/docs/API-CONTRACT.md)
- [System Status & Observability Contract](file:///c:/IT/SIH/SIH_84/docs/SYSTEM-STATUS-CONTRACT.md)
- [System Audit & Integrity Report](file:///c:/IT/SIH/SIH_84/docs/final-system-audit.md)

## Deploying to Render and Vercel

The repository includes deployment manifests in
[render.yaml](file:///c:/IT/SIH/SIH_84/render.yaml) and
[frontend/vercel.json](file:///c:/IT/SIH/SIH_84/frontend/vercel.json).

1. Create a Render Web Service from this repository. Use the `backend`
   directory as the service root, or let Render apply `render.yaml`.
2. After Render deploys, copy its HTTPS URL, for example
   `https://novexa-nowcast-backend.onrender.com`.
3. Set Render `CORS_ORIGINS` to the Vercel production URL. Add preview or
   custom-domain origins as comma-separated values.
4. Create a Vercel project from this repository and set its Root Directory
   to `frontend`.
5. Set the Vercel environment variable
   `VITE_API_URL=https://novexa-nowcast-backend.onrender.com/api` for
   Production, Preview, and Development as appropriate.
6. Redeploy Vercel. Select `BACKEND` / `LIVE / API` and verify:
   `/api/v1/health`, `/api/v1/ready`, and the WebSocket connection.

The current backend has no database or secret credentials. Render's
filesystem should be treated as ephemeral.

---

## Verification & Testing

```powershell
# Run backend test suite
cd backend
python -m pytest tests

# Run frontend build & type check
cd frontend
npx tsc --noEmit
npm run build
```