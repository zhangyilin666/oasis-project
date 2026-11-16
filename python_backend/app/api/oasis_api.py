# -*- coding: utf-8 -*-
import asyncio
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.rate_limit import check_daily_analyze_limit
from app.core.security_deps import get_current_user
from app.db.database import get_db
from app.models.log_model import AnalysisLog
from app.models.daily_fortune_model import DailyFortune
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.models.user_model import User
from app.schemas.oasis_schema import OasisResponse, UserInput
from app.services.analysis_service import _format_birth_info
from app.services.background_analysis import process_report_in_background
from app.services.calendar_service import get_day_almanac
from app.services.daily_fortune_service import get_daily_fortune
from app.services.yun_service import get_yun_fortune
from app.services.report_lifecycle import expire_stale_reports
from app.services.fortune_stick_service import draw_stick, get_today_stick

router = APIRouter()


# ---------------------------------------------------------------------------
# 公开端点
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    """健康检查（无需鉴权）。"""
    return {"code": 200, "data": {"status": "ok"}, "message": "ok"}


# ---------------------------------------------------------------------------
# 受保护端点（需 JWT）— WeChat + App 双路径
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/wechat/oasis/analyze",
    response_model=OasisResponse,
    summary="八字命理分析（WeChat）",
)
@router.post(
    "/api/v1/app/oasis/analyze",
    response_model=OasisResponse,
    summary="八字命理分析（App）",
)
async def analyze(
    user_input: UserInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rate_ok: None = Depends(check_daily_analyze_limit),
):
    """
    提交出生信息，立即返回 report_id，分析在后台执行。

    流程：
    1. 创建 pending Report → 立即返回 report_id
    2. 后台线程执行完整分析管线（排盘→AI分析→入库）
    3. 前端轮询 GET /report/{id} 获取结果
       - status="pending"/"processing" → 继续轮询
       - status="completed" → 展示分析结果
       - status="failed" → 展示错误信息
    """
    logger.info(
        "Analyze submitted: user_id=%s",
        current_user.id,
    )

    # 1. 创建 pending Report（仅占位，无分析数据）
    report = Report(
        user_id=current_user.id,
        birth_info=_format_birth_info(user_input),
        status=ReportStatus.PENDING,
        calendar_data=None,
        ai_analysis=None,
        input_data=user_input.model_dump(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # 2. 序列化 UserInput 为 plain dict（跨线程安全）
    user_input_dict = {
        "name": user_input.name,
        "birth_date": user_input.birth_date,
        "birth_time": user_input.birth_time,
        "gender": user_input.gender,
        "location": user_input.location,
        "is_solar_time": user_input.is_solar_time,
    }

    # 3. 提交后台线程处理（避开 FastAPI 事件循环，避免阻塞）
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        None,
        process_report_in_background,
        report.id,
        user_input_dict,
    )

    # 4. 立即返回 report_id
    return OasisResponse(
        code=200,
        message="Analysis submitted, processing in background",
        data={
            "report_id": report.id,
            "status": ReportStatus.PENDING.value,
        },
    )


# ---------------------------------------------------------------------------
# 报告查询端点
# ---------------------------------------------------------------------------


@router.post("/api/v1/app/oasis/report/{report_id}/retry", response_model=OasisResponse)
async def retry_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expire_stale_reports(db, current_user.id)
    report = db.scalar(select(Report).where(
        Report.id == report_id, Report.user_id == current_user.id, Report.deleted_at.is_(None),
    ))
    if report is None:
        raise HTTPException(404, detail={"code": 404, "message": "报告不存在"})
    if report.status != ReportStatus.FAILED or not report.input_data:
        raise HTTPException(409, detail={"code": 409, "message": "当前报告不能重试，请重新填写出生信息"})
    payload = UserInput(**report.input_data)
    await run_in_threadpool(check_daily_analyze_limit, current_user, db)
    return await analyze(payload, current_user, db, None)

@router.get(
    "/api/v1/wechat/oasis/reports",
    response_model=OasisResponse,
    summary="用户报告列表（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/reports",
    response_model=OasisResponse,
    summary="用户报告列表（App）",
)
async def list_reports(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=100, description="返回条数上限"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取当前用户的历史分析报告列表，按创建时间倒序。

    列表项仅含摘要信息（不含完整 AI 分析文本），
    查看完整内容请使用 GET /report/{report_id}。
    """
    expire_stale_reports(db, current_user.id)
    total = db.scalar(
        select(func.count()).select_from(Report).where(
            Report.user_id == current_user.id, Report.deleted_at.is_(None),
        )
    )

    rows = db.execute(
        select(Report)
        .where(Report.user_id == current_user.id, Report.deleted_at.is_(None))
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).scalars().all()

    # 新模型：AI 分析对所有人免费开放，不再按会员过滤预览
    return OasisResponse(
        code=200,
        message="ok",
        data={
            "reports": [
                {
                    "id": r.id,
                    "birth_info": r.birth_info,
                    "status": r.status.value if hasattr(r.status, 'value') else r.status,
                    "ai_analysis_preview": r.ai_analysis[:200] if r.ai_analysis else "",
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in rows
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    )


@router.get(
    "/api/v1/wechat/oasis/report/{report_id}",
    response_model=OasisResponse,
    summary="报告详情（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/report/{report_id}",
    response_model=OasisResponse,
    summary="报告详情（App）",
)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取单份报告的完整内容（含八字排盘数据与 AI 分析全文）。

    仅允许查看本人报告。报告不存在或不属于当前用户时返回 404。
    """
    expire_stale_reports(db, current_user.id)
    report = db.scalar(
        select(Report).where(Report.id == report_id, Report.deleted_at.is_(None))
    )

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": 404, "message": f"Report {report_id} not found"},
        )

    if report.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": 404, "message": f"Report {report_id} not found"},
        )

    # 新模型：AI 分析对大运评语对所有人免费开放

    # 关联日志（含详细信息）
    logs = (
        db.execute(
            select(AnalysisLog)
            .where(AnalysisLog.report_id == report_id)
            .order_by(AnalysisLog.created_at.asc())
        )
        .scalars()
        .all()
    )

    log_count = len(logs)

    # calendar_data 原样返回（不再裁剪 yun_summary）
    calendar_data = report.calendar_data or {}

    return OasisResponse(
        code=200,
        message="ok",
        data={
            "id": report.id,
            "user_id": report.user_id,
            "status": report.status.value if hasattr(report.status, "value") else report.status,
            "error_message": report.error_message,
            "can_retry": bool(report.input_data) and report.status == ReportStatus.FAILED,
            "birth_info": report.birth_info,
            "calendar_data": calendar_data,
            "ai_analysis": report.ai_analysis or "",
            "analysis_logs_count": log_count,
            "analysis_logs": [
                {
                    "model_name": lg.model_name,
                    "status": lg.status,
                    "latency_ms": lg.latency_ms,
                    "prompt_tokens": lg.prompt_tokens,
                    "completion_tokens": lg.completion_tokens,
                    "total_tokens": lg.total_tokens,
                    "trace_id": lg.trace_id,
                    "created_at": lg.created_at.isoformat() if lg.created_at else None,
                }
                for lg in logs
            ],
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "updated_at": report.updated_at.isoformat() if report.updated_at else None,
        },
    )


