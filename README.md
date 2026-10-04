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