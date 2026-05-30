# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends

from app.core.logger import logger
from app.core.security_deps import get_current_user
from app.models.user_model import User
from app.schemas.oasis_schema import OasisResponse, UserInput
from app.services.calendar_service import calculate_bazi
from app.services.workflow_service import create_oasis_analyze_workflow

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
):
    """
    提交出生信息，执行八字命理分析。

    流程：
    1. JWT 鉴权 → 获取 current_user
    2. calendar_service 计算八字四柱
    3. workflow_service 编排 AI 分析管线
    4. 返回八字数据 + AI 分析文本
    """
    logger.info(
        "Analyze request: user_id=%s, birth_date=%s",
        current_user.id,
        user_input.birth_date,
    )

    # Step 1: 八字计算
    try:
        bazi_result = calculate_bazi(
            birth_date=user_input.birth_date,
            birth_time=user_input.birth_time,
            is_solar_time=user_input.is_solar_time,
        )
    except ValueError as exc:
        logger.warning("Bazi calculation failed: %s", exc)
        return OasisResponse(
            code=422,
            message=f"Invalid input: {exc}",
            data=None,
        )

    # Step 2: AI 分析管线
    pipeline = create_oasis_analyze_workflow()
    workflow_result = pipeline.run(
        input_data={
            "birth_date": user_input.birth_date,
            "birth_time": user_input.birth_time,
            "gender": user_input.gender,
            "location": user_input.location,
            "is_solar_time": user_input.is_solar_time,
            "bazi_full": bazi_result.full_bazi,
        }
    )

    # 构建响应
    analysis_text = ""
    if workflow_result.final_output and isinstance(workflow_result.final_output, dict):
        analysis_text = workflow_result.final_output.get("analysis", "")

    return OasisResponse(
        code=200,
        message="ok",
        data={
            "user_id": current_user.id,
            "calendar_data": bazi_result.to_dict(),
            "ai_analysis_text": analysis_text,
            "workflow_status": workflow_result.status,
            "workflow_steps": [
                {
                    "step": s.step_name,
                    "status": s.status,
                    "duration_ms": s.duration_ms,
                }
                for s in workflow_result.steps
            ],
        },
    )
