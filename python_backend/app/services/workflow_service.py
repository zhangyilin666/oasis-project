# -*- coding: utf-8 -*-
"""
Agent 工作流编排引擎。

定义标准化的 AI Agent 步骤接口、管线执行器与结果模型。
设计目标：
  - 步骤可组合：每个 WorkflowStep 独立定义输入/输出契约
  - 管线可追踪：每步执行记录耗时、状态、输出
  - 模型可替换：每步独立配置模型参数，支持多模型混合管线
  - 输出可校验：基于 JSON Schema 的输出校验（预留）
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from app.core.logger import logger


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StepConfig:
    """单个 Agent 步骤的运行时配置（不可变）。"""

    name: str
    """步骤唯一标识，如 'bazi_calc'、'ai_analysis'"""

    prompt_template: str
    """提示词模板，支持 {variable} 占位符，执行时由 input_data 填充"""

    model: str = "claude-sonnet-4-6"
    """模型标识（预留多模型切换）"""

    temperature: float = 0.7
    max_tokens: int = 2048

    input_schema: Optional[dict] = None
    """输入 JSON Schema（预留校验）"""

    output_schema: Optional[dict] = None
    """输出 JSON Schema（预留校验）"""

    def extract_variables(self) -> set[str]:
        """
        提取 prompt_template 中所有 {variable} 占位符。

        ``{{literal}}`` 双花括号转义不会被识别为变量。
        """
        return set(re.findall(r"(?<!\{)\{(\w+)\}(?!\})", self.prompt_template))


@dataclass
class StepResult:
    """单个步骤的执行结果。"""

    step_name: str
    status: str  # "success" | "error" | "skipped"
    output: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0


@dataclass
class WorkflowResult:
    """工作流完整执行结果。"""

    workflow_name: str
    status: str  # "success" | "partial" | "error"
    steps: list[StepResult] = field(default_factory=list)
    final_output: Any = None
    total_duration_ms: float = 0.0


# ---------------------------------------------------------------------------
# 步骤执行器（预留 AI 调用接口）
# ---------------------------------------------------------------------------

class StepExecutor:
    """
    步骤执行器协议。

    当前阶段为框架态：executor 使用可注入的回调函数，
    后续对接真实 AI API（Claude API / 微信云开发 AI）时，
    只需替换 executor 实现，无需修改管线逻辑。
    """

    def __init__(
        self,
        callable_fn: Optional[Callable[[StepConfig, dict], Any]] = None,
    ):
        """
        Args:
            callable_fn: 自定义执行函数。
                         签名: (StepConfig, input_data: dict) -> Any
                         若为 None，使用内置 mock executor。
        """
        self._callable = callable_fn

    def execute(self, step: StepConfig, input_data: dict) -> StepResult:
        """
        同步执行单个步骤（当前阶段主接口）。

        后续扩展 async def execute_async() 支持并发管线。
        """
        start = time.perf_counter()

        try:
            # 渲染提示词模板
            prompt = step.prompt_template.format(**input_data)

            if self._callable is not None:
                output = self._callable(step, input_data)
            else:
                output = self._mock_execute(step, prompt)

            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "Step '%s' completed in %.0fms (model=%s)",
                step.name,
                duration_ms,
                step.model,
            )

            return StepResult(
                step_name=step.name,
                status="success",
                output=output,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "Step '%s' failed in %.0fms: %s",
                step.name,
                duration_ms,
                exc,
            )
            return StepResult(
                step_name=step.name,
                status="error",
                error=str(exc),
                duration_ms=duration_ms,
            )

    @staticmethod
    def _mock_execute(step: StepConfig, prompt: str) -> dict:
        """
        框架态 mock 输出。

        后续替换为真实模型调用（Claude API / 微信云 AI）。
        """
        logger.debug("Mock executing step '%s': prompt=%s", step.name, prompt[:80])
        return {
            "step": step.name,
            "model": step.model,
            "mock": True,
            "analysis": f"[Mock] Analysis result for: {step.name}",
            "prompt_preview": prompt[:120],
        }


# ---------------------------------------------------------------------------
# 管线编排器
# ---------------------------------------------------------------------------

class WorkflowPipeline:
    """
    Agent 工作流管线。

    按顺序执行一组 WorkflowStep，前一步的输出合并到 input_data 中
    传递给后续步骤（累积式数据传递）。

    用法::

        pipeline = WorkflowPipeline(name="oasis_analyze")
        pipeline.add_step(StepConfig(name="bazi", prompt_template="..."))
        pipeline.add_step(StepConfig(name="analysis", prompt_template="..."))
        result = pipeline.run(input_data={"birth_date": "1990-01-01", ...})
    """

    def __init__(self, name: str, executor: Optional[StepExecutor] = None):
        self.name = name
        self._steps: list[StepConfig] = []
        self.executor = executor or StepExecutor()

    def add_step(self, step: StepConfig) -> "WorkflowPipeline":
        """链式添加步骤。"""
        self._steps.append(step)
        return self

    def _validate_template_variables(self, input_data: dict) -> None:
        """
        校验 input_data 覆盖所有外部模板变量。

        跳过以 ``step_`` 开头的变量（这些是管线内部累积数据）。

        Raises:
            KeyError: 当模板引用了 input_data 中不存在的变量时。
        """
        external_vars: set[str] = set()
        for step in self._steps:
            for var in step.extract_variables():
                if not var.startswith("step_"):
                    external_vars.add(var)

        missing = external_vars - set(input_data)
        if missing:
            raise KeyError(
                f"Workflow '{self.name}' template references variables "
                f"not found in input_data: {sorted(missing)}. "
                f"Expected: {sorted(external_vars)}. "
                f"Got: {sorted(input_data)}"
            )

    def run(self, input_data: dict) -> WorkflowResult:
        """
        顺序执行所有步骤。

        Args:
            input_data: 初始输入数据，包含所有模板变量。

        Returns:
            WorkflowResult 包含每步结果、最终输出和总耗时。
        """
        workflow_start = time.perf_counter()
        step_results: list[StepResult] = []
        accumulated_data = dict(input_data)

        # ---- 模板变量校验：在执行任何步骤前检查 ----
        self._validate_template_variables(input_data)

        logger.info(
            "Workflow '%s' started (%d steps)",
            self.name,
            len(self._steps),
        )

        for step in self._steps:
            result = self.executor.execute(step, accumulated_data)
            step_results.append(result)

            # 成功步骤的输出合并到累积数据，供后续步骤使用
            if result.status == "success" and isinstance(result.output, dict):
                accumulated_data[f"step_{step.name}_output"] = result.output

            # 某步失败时，后续步骤标记为 skipped
            if result.status == "error":
                logger.warning(
                    "Workflow '%s' aborted at step '%s'",
                    self.name,
                    step.name,
                )
                # 将剩余步骤标记为 skipped
                for remaining in self._steps[self._steps.index(step) + 1:]:
                    step_results.append(
                        StepResult(
                            step_name=remaining.name,
                            status="skipped",
                            error="Previous step failed",
                        )
                    )
                break

        total_duration_ms = (time.perf_counter() - workflow_start) * 1000

        # 最后一步成功输出作为 final_output
        successful = [r for r in step_results if r.status == "success"]
        final_output = successful[-1].output if successful else None

        overall_status = "success"
        if any(r.status == "error" for r in step_results):
            overall_status = "partial" if successful else "error"

        logger.info(
            "Workflow '%s' finished: status=%s, steps=%d, total=%.0fms",
            self.name,
            overall_status,
            len(step_results),
            total_duration_ms,
        )

        return WorkflowResult(
            workflow_name=self.name,
            status=overall_status,
            steps=step_results,
            final_output=final_output,
            total_duration_ms=total_duration_ms,
        )


# ---------------------------------------------------------------------------
# 预定义工作流
# ---------------------------------------------------------------------------

def create_oasis_analyze_workflow(
    executor: Optional[StepExecutor] = None,
) -> WorkflowPipeline:
    """
    创建 Oasis 八字分析标准工作流。

    管线结构：
      1. bazi_calculation  — 八字四柱与十二宫计算
      2. ai_analysis       — AI 命理分析
      3. suggestion        — 综合建议生成

    Args:
        executor: 步骤执行器。默认使用 StepExecutor()（mock）。
                  对接真实 AI 时注入 StepExecutor(callable_fn=...)。

    Returns:
        配置好的 WorkflowPipeline 实例。
    """
    pipeline = WorkflowPipeline(name="oasis_analyze", executor=executor)

    # Step 1: 八字计算（由 calendar_service 提供真实数据后替换）
    pipeline.add_step(
        StepConfig(
            name="bazi_calculation",
            prompt_template=(
                "计算以下出生信息的八字四柱："
                "出生日期={birth_date}，出生时间={birth_time}，"
                "性别={gender}，地点={location}，是否公历={is_solar_time}"
            ),
            model="calendar-engine",
            temperature=0.0,
            max_tokens=512,
        )
    )

    # Step 2: AI 命理分析（含古籍引用上下文）
    pipeline.add_step(
        StepConfig(
            name="ai_analysis",
            prompt_template=(
                "你是一位精通传统命理学的专家。请基于以下信息进行八字命理分析：\n\n"
                "{kb_context}\n"
                "八字排盘数据：\n"
                "{step_bazi_calculation_output}\n\n"
                "分析要求：\n"
                "1. 先解读日主五行强弱与格局\n"
                "2. 结合十神关系分析性格特征\n"
                "3. 引用古籍原文佐证你的分析（引用时注明出处）\n"
                "4. 分析人生主要趋势与关键节点\n"
                "5. 语气温和、客观，避免绝对化断言"
            ),
            model="claude-sonnet-4-6",
            temperature=0.7,
            max_tokens=2048,
        )
    )

    # Step 3: 综合建议
    pipeline.add_step(
        StepConfig(
            name="suggestion",
            prompt_template=(
                "基于分析结果，给出个性化建议：\n"
                "{step_ai_analysis_output}\n\n"
                "请从健康养生、事业方向、人际关系三个维度给出实用建议。"
                "每条建议应具体、可执行，并关联命理分析中的发现。"
            ),
            model="claude-sonnet-4-6",
            temperature=0.8,
            max_tokens=1024,
        )
    )

    return pipeline