# ---------------------------------------------------------------------------
# 删除报告
# ---------------------------------------------------------------------------

@router.delete("/api/v1/wechat/oasis/report/{report_id}", response_model=OasisResponse)
@router.delete("/api/v1/app/oasis/report/{report_id}", response_model=OasisResponse)
def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Same lock order as daily queries: never recreate a cache after its report is deleted.
    db.execute(select(User.id).where(User.id == current_user.id).with_for_update()).first()
    report = db.scalar(select(Report).where(
        Report.id == report_id, Report.user_id == current_user.id, Report.deleted_at.is_(None),
    ).with_for_update())
    if report is None:
        raise HTTPException(404, detail={"code": 404, "message": "报告不存在或已删除"})
    if report.status not in (ReportStatus.COMPLETED, ReportStatus.FAILED):
        raise HTTPException(409, detail={"code": 409, "message": "报告正在生成，请完成后再删除"})

    db.execute(delete(DailyFortune).where(DailyFortune.report_id == report.id))
    # Usage logs contain no report content; preserve their accounting and unlink the report.
    db.execute(update(AnalysisLog).where(AnalysisLog.report_id == report.id).values(report_id=None))
    report.deleted_at = datetime.now(timezone.utc)
    report.birth_info = ""
    report.input_data = report.calendar_data = report.ai_analysis = report.error_message = None
    db.commit()
    return OasisResponse(code=200, message="报告已删除", data={"report_id": report_id})


# ---------------------------------------------------------------------------
# 知识库浏览端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/knowledge",
    response_model=OasisResponse,
    summary="古籍知识库文档列表（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/knowledge",
    response_model=OasisResponse,
    summary="古籍知识库文档列表（App）",
)
async def list_knowledge(
    current_user: User = Depends(get_current_user),
):
    """
    列出知识库中所有古籍文档的元信息（标题、段落数等）。

    供前端「知识库」页面浏览。
    """
    try:
        from app.core.kb_provider import get_kb

        kb = get_kb()
        documents = kb.list_documents()
    except RuntimeError:
        documents = []

    return OasisResponse(
        code=200,
        message="ok",
        data={
            "total": len(documents),
            "documents": documents,
        },
    )


