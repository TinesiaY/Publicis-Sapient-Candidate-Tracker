from fastapi import FastAPI
from app.routers import candidates

app = FastAPI(title="Candidate Tracker API")
app.include_router(candidates.router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}