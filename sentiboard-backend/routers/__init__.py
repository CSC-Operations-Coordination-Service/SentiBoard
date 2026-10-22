"""Generated top-level router aggregating every resource router."""

from fastapi import APIRouter

from routers.anomaly import router as anomaly_router
from routers.instantmessage import router as instantmessage_router
from routers.news import router as news_router
from routers.processor import router as processor_router

router = APIRouter()

router.include_router(anomaly_router)
router.include_router(instantmessage_router)
router.include_router(news_router)
router.include_router(processor_router)
