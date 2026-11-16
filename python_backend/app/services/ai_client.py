# -*- coding: utf-8 -*-
"""
Anthropic Claude API 适配器。

将 StepConfig → Messages API 调用，对接 workflow_service 的 StepExecutor seam。

用法::

    from app.services.ai_client import AIClient, create_claude_executor
    from app.services.workflow_service import create_oasis_analyze_workflow

    # 方式 1: 工厂函数
    executor = create_claude_executor()
    pipeline = create_oasis_analyze_workflow(executor=executor)

    # 方式 2: 手动注入
    client = AIClient()
    executor = StepExecutor(callable_fn=client.call)

    # 方式 3: 直接调用（独立于 workflow）
    client = AIClient()
    result = client.call(step_config, input_data)
"""
from __future__ import annotations

from typing import Optional

import anthropic

from app.core.config import settings
from app.core.logger import logger
from app.services.workflow_service import StepConfig, StepExecutor


class AIClient:
    """
    Anthropic Claude Messages API 适配器。

    封装 SDK 调用、错误处理与 Token 用量记录。
    """

    _DEFAULT_TIMEOUT: float = 120.0

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        """
        Args:
            api_key: Anthropic API key。默认从 settings.ANTHROPIC_API_KEY 读取。
            default_model: 默认模型。默认从 settings.ANTHROPIC_DEFAULT_MODEL 读取。
            timeout: API 调用超时秒数。默认 120s。
        """
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.default_model = default_model or settings.ANTHROPIC_DEFAULT_MODEL
        self.timeout = timeout if timeout is not None else self._DEFAULT_TIMEOUT
        kwargs = {"api_key": self.api_key, "max_retries": 0}
        if settings.ANTHROPIC_BASE_URL:
            kwargs["base_url"] = settings.ANTHROPIC_BASE_URL
        self._client = anthropic.Anthropic(**kwargs)

    # ------------------------------------------------------------------
    # StepExecutor callable 接口
    # ------------------------------------------------------------------

    def call(self, step: StepConfig, input_data: dict) -> dict:
        """
        执行单步 AI 调用。

        兼容 ``StepExecutor(callable_fn=...)`` 签名：
        ``(StepConfig, input_data: dict) -> Any``。

        Args:
            step: 步骤配置（包含 prompt_template、model、temperature 等）。
            input_data: 已累积的管线数据。

        Returns:
            dict with keys: analysis, model, mock, usage, step.
        """
        prompt = step.prompt_template.format(**input_data)
        model = step.model or self.default_model

        logger.info(
            "AI call: step=%s model=%s prompt_len=%d",
            step.name,
            model,
            len(prompt),
        )

        try:
            response = self._client.messages.create(
                model=model,
                max_tokens=step.max_tokens,
                temperature=step.temperature,
                messages=[{"role": "user", "content": prompt}],
                **({"system": step.system_prompt} if step.system_prompt else {}),
                timeout=self.timeout,
            )
        except anthropic.APIError as exc:
            logger.error("Anthropic API error in step '%s': %s", step.name, type(exc).__name__)
            raise

        text = self._extract_text(response)
        if not text.strip() or getattr(response, "stop_reason", None) == "max_tokens":
            raise RuntimeError("AI 返回内容为空或被截断，请重试")

        usage = {}
        if response.usage:
            usage = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }

        logger.info(
            "AI response: step=%s len=%d tokens_in=%d tokens_out=%d",
            step.name,
            len(text),
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
        )

        return {
            "step": step.name,
            "model": model,
            "mock": False,
            "analysis": text,
            "usage": usage,
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_text(response) -> str:
        """从 Messages API 响应中提取纯文本。"""
        if not response.content:
            return ""
        # 取第一个 text block
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return str(response.content[0])


def create_claude_executor(
    api_key: Optional[str] = None,
    default_model: Optional[str] = None,
) -> StepExecutor:
    """
    创建对接 Claude API 的 StepExecutor。

    一键注入到 workflow pipeline::

        pipeline = create_oasis_analyze_workflow(
            executor=create_claude_executor()
        )

    Args:
        api_key: Anthropic API key。默认从 settings 读取。
        default_model: 默认模型。

    Returns:
        StepExecutor 实例，其 callable_fn 绑定到 AIClient.call()。
    """
    client = AIClient(api_key=api_key, default_model=default_model)
    return StepExecutor(callable_fn=client.call)
