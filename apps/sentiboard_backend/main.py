from fastapi import FastAPI
from router import router as processors_router

app = FastAPI(title="SentiBoard Backend API", version="0.1.0")

@app.get("/health")
async def health():
    return {"status": "ok"}
app.include_router(processors_router)