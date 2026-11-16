"""Authenticated divination jobs with independent quotas and private history."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.security_deps import get_current_user
from app.core.logger import logger
from app.db.database import get_db
from app.models.divination_model import DivinationReading
from app.models.user_model import User
from app.schemas.divination_schema import CreateDivination
from app.schemas.oasis_schema import OasisResponse
from app.services.divination_service import (
    _utc_now, create_reading, expire_stale_readings, mark_dispatch_failed,
    process_divination_reading, quota_info, reading_detail, reading_summary,
)

router = APIRouter(prefix="/api/v1/app/oasis/divinations", tags=["divinations"])


def _dispatch(reading_id: int) -> None:
    asyncio.get_running_loop().run_in_executor(None, process_divination_reading, reading_id)


@router.post("", response_model=OasisResponse)
async def submit_divination(
    payload: CreateDivination,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        reading, created = await run_in_threadpool(create_reading, db, current_user.id, payload)
    except HTTPException:
        raise
    except Exception as exc:
        # DB exceptions can contain INSERT parameters. Do not log private input.
        db.rollback()
        logger.error("Divination submission failed: error_type=%s", type(exc).__name__)
        raise HTTPException(503, detail={"code": 503, "message": "解读服务暂时不可用，请稍后使用同一请求编号重试"}) from None
    if created:
        try:
            _dispatch(reading.id)
        except Exception:
            await run_in_threadpool(mark_dispatch_failed, reading.id)
            await run_in_threadpool(db.refresh, reading)
    return OasisResponse(code=200, data=reading_detail(reading))


@router.get("", response_model=OasisResponse)
def list_divinations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expire_stale_readings(db, current_user.id)
    filters = (DivinationReading.user_id == current_user.id, DivinationReading.deleted_at.is_(None))
    total = db.scalar(select(func.count()).select_from(DivinationReading).where(*filters)) or 0
    rows = db.scalars(select(DivinationReading).where(*filters).order_by(
        DivinationReading.created_at.desc(), DivinationReading.id.desc(),
    ).offset(skip).limit(limit)).all()
    daily_limit, remaining = quota_info(db, current_user.id)
    return OasisResponse(code=200, data={"readings": [reading_summary(row) for row in rows],
        "total": total, "skip": skip, "limit": limit, "daily_limit": daily_limit, "remaining_today": remaining})


@router.get("/{reading_id}", response_model=OasisResponse)
def get_divination(
    reading_id: int = Path(ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expire_stale_readings(db, current_user.id)
    reading = db.scalar(select(DivinationReading).where(
        DivinationReading.id == reading_id, DivinationReading.user_id == current_user.id,
        DivinationReading.deleted_at.is_(None),
    ))
    if reading is None:
        raise HTTPException(404, detail={"code": 404, "message": "解读记录不存在或已删除"})
    return OasisResponse(code=200, data=reading_detail(reading))


@router.delete("/{reading_id}", response_model=OasisResponse)
def delete_divination(
    reading_id: int = Path(ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expire_stale_readings(db, current_user.id)
    db.execute(select(User.id).where(User.id == current_user.id).with_for_update()).first()
    reading = db.scalar(select(DivinationReading).where(
        DivinationReading.id == reading_id, DivinationReading.user_id == current_user.id,
        DivinationReading.deleted_at.is_(None),
    ).with_for_update())
    if reading is None:
        raise HTTPException(404, detail={"code": 404, "message": "解读记录不存在或已删除"})
    if reading.status not in ("completed", "failed"):
        raise HTTPException(409, detail={"code": 409, "message": "解读正在生成，结束后才能删除"})
    reading.input_data = reading.facts = reading.analysis = None
    reading.request_fingerprint = reading.rule_version = reading.error_message = reading.model_name = None
    reading.deleted_at = _utc_now()
    db.commit()
    return OasisResponse(code=200, message="解读记录已删除", data={"reading_id": reading_id})
