"""HHBA API —— Phase 0 最小骨架：仅健康检查，不含业务逻辑。"""
from fastapi import FastAPI

app = FastAPI(title="HHBA API", version="0.0.0-phase0")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "hhba-api", "phase": "phase-0"}
