from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import candidates, notes, roles

app = FastAPI(title="Candidate Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidates.router)
app.include_router(roles.router)
app.include_router(notes.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
