# -*- coding: utf-8 -*-
"""WorkflowPipeline + StepConfig + StepExecutor 测试。"""
from __future__ import annotations

import pytest

from app.services.workflow_service import (
    StepConfig,
    StepExecutor,
    WorkflowPipeline,
    WorkflowResult,
    create_oasis_analyze_workflow,
)


# ---------------------------------------------------------------------------
# StepConfig
# ---------------------------------------------------------------------------

class TestStepConfig:
    """步骤配置。"""

    def test_extract_variables_simple(self):
        """提取模板中的变量。"""
        step = StepConfig(
            name="test",
            prompt_template="你好 {name}，你的生日是 {birth_date}",
        )
        vars_ = step.extract_variables()
        assert vars_ == {"name", "birth_date"}

    def test_extract_variables_no_variables(self):
        """无变量的模板返回空集。"""
        step = StepConfig(name="test", prompt_template="这是一段纯文本")
        assert step.extract_variables() == set()

    def test_extract_variables_excludes_braces_literals(self):
        """{{literal}} 双花括号转义不被识别为变量。"""
        step = StepConfig(
            name="test",
            prompt_template="{var} plus literal {{not_var}}",
        )
        vars_ = step.extract_variables()
        # {{not_var}} 是 Python format 的字面花括号，不应提取
        assert "var" in vars_
        assert "not_var" not in vars_

    def test_step_config_is_frozen(self):
        """StepConfig 不可修改。"""
        step = StepConfig(name="test", prompt_template="{x}")
        with pytest.raises(Exception):
            step.name = "changed"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# WorkflowPipeline
# ---------------------------------------------------------------------------

class TestWorkflowPipelineHappyPath:
    """正常执行路径。"""

    def test_pipeline_runs_all_steps(self):
        """三步全部成功执行。"""
        pipeline = WorkflowPipeline(name="test_pipeline")
        pipeline.add_step(StepConfig(name="step1", prompt_template="第一步：{data}"))
        pipeline.add_step(StepConfig(name="step2", prompt_template="第二步：{step_step1_output}"))
        pipeline.add_step(StepConfig(name="step3", prompt_template="第三步：{step_step2_output}"))

        result = pipeline.run(input_data={"data": "hello"})
        assert result.status == "success"
        assert len(result.steps) == 3
        for step_result in result.steps:
            assert step_result.status == "success"

    def test_pipeline_returns_workflow_result_type(self):
        """返回值是 WorkflowResult 实例。"""
        pipeline = WorkflowPipeline(name="test")
        pipeline.add_step(StepConfig(name="s1", prompt_template="{x}"))
        result = pipeline.run(input_data={"x": "y"})
        assert isinstance(result, WorkflowResult)
        assert result.workflow_name == "test"

    def test_final_output_is_last_successful_step(self):
        """final_output 取最后成功的步骤输出。"""
        pipeline = WorkflowPipeline(name="test")
        pipeline.add_step(StepConfig(name="s1", prompt_template="{x}"))
        pipeline.add_step(StepConfig(name="s2", prompt_template="{step_s1_output}"))

        result = pipeline.run(input_data={"x": "value"})
        assert result.final_output is not None
        # 第二步输出是 final_output
        assert result.final_output == result.steps[1].output


class TestWorkflowPipelineErrorHandling:
    """失败处理路径。"""

    def test_step_skip_on_error(self):
        """某步失败后，后续步骤全部标记为 skipped。"""
        def failing_executor(step, data):
            if step.name == "step2":
                raise RuntimeError("deliberate failure")
            return {"ok": True}

        pipeline = WorkflowPipeline(
            name="test",
            executor=StepExecutor(callable_fn=failing_executor),
        )
        pipeline.add_step(StepConfig(name="step1", prompt_template="{x}"))
        pipeline.add_step(StepConfig(name="step2", prompt_template="{step_step1_output}"))
        pipeline.add_step(StepConfig(name="step3", prompt_template="{step_step2_output}"))

        result = pipeline.run(input_data={"x": "y"})

        assert result.steps[0].status == "success"
        assert result.steps[1].status == "error"
        assert result.steps[2].status == "skipped"
        assert result.status == "partial"

    def test_all_steps_fail_result_is_error(self):
        """全部步骤失败时 status='error'。"""
        def always_fail(step, data):
            raise RuntimeError("fail")

        pipeline = WorkflowPipeline(
            name="test",
            executor=StepExecutor(callable_fn=always_fail),
        )
        pipeline.add_step(StepConfig(name="s1", prompt_template="{x}"))

        result = pipeline.run(input_data={"x": "y"})
        assert result.status == "error"


class TestWorkflowPipelineExecutorInjection:
    """Executor 注入。"""

    def test_custom_executor_is_used(self):
        """注入的 callable_fn 实际被调用。"""
        calls = []

        def record_call(step, data):
            calls.append(step.name)
            return {"recorded": True}

        pipeline = WorkflowPipeline(
            name="test",
            executor=StepExecutor(callable_fn=record_call),
        )
        pipeline.add_step(StepConfig(name="alpha", prompt_template="{x}"))
        pipeline.add_step(StepConfig(name="beta", prompt_template="{step_alpha_output}"))

        pipeline.run(input_data={"x": "y"})
        assert calls == ["alpha", "beta"]

    def test_create_oasis_workflow_accepts_executor(self):
        """工厂函数接受 executor 注入。"""
        def my_executor(step, data):
            return {"analysis": "custom result"}

        wf = create_oasis_analyze_workflow(
            executor=StepExecutor(callable_fn=my_executor),
        )
        result = wf.run(input_data={
            "birth_date": "1990-01-01",
            "birth_time": "08:00",
            "gender": "男",
            "location": "北京",
            "is_solar_time": True,
            "bazi_full": "庚午 辛巳 乙酉 丙子",
            "kb_context": "",
        })
        assert result.status == "success"


class TestWorkflowPipelineValidation:
    """模板变量校验。"""

    def test_missing_template_variable_raises_keyerror(self):
        """缺少模板变量时抛出 KeyError。"""
        pipeline = WorkflowPipeline(name="test")
        pipeline.add_step(StepConfig(name="s1", prompt_template="需要 {required_var} 和 {another}"))

        with pytest.raises(KeyError) as exc_info:
            pipeline.run(input_data={"required_var": "got_this"})

        error_msg = str(exc_info.value)
        assert "another" in error_msg, f"Error should mention missing var 'another': {error_msg}"

    def test_accumulated_variables_not_validated(self):
        """step_ 前缀的累积变量不参与校验。"""
        pipeline = WorkflowPipeline(name="test")
        pipeline.add_step(StepConfig(name="s1", prompt_template="{x}"))
        pipeline.add_step(StepConfig(name="s2", prompt_template="使用累积：{step_s1_output}"))

        # 不传 step_s1_output 应该正常（它由 s1 执行后产生）
        result = pipeline.run(input_data={"x": "hello"})
        assert result.status == "success"