@router.get(
    "/api/v1/wechat/oasis/knowledge/{doc_id}",
    response_model=OasisResponse,
    summary="古籍文档详情（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/knowledge/{doc_id}",
    response_model=OasisResponse,
    summary="古籍文档详情（App）",
)
async def get_knowledge_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    获取单篇古籍文档的完整内容。

    文档 ID 为文件名（不含扩展名），如 shishen_detail、bazi_patterns、ditian_sui。
    """
    try:
        from app.core.kb_provider import get_kb

        kb = get_kb()
        doc = kb.get_document(doc_id)
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": 503, "message": "Knowledge base not initialized"},
        )

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": 404, "message": f"Document '{doc_id}' not found"},
        )

    return OasisResponse(
        code=200,
        message="ok",
        data=doc,
    )


# ---------------------------------------------------------------------------
# 黄历端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/almanac",
    response_model=OasisResponse,
    summary="黄历宜忌查询（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/almanac",
    response_model=OasisResponse,
    summary="黄历宜忌查询（App）",
)
async def almanac(
    solar_date: Optional[str] = Query(
        None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="公历日期 YYYY-MM-DD，默认今天",
    ),
    current_user: User = Depends(get_current_user),
):
    """
    查询指定日期的黄历宜忌、吉神凶煞、冲生肖。

    - 不传 date 参数时返回今日黄历
    - 八字数据取自 lunar-python 实时计算
    """
    try:
        almanac_day = get_day_almanac(solar_date=solar_date)
    except ValueError as exc:
        return OasisResponse(
            code=422,
            message=f"Invalid date: {exc}",
            data=None,
        )

    return OasisResponse(
        code=200,
        message="ok",
        data=almanac_day.to_dict(),
    )


# ---------------------------------------------------------------------------
# 每日运势端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/daily-fortune",
    response_model=OasisResponse,
    summary="今日运势（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/daily-fortune",
    response_model=OasisResponse,
    summary="今日运势（App）",
)
def daily_fortune(
    report_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取针对当前用户的今日运势。

    首次访问当天会自动调用 AI 生成（约 5-8 秒），
    后续访问直接返回缓存（毫秒级）。

    若用户还没有八字报告，返回 400 提示先完成分析。
    """
    try:
        fortune = get_daily_fortune(
            user_id=current_user.id,
            db=db,
            report_id=report_id,
        )
    except ValueError as exc:
        return OasisResponse(
            code=400,
            message=str(exc),
            data=None,
        )
    except RuntimeError as exc:
        logger.error("Daily fortune generation failed for user %s: %s", current_user.id, exc)
        return OasisResponse(
            code=500,
            message="运势生成失败，请稍后再试",
            data=None,
        )

    return OasisResponse(
        code=200,
        message="ok",
        data=fortune,
    )


# ---------------------------------------------------------------------------
# 大运流年端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/yun",
    response_model=OasisResponse,
    summary="大运流年（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/yun",
    response_model=OasisResponse,
    summary="大运流年（App）",
)
async def get_yun(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取用户的大运流年排盘数据。

    返回全部 8 步大运 × 10 流年（已对所有人免费开放）。

    若用户还没有八字报告，返回 400。
    """
    data = get_yun_fortune(
        db=db,
        user_id=current_user.id,
        is_premium=True,  # 全部免费开放
    )

    if data is None:
        return OasisResponse(
            code=400,
            message="请先完成八字分析",
            data=None,
        )

    return OasisResponse(
        code=200,
        message="ok",
        data=data,
    )


class FortuneStickDraw(BaseModel):
    """可选的短问题。只用于当次解说，不写入数据库。"""

    question: str = Field(default="", max_length=40)

    @field_validator("question")
    @classmethod
    def compact_question(cls, value: str) -> str:
        return " ".join(value.split())


@router.get(
    "/api/v1/wechat/oasis/fortune-stick",
    response_model=OasisResponse,
    summary="今日一签（WeChat）",
)
@router.get(
    "/api/v1/app/oasis/fortune-stick",
    response_model=OasisResponse,
    summary="今日一签（App）",
)
def today_fortune_stick(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回今天已经抽过的签。还没抽时 data 为空。"""
    return OasisResponse(code=200, message="ok", data=get_today_stick(current_user.id, db))


@router.post(
    "/api/v1/wechat/oasis/fortune-stick",
    response_model=OasisResponse,
    summary="抽一支签（WeChat）",
)
@router.post(
    "/api/v1/app/oasis/fortune-stick",
    response_model=OasisResponse,
    summary="抽一支签（App）",
)
def draw_fortune_stick(
    body: Optional[FortuneStickDraw] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """每人每天一支，包含管理员。已经抽过就返回今天的签。"""
    question = body.question if body else ""
    return OasisResponse(
        code=200,
        message="ok",
        data=draw_stick(current_user.id, db, question),
    )
