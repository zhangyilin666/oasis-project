# -*- coding: utf-8 -*-
"""
Background analysis runner for async polling pattern.

Runs the full Bazi analysis pipeline in a background thread,
updating the Report's status through pending → processing → completed/failed.

Usage::

    from app.services.background_analysis import process_report_in_background

    # Called from the /analyze endpoint via run_in_executor
    process_report_in_background(report_id, user_input_dict)
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.logger import logger
from app.db.database import SessionLocal
from app.models.log_model import AnalysisLog
from app.models.report_model import Report
from app.models.report_status import ReportStatus
from app.schemas.oasis_schema import UserInput
from app.services.analysis_service import (
    _build_analysis_log,
    _build_kb_evidence,
    _extract_analysis_text,
    _extract_step_output,
    _resolve_ai_backend,
)
from app.services.calendar_service import (
    calculate_bazi,
    calculate_dayun,
    format_bazi_data_text,
    format_yun_data_text,
)
from app.services.workflow_service import create_oasis_analyze_workflow
from app.services.report_integrity import report_facts, verified_executor, verification_summary


def process_report_in_background(report_id: int, user_input_dict: dict) -> None:
    """
    Run the full analysis pipeline in a background thread.

    Creates its own DB session via SessionLocal().
    Updates the Report's status through the lifecycle:
      pending → processing → completed | failed

    Args:
        report_id: The pre-created Report.id.
        user_input_dict: Serialized UserInput fields
                         (birth_date, birth_time, gender, location, is_solar_time, name).
    """
    db = SessionLocal()
    try:
        # ---- 1. Load report, set status → processing ----
        report = db.scalar(select(Report).where(Report.id == report_id, Report.deleted_at.is_(None)))
        if report is None:
            logger.error("Background analysis: report %s not found", report_id)
            return

        if report.status != ReportStatus.PENDING:
            return

        report.status = ReportStatus.PROCESSING
        db.commit()

        # ---- 2. Reconstruct UserInput from dict ----
        user_input = UserInput(**user_input_dict)
        user_id = report.user_id

        trace_id = uuid.uuid4().hex[:16]
        logger.info(
            "Background analysis started: report_id=%s trace_id=%s user_id=%s",
            report_id,
            trace_id,
            user_id,
        )

        # ---- 3. Bazi calculation ----
        bazi_result = calculate_bazi(
            birth_date=user_input.birth_date,
            birth_time=user_input.birth_time,
            is_solar_time=user_input.is_solar_time,
        )
        bazi_data_text = format_bazi_data_text(bazi_result)

        # ---- 4. DaYun calculation ----
        yun_result = calculate_dayun(
            birth_date=user_input.birth_date,
            birth_time=user_input.birth_time,
            gender=user_input.gender,
            is_solar_time=user_input.is_solar_time,
        )
        yun_data_text = format_yun_data_text(yun_result)

        # ---- 5. RAG knowledge retrieval ----
        kb_context, kb_references = _build_kb_evidence(bazi_result)

        # ---- 6. AI analysis pipeline ----
        executor, ai_model = _resolve_ai_backend()
        executor = verified_executor(executor, report_facts(bazi_result, yun_result), kb_references)
        pipeline = create_oasis_analyze_workflow(executor=executor, ai_model=ai_model)
        workflow_result = pipeline.run(
            input_data={
                "birth_date": user_input.birth_date,
                "birth_time": user_input.birth_time,
                "gender": user_input.gender,
                "location": user_input.location,
                "is_solar_time": user_input.is_solar_time,
                "bazi_full": bazi_result.full_bazi,
                "bazi_data_text": bazi_data_text,
                "kb_context": kb_context,
                "yun_data_text": yun_data_text,
            }
        )

        # ---- 7. Extract results ----
        analysis_text = _extract_analysis_text(workflow_result)
        yun_summary_text = _extract_step_output(workflow_result, "dayun_summary")

        # WorkflowPipeline 将异常转换为步骤状态，不能仅依赖外层 except。
        for step_result in workflow_result.steps:
            db.add(_build_analysis_log(user_id, report_id, step_result, trace_id))
        db.commit()
        db.refresh(report)
        if report.status != ReportStatus.PROCESSING or report.deleted_at is not None:
            return  # 查询端已将超时任务结束，不允许迟到的线程覆盖终态。
        if workflow_result.status != "success" or not analysis_text.strip() or not yun_summary_text.strip():
            raise RuntimeError("AI 分析未完整生成，请稍后重新分析")

        calendar_data = bazi_result.to_dict()
        calendar_data["yun"] = yun_result.to_dict()
        calendar_data["yun_summary"] = yun_summary_text
        calendar_data["suggestion"] = _extract_step_output(workflow_result, "suggestion")

        calendar_data["references"] = kb_references
        calendar_data["verification"] = verification_summary(workflow_result)

        # ---- 8. Update report with results ----
        report.calendar_data = calendar_data
        report.ai_analysis = analysis_text
        report.status = ReportStatus.COMPLETED

        db.commit()
        logger.info(
            "Background analysis completed: report_id=%s trace_id=%s steps=%d",
            report_id,
            trace_id,
            len(workflow_result.steps),
        )

    except Exception as exc:
        logger.error(
            "Background analysis failed: report_id=%s error=%s",
            report_id,
            exc,
        )
        try:
            db.rollback()
            # Re-query and mark as failed in a fresh transaction
            report = db.scalar(select(Report).where(Report.id == report_id, Report.deleted_at.is_(None)))
            if report:
                report.status = ReportStatus.FAILED
                report.error_message = "分析暂时未能完成，请稍后重新分析；若反复失败请联系管理员。"
                db.commit()
        except Exception as inner_exc:
            logger.error(
                "Failed to mark report %s as failed: %s", report_id, inner_exc
            )
            db.rollback()
    finally:
        db.close()
