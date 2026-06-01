# -*- coding: utf-8 -*-
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.security_deps import get_current_user
from app.db.database import get_db
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.models.user_model import User
from app.schemas.oasis_schema import OasisResponse, UserInput
from app.services.analysis_service import analyze_user_input
from app.services.calendar_service import get_day_almanac

router = APIRouter()


# ---------------------------------------------------------------------------
# 公开端点
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    """健康检查（无需鉴权）。"""
    return {"code": 200, "data": {"status": "ok"}, "message": "ok"}


# ---------------------------------------------------------------------------
# 受保护端点（需 JWT）
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/wechat/oasis/analyze",
    response_model=OasisResponse,
    summary="八字命理分析（核心接口）",
)
async def analyze(
    user_input: UserInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    提交出生信息，执行八字命理分析并持久化结果。

    流程：
    1. JWT 鉴权 → 获取 current_user
    2. analysis_service 编排完整分析管线
       - calendar_service 计算八字四柱
       - workflow_service 编排 AI 分析
       - Report + AnalysisLog 入库
    3. 返回八字数据 + AI 分析文本 + report_id
    """
    logger.info(
        "Analyze request: user_id=%s, birth_date=%s",
        current_user.id,
        user_input.birth_date,
    )

    try:
        result = analyze_user_input(
            user_id=current_user.id,
            user_input=user_input,
            db=db,
        )
    except ValueError as exc:
        logger.warning("Analysis failed on invalid input: %s", exc)
        return OasisResponse(
            code=422,
            message=f"Invalid input: {exc}",
            data=None,
        )

    return OasisResponse(
        code=200,
        message="ok",
        data=result,
    )


# ---------------------------------------------------------------------------
# 报告查询端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/reports",
    response_model=OasisResponse,
    summary="用户报告列表",
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
    total = db.scalar(
        select(func.count()).select_from(Report).where(
            Report.user_id == current_user.id
        )
    )

    rows = db.execute(
        select(Report)
        .where(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).scalars().all()

    return OasisResponse(
        code=200,
        message="ok",
        data={
            "reports": [
                {
                    "id": r.id,
                    "birth_info": r.birth_info,
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
    summary="报告详情",
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
    report = db.scalar(
        select(Report).where(Report.id == report_id)
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

    return OasisResponse(
        code=200,
        message="ok",
        data={
            "id": report.id,
            "user_id": report.user_id,
            "birth_info": report.birth_info,
            "calendar_data": report.calendar_data,
            "ai_analysis": report.ai_analysis,
            "analysis_logs_count": log_count,
            "analysis_logs": [
                {
                    "model_name": lg.model_name,
                    "status": lg.status,
                    "latency_ms": lg.latency_ms,
                    "prompt_tokens": lg.prompt_tokens,
                    "completion_tokens": lg.completion_tokens,
                    "total_tokens": lg.total_tokens,
                    "created_at": lg.created_at.isoformat() if lg.created_at else None,
                }
                for lg in logs
            ],
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "updated_at": report.updated_at.isoformat() if report.updated_at else None,
        },
    )


# ---------------------------------------------------------------------------
# 知识库浏览端点
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/wechat/oasis/knowledge",
    response_model=OasisResponse,
    summary="古籍知识库文档列表",
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
    summary="古籍文档详情",
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
    summary="黄历宜忌查询",
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
