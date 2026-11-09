# Publicis-Sapient-Candidate-Tracker

This is a candidate tracking system to track candidates through a hiring pipeline, with filtering, a notes history, and an AI generated resume summary.

## Requirements

- Python 3.14 or newer, with [uv](https://docs.astral.sh/uv/)
- Node.js 22 or newer (tested with 24.15.0)

## Setup and run

Open two terminals in the project root.

**Terminal 1: backend**

```bash
cd backend
uv sync
uv run python -m app.seed
uv run uvicorn app.main:app --reload
```

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev
```

Then open:

- Frontend: http://localhost:5173
- Backend health check: http://127.0.0.1:8000/health
- Backend API docs: http://127.0.0.1:8000/docs

Stop either server with `Ctrl+C`.

### Seed data

The seed step creates `backend/data/app.db` with placeholder roles and candidates. It is safe to run again as rows that already exist are skipped. This means changes to data that already exists will not be send to the database.

To start from a clean database, stop the backend, delete `backend/data/app.db`, and run `uv run python -m app.seed` again.

### AI summaries and candidate data

Each saved resume is summarised with Google's Gemini API, using the model `gemini-3.5-flash-lite`. The backend reads the key from the `GEMINI_API_KEY` environment variable. Set it in the same terminal before you start the backend:

```powershell
$env:GEMINI_API_KEY = "your-key-here"
```

```bash
export GEMINI_API_KEY="your-key-here"
```

Without a key, the app still runs and saving still works. Each summary then shows the error code `not_configured`.

**Warning: read this before you add real candidate data.** This project is set up with a free Gemini API key. Google's Gemini API terms and pricing describe how content sent on the free tier may be used, including to improve Google's products. 

Never commit the key to the repository.

## Run tests

**Backend**

```bash
cd backend
uv run pytest
```

The live test calls the real Gemini API. It is skipped unless `GEMINI_API_KEY` is set, and it uses the free daily quota:

```bash
cd backend
uv run pytest -m live
```

**Frontend**

```bash
cd frontend
npm test
```
