from fastapi import FastAPI

app = FastAPI(title="Candidate Tracker API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}