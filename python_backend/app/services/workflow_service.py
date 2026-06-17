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

    def __init__(
        self,
        name: str,
        executor: Optional[StepExecutor] = None,
        step_executors: Optional[dict[str, StepExecutor]] = None,
    ):
        """
        Args:
            name: 管线名称。
            executor: 默认步骤执行器（所有未单独指定 executor 的步骤使用）。
            step_executors: 按步骤名指定的独立 executor。
                            key=步骤名, value=专属 StepExecutor。
                            未在此字典中的步骤回退到默认 executor。
        """
        self.name = name
        self._steps: list[StepConfig] = []
        self.executor = executor or StepExecutor()
        self._step_executors = step_executors or {}

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
            # 优先使用步骤专属 executor，否则回退到默认 executor
            step_executor = self._step_executors.get(step.name, self.executor)
            result = step_executor.execute(step, accumulated_data)
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
    ai_model: str = "deepseek-chat",
) -> WorkflowPipeline:
    """
    创建 小易 八字分析标准工作流。

    管线结构：
      1. bazi_calculation  — 八字四柱与十二宫计算
      2. ai_analysis       — AI 命理分析
      3. suggestion        — 综合建议生成
      4. dayun_summary     — 大运逐柱白话总结（面向小白用户）

    Args:
        executor: 步骤执行器。默认使用 StepExecutor()（mock）。
                  对接真实 AI 时注入 StepExecutor(callable_fn=...)。
        ai_model: AI 步骤使用的模型名。
                  默认 "deepseek-chat"，Claude 用户传入 "claude-sonnet-4-6"。

    Returns:
        配置好的 WorkflowPipeline 实例。
    """
    # Step 1 (bazi_calculation) 用 mock executor（纯格式化，不走 AI）
    # Step 2-4 (ai_analysis, suggestion, dayun_summary) 用注入的 AI executor
    step_executors = {}
    if executor is not None:
        step_executors = {
            "ai_analysis": executor,
            "suggestion": executor,
            "dayun_summary": executor,
        }

    pipeline = WorkflowPipeline(
        name="oasis_analyze",
        executor=None,           # 默认 mock（step 1 用）
        step_executors=step_executors,  # step 2-3 用 AI
    )

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
                "你是一位资深的国学易经术数领域专家，精通子平法、盲派、纳音、神煞、调候等八字命理各大流派技法。请基于以下八字排盘信息，综合运用各流派方法论进行深入、全面的命理分析。分析时各流派结论应交叉验证，互为补充，若有矛盾之处须明确指出并给出你的倾向性判断。\n\n"
                "输出格式要求：全文必须使用纯文本，严禁使用任何Markdown格式标记——禁止使用星号或井号做标题、禁止使用星号或下划线做加粗斜体、禁止使用减号或数字加点做列表、禁止使用反引号或代码块。段落以自然空行分隔，层级标题单独成行即可，数字序号后直接跟文字（如「一、」、「1.」等），无需任何装饰符号。\n\n"
                "{kb_context}\n"
                "八字排盘数据：\n"
                "{bazi_data_text}\n\n"
                "分析技法说明\n\n"
                "子平法（格局法）：以月令为提纲，分析日主强弱与格局成败。先定日主五行旺衰——看得令、得地、得势与否，再察格局是正官、七杀、正印、偏印、正财、偏财、食神、伤官、比肩、劫财中何者当令。格局有成者，人生有主线可循；格局破败者，须看大运是否有补救。用神为八字之魂，须分清调候用神、扶抑用神、通关用神、病药用神的不同取法，并判断用神是否有力、是否有情、是否得地。用神得力者一生顺遂，用神受伤者多有波折。\n\n"
                "盲派技法：不执着于格局用神，重在干支生克制化的象法解读。看天干透出何物、地支藏有何物，刑冲合害如何作用。重点关注：合的意象（甲己合土、乙庚合金等天干五合，地支六合、三合、三会），冲的意象（子午冲、丑未冲等地支六冲），刑的意象（寅巳申三刑、丑戌未三刑等），害的意象（子未害、丑午害等）。盲派重宾主——日主为我，他干支为宾；日柱为主，年月时为宾。宾主关系决定命主与他人的互动模式。\n\n"
                "纳音论命：将六十甲子纳音五行（如甲子乙丑海中金、丙寅丁卯炉中火等）纳入分析。年柱纳音为命宫所属，日柱纳音为身宫所属。纳音与正五行之间的生克关系，可揭示命主深层气质——如正五行身弱而纳音为金者，外表柔弱内心刚强。\n\n"
                "神煞体系：重点考察以下神煞的分布与作用。吉神方面——天乙贵人（遇难呈祥）、文昌贵人（学业文采）、学堂词馆（科甲功名）、将星（领导才能）、华盖（悟性灵性但易孤僻）、天德月德（逢凶化吉）。凶煞方面——羊刃（刚烈易折）、劫煞（意外破财）、灾煞（疾病横祸）、孤辰寡宿（姻缘淡薄）、空亡（事倍功半）、元辰（运势反复）。神煞须结合宫位和十神综合判断，不可孤立论断。\n\n"
                "调候论命：以日主五行与出生月份的气候关系判断命局寒暖燥湿。冬生者首重调候（丙火为尊），夏生者须观是否过热（壬水为贵）。调候得力者体质强健、机遇顺遂；调候不及者诸事迟滞，须待调候大运方见转机。\n\n"
                "全面分析\n\n"
                "日主与格局\n"
                "详细分析日主五行强弱——天干是否得月令、是否通根于地支、是否有生扶或克泄。判断格局类型与成败，取用神并说明理由。如果原局用神受伤或缺失，指出大运中是否有补救。分析命局的寒暖燥湿状态及调候需求。\n\n"
                "性格特征\n"
                "结合日主五行属性（木主仁、火主礼、土主信、金主义、水主智）、十神组合（官杀多者自律性强、食伤旺者才华横溢、印星重者思虑周密、财星显者务实进取）、干支刑冲合害关系，全面刻画命主的性格画像。注意分析表象性格（天干透出者）与深层性格（地支藏干及纳音）之间的差异。\n\n"
                "健康分析\n"
                "从日主旺衰和五行偏枯判断先天体质强弱。五行过旺的脏腑为病之所在（木旺伤脾胃、火旺伤肺金、土旺伤肾水、金旺伤肝胆、水旺伤心火）。关注原局中刑冲克害是否集中在日柱或时柱（代表自身和晚年）。大运流年中五行严重失衡的年份为重点防范期，须给出具体时间范围、可能的健康问题类型及其严重程度。\n\n"
                "学业与才智\n"
                "看印星（正印偏印）的状态——印星为用且得力者学业顺遂，印星为忌或被财星所破者学业多阻。文昌贵人、学堂、词馆所在宫位决定学业擅长的领域。食神伤官代表了才华的展现方式——食神为含蓄内秀，伤官为锋芒外露。结合早年大运（第一大限、第二大限）判断学业运势的起伏，给出适合的学科方向和深造时机的建议。\n\n"
                "事业与官禄\n"
                "以月柱和日支为核心，分析官杀（事业压力与权力）、财星（资源与动力）与日主的关系。官杀为用且有制化者宜从政或大型机构，财星为用且生官者宜经商，食伤生财者宜技术或创意行业。天乙贵人、将星所在宫位揭示贵人来源和适合的领导模式。结合大运走向，给出事业上升期、平台期和转型期的具体年龄区间。重点分析当前大限和下一个大限的事业主题，给出行业方向建议。\n\n"
                "财运分析\n"
                "区分正财（稳定收入）与偏财（投资投机之财）在原局的配置。财星为用且得护者一生富足，财星为忌或无财者求财辛苦。看财库（辰戌丑未）是否得开——财库逢冲者暴富之机，财库紧闭者积蓄不易。比劫夺财的组合须特别警惕——合作易损财，不宜与人合伙。官杀护财者宜通过职务和权力获取财富。结合大运流年，给出财运高涨期和低迷期的具体时间，以及各时期的理财策略建议。\n\n"
                "人际关系\n"
                "看比肩劫财的分布——比肩多者朋友众多但真心者少，劫财旺者有被朋友拖累之虞。天乙贵人所临宫位的地支属相为命主贵人属相。驿马星所在宫位决定命主是否适合外出发展。看月柱与日柱的生克关系判断与同辈的相处模式。人际关系的重大变化（贵人出现或小人侵扰）往往发生在流年地支与命局中比劫或贵人星发生特殊关系的年份，须逐一标注。\n\n"
                "婚姻与感情\n"
                "以日支（夫妻宫）为核心，分析其十神属性和与其他干支的刑冲合害关系。男命看财星（正财为妻、偏财为情人），女命看官杀（正官为夫、七杀为偏缘）。夫妻宫逢冲（日支被流年大运相冲）的年份为感情重大变动期。夫妻宫坐比劫者配偶个性强势，坐印星者得配偶照顾，坐食伤者对配偶要求高，坐官杀者婚姻责任感强，坐财星者婚姻务实。孤辰、寡宿入日柱或时柱者晚婚倾向明显。结合大运给出婚运开启的时间窗口——通常出现在财星（男）或官星（女）得地的大限，以及流年与日柱天地合的年份。\n\n"
                "大运与流年分析\n\n"
                "以下是通过 lunar-python 排出的真实大运流年数据：\n"
                "{yun_data_text}\n\n"
                "请基于以上真实大运流年排盘数据，对命主的前八步大运逐一分析。每步大运须说明：大运天干地支及其与命局的刑冲合害关系、大运对用神是扶助还是克制、该大运的核心人生主题（求学、事业、婚恋、财富积累还是守成）。\n\n"
                "每个大运中挑选最关键的三到五个流年进行详细分析，给出该年可能发生的重大事件、吉凶属性（吉、凶或平）、对命主的影响程度（以星级表示，三星为最高）以及具体的注意事项。以下流年必须作为关键节点重点分析：大运起始年和结束年（交接年份多变动）、流年天干地支与日柱发生天克地冲的年份（岁运并临或反吟伏吟）、流年用神得地（用神得禄或长生）的年份（重大机遇期）、流年忌神当令的年份（风险警示期）。\n\n"
                "综合总结与建议\n\n"
                "先天特质：用不超过二百字概括命主的核心性格、天赋优势与先天局限。须点出日主五行和格局类型。\n\n"
                "人生关键转折期：列出命主一生中最重要的三到五个转折窗口（大限加年龄），每个附简要说明该阶段的核心变化及其对后续人生的影响。\n\n"
                "针对性建议：基于以上分析，对命主当前阶段及近五年给出具体行动建议，涵盖：适合深耕的领域方向、需要主动规避的风险类型、值得重点把握的机遇窗口期、人际关系（婚姻与合作）的经营策略。每条建议应具体、可执行，并直接关联命理分析中的具体发现。\n\n"
                "重要提醒：以上命理分析仅供研究参考与娱乐消遣之用。八字命理作为中国传统文化的瑰宝，其分析结果不具备现代科学意义上的预测功能，亦不构成任何人生决策的依据。命主的人生走向始终由自身的努力、选择与智慧决定。请理性看待，切莫迷信。"
            ),
            model=ai_model,
            temperature=0.7,
            max_tokens=4096,
        )
    )

    # Step 3: 综合建议（基于分析结果提炼可执行方案）
    pipeline.add_step(
        StepConfig(
            name="suggestion",
            prompt_template=(
                "基于以下八字命理分析结果，提炼出一份凝练的个性化行动指南。输出格式要求：全文必须使用纯文本，严禁任何Markdown标记。\n\n"
                "{step_ai_analysis_output}\n\n"
                "请从以下四个维度给出建议，每项建议须具体、可执行，并直接关联命理分析中的具体发现：\n\n"
                "一、健康养生：基于五行偏枯和脏腑强弱，给出饮食调理（宜食何味、忌食何味）、作息调整和运动类型的建议。如有高风险年份，给出预防性建议。\n\n"
                "二、事业方向：指出最适合的行业领域和角色定位，当前及下一个大限应重点发展的能力，以及应主动避免的职业陷阱。\n\n"
                "三、财富策略：给出适合的理财方式（稳健型还是进取型）、适合的投资时机窗口，以及需要警惕的破财风险类型（如合伙纠纷、担保风险等）。\n\n"
                "四、人际关系与感情经营：给出改善人际关系的切入点、适合拓展社交圈的时机、在感情关系中的相处建议。如命局显示晚婚倾向，给出理性面对的建议。\n\n"
                "请用平实、温和的语气写作，避免命理术语堆砌，让普通读者能够理解并执行。"
            ),
            model=ai_model,
            temperature=0.8,
            max_tokens=2048,
        )
    )

    # Step 4: 大运逐柱白话总结（面向小白用户，每步大运 1-2 句）
    pipeline.add_step(
        StepConfig(
            name="dayun_summary",
            prompt_template=(
                "你是一位善于用大白话讲解命理的老师。请基于以下大运流年排盘数据和八字分析结果，"
                "为每一步大运写一段通俗易懂的总结，让完全不懂命理的小白也能看懂。\n\n"
                "【大运排盘数据】\n"
                "{yun_data_text}\n\n"
                "【八字分析结果摘要】\n"
                "{step_ai_analysis_output}\n\n"
                "写作要求：\n"
                "1. 每一步大运单独一段，以「第X步大运（XX干支，XX-XX岁）：」开头\n"
                "2. 用生活化的语言概括这十年：核心人生主题是什么、运势是顺是逆、最重要的年份是哪几年\n"
                "3. 避免命理术语（如非用不可，后面用括号解释），多用比喻和日常场景\n"
                "4. 运势好的大运要提醒抓住机会，运势差的大运要给出暖心鼓励\n"
                "5. 对大运起始和结束年份（交接期）特别点出，提醒平稳过渡\n"
                "6. 全文严格使用纯文本，禁止任何Markdown格式标记\n"
                "7. 每步大运总结控制在 2-4 句话，不要长篇大论"
            ),
            model=ai_model,
            temperature=0.7,
            max_tokens=2048,
        )
    )

    return pipeline
