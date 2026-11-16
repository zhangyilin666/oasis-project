# -*- coding: utf-8 -*-
"""
DeepSeek API 适配器（OpenAI 兼容协议）。

将 StepConfig → DeepSeek Chat Completions API 调用，
对接 workflow_service 的 StepExecutor seam。接口与 AIClient 完全一致。

用法::

    from app.services.deepseek_client import DeepSeekClient, create_deepseek_executor
    from app.services.workflow_service import create_oasis_analyze_workflow

    executor = create_deepseek_executor()
    pipeline = create_oasis_analyze_workflow(executor=executor)
"""
from __future__ import annotations

from typing import Optional

from openai import OpenAI

from app.core.config import settings
from app.core.logger import logger
from app.services.workflow_service import StepConfig, StepExecutor


class DeepSeekClient:
    """
    DeepSeek Chat Completions API 适配器（OpenAI 兼容协议）。

    封装 SDK 调用、错误处理与 Token 用量记录。
    接口签名与 AIClient 完全一致，支持无缝替换。
    """

    # OpenAI SDK 默认无超时，DeepSeek 大 prompt 下响应可能 30-60s。
    # 设为 120s 给足余量；单步分析最长 4K tokens 输出在此窗口内可完成。
    _DEFAULT_TIMEOUT: float = 120.0

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        """
        Args:
            api_key: DeepSeek API key。默认从 settings.DEEPSEEK_API_KEY 读取。
            base_url: API 地址。默认从 settings.DEEPSEEK_BASE_URL 读取。
            default_model: 默认模型。默认从 settings.DEEPSEEK_DEFAULT_MODEL 读取。
            timeout: API 调用超时秒数。默认 120s。
                     单步 AI 分析最长约 4K tokens 输出，通常 30-60s 完成。
        """
        self.api_key = api_key or settings.DEEPSEEK_API_KEY
        self.base_url = base_url or settings.DEEPSEEK_BASE_URL
        self.default_model = default_model or settings.DEEPSEEK_DEFAULT_MODEL
        self.timeout = timeout if timeout is not None else self._DEFAULT_TIMEOUT
        self._client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            max_retries=0,
        )

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
            "DeepSeek call: step=%s model=%s prompt_len=%d",
            step.name,
            model,
            len(prompt),
        )

        try:
            response = self._client.chat.completions.create(
                model=model,
                max_tokens=step.max_tokens,
                temperature=step.temperature,
                messages=([{"role": "system", "content": step.system_prompt}] if step.system_prompt else [])
                + [{"role": "user", "content": prompt}],
                **({"extra_body": {"thinking": {"type": "disabled"}}}
                   if model in ("deepseek-flash", "deepseek-v4-pro") else {}),
                **({"response_format": {"type": "json_object"}} if step.output_schema else {}),
                timeout=self.timeout,
            )
        except Exception as exc:
            logger.error("DeepSeek API error in step '%s': %s", step.name, type(exc).__name__)
            raise

        text = self._extract_text(response)
        if not text.strip() or (response.choices and response.choices[0].finish_reason == "length"):
            raise RuntimeError("AI 返回内容为空或被截断，请重试")

        usage = {}
        if response.usage:
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }

        logger.info(
            "DeepSeek response: step=%s len=%d tokens_in=%d tokens_out=%d",
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
        """从 Chat Completions 响应中提取纯文本。"""
        if response.choices and len(response.choices) > 0:
            choice = response.choices[0]
            if choice.message and choice.message.content:
                return choice.message.content
        return ""


def create_deepseek_executor(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    default_model: Optional[str] = None,
) -> StepExecutor:
    """
    创建对接 DeepSeek API 的 StepExecutor。

    Args:
        api_key: DeepSeek API key。默认从 settings 读取。
        base_url: API 地址。默认从 settings 读取。
        default_model: 默认模型。

    Returns:
        StepExecutor 实例，其 callable_fn 绑定到 DeepSeekClient.call()。
    """
    client = DeepSeekClient(
        api_key=api_key,
        base_url=base_url,
        default_model=default_model,
    )
    return StepExecutor(callable_fn=client.call)
