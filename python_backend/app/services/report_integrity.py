"""Validate structured AI claims against this report's calendar output.

Inspired by chinese-traditional-wisdom-skill's separation of calculation,
claims and interpretation. This does not verify predictions or all free prose.
"""
import json
import re
from dataclasses import replace

from app.services.workflow_service import StepExecutor


def report_facts(bazi, yun):
    return {
        "pillars": {key: getattr(bazi, key).gan_zhi for key in ("year", "month", "day", "hour")},
        "day_master": bazi.day.gan,
        "elements": bazi.wu_xing_summary,
        "dayun": [{key: getattr(item, key) for key in (
            "index", "gan_zhi", "start_age", "end_age", "start_year", "end_year"
        )} for item in yun.da_yun],
    }


def check_explicit_pillars(text, facts):
    # Deliberately narrow: only explicit labelled natal-pillar assertions.
    pattern = r"(?:年柱|月柱|日柱|时柱)\s*(?:为|是|：|:|=)\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])"
    labels = {"年柱": "year", "月柱": "month", "日柱": "day", "时柱": "hour"}
    for match in re.finditer(pattern, text):
        if match.group(1) != facts["pillars"][labels[match.group(0)[:2]]]:
            raise ValueError("解读中的四柱陈述与排盘不一致")
    # Match the labelled headings requested by our dayun-summary prompt.
    numerals = {char: i for i, char in enumerate("一二三四五六七八九", 1)}
    heading = r"第([1-9一二三四五六七八九])步大运[（(]\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:干支)?[，,、]\s*(\d+)\s*[-–—至]\s*(\d+)\s*岁[）)]"
    for match in re.finditer(heading, text):
        index = int(match[1]) if match[1].isdigit() else numerals[match[1]]
        expected = next((item for item in facts["dayun"] if item["index"] == index), None)
        if expected is None or (match[2], int(match[3]), int(match[4])) != (
            expected['gan_zhi'], expected['start_age'], expected['end_age']
        ):
            raise ValueError("解读中的大运标题与排盘不一致")


def verified_executor(executor, facts, references):
    """Wrap every AI step; fail closed on malformed, missing or wrong facts."""
    source_ids = {ref["id"] for ref in references}

    def run(step, data):
        if executor is None:
            return {"analysis": f"[Mock] Analysis result for: {step.name}",
                    "model": "mock", "mock": True,
                    "verification": {"status": "mock", "reference_ids": []}}
        instruction = (
            "\n\n输出契约优先于上文的纯文本格式要求：仅返回 JSON 对象，只包含 text、facts、reference_ids 三个字段。"
            "text 是上述要求的纯文本解读；facts 必须逐字段保留下面的排盘事实（包括数字类型），不得重算或省略。"
            "reference_ids 是本步骤确实使用的参考资料 ID 数组，未使用则为空。不得编造来源或把学习笔记称作古籍原文。"
            "不要在 text 中输出内部 JSON。\n排盘事实：{integrity_facts}\n允许的资料 ID：{integrity_sources}"
        )
        configured = replace(step, prompt_template=step.prompt_template + instruction,
                             output_schema={"type": "object"},
                             max_tokens=step.max_tokens + 2048)
        result = executor.execute(configured, {**data,
            "integrity_facts": json.dumps(facts, ensure_ascii=False),
            "integrity_sources": json.dumps(sorted(source_ids), ensure_ascii=False)})
        if result.status != "success":
            raise RuntimeError("AI 步骤未完成")
        output = result.output
        raw = output.get("analysis") if isinstance(output, dict) else output
        if not isinstance(raw, str):
            raise ValueError("AI 输出格式无效")
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        payload = json.loads(raw)
        # Providers may add harmless envelope metadata (e.g. type=json_object).
        # Drop unknown top-level fields; the nested facts still require exact equality.
        if not isinstance(payload, dict) or not {"text", "facts", "reference_ids"}.issubset(payload):
            raise ValueError("AI 输出缺少校验字段")
        # JSON serialization also distinguishes booleans from numbers (True != 1).
        if json.dumps(payload["facts"], sort_keys=True, ensure_ascii=False) != json.dumps(facts, sort_keys=True, ensure_ascii=False):
            raise ValueError("AI 排盘字段与本次计算不一致")
        text = payload["text"]
        refs = payload["reference_ids"]
        if not isinstance(text, str) or not text.strip():
            raise ValueError("AI 解读为空")
        if not isinstance(refs, list) or any(not isinstance(ref, str) or ref not in source_ids for ref in refs):
            raise ValueError("AI 引用了未提供的资料")
        check_explicit_pillars(text, facts)
        return {**(output if isinstance(output, dict) else {}), "analysis": text.strip(),
                "verification": {"status": "structured_checked", "reference_ids": sorted(set(refs))}}

    return StepExecutor(run)


def verification_summary(workflow):
    results = [step.output.get("verification", {}) for step in workflow.steps
               if step.step_name != "bazi_calculation" and isinstance(step.output, dict)]
    return {
        "version": 1,
        "status": "structured_checked" if len(results) == 3 and all(
            item.get("status") == "structured_checked" for item in results) else "not_checked",
        "scope": "四柱、日主、五行数量、大运干支及年龄年份的结构化字段；不验证全部自由文本或预测。",
        "reference_ids": sorted({ref for item in results for ref in item.get("reference_ids", [])}),
    }
