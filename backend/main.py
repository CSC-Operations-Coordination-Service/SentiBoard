from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentiboard_backend.router import router as processors_router
from sentiboard_backend.settings import settings

app = FastAPI(title="SentiBoard Backend API", version="0.1.0")

if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods_list,
        allow_headers=settings.cors_allow_headers_list,
    )

@app.get("/health")
async def health():
    return {"status": "ok"}
app.include_router(processors_router)