# NOVEXA NOWCAST Backend

This is an offline-first FastAPI prototype for coherent synthetic/replay nowcasting. It does not claim live DWR, INSAT, or national lightning feeds.

## Start

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Useful URLs:

- `http://127.0.0.1:8000/api/health`
- `http://127.0.0.1:8000/api/ready`
- `http://127.0.0.1:8000/docs`
- `ws://127.0.0.1:8000/api/ws/nowcast`

Run tests with:

```powershell
python -m pytest -q
```

For a separate frontend deployment, set `CORS_ORIGINS` to the exact Vercel
origin (comma-separated for multiple preview/custom origins), for example:

```text
CORS_ORIGINS=https://novexa-nowcast.vercel.app,https://www.example.com
```

The Vercel frontend uses `VITE_API_URL=https://novexa-backend.onrender.com/api`.

The default analysis domain is the complete Maharashtra polygon, not the map viewport or Pune. Set `ANALYSIS_RESOLUTION=MEDIUM` or `FINE` to change the configured 2 km or 1 km grid resolution.

## Processing path

Shared deterministic storm truth -> replay source observations -> quality and alignment -> features -> weighted fusion -> cell detection/tracking -> motion forecast -> four hazard rules -> confidence -> alerts and trace.

All output is synthetic/replay data and is labelled accordingly by the health response and source metadata.

