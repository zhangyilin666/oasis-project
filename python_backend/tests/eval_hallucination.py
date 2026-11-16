# -*- coding: utf-8 -*-
"""
RAG 幻觉率量化评估脚本。

流程：
  1. 用 20 个领域问题分别走"无 RAG"和"有 RAG"两轮
  2. AI 生成回答后，提取其中的领域断言
  3. 每条断言在知识库中检索验证
  4. 输出对比表：可溯源率、幻觉率

运行方式:
  cd python_backend
  python tests/eval_hallucination.py

预计耗时: 约 2-3 分钟（40 次 AI 调用）
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

# 确保能找到 app 包
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openai import OpenAI
from app.services.rag_service import KnowledgeBase, KeywordRetriever, Document

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
MODEL = "deepseek-v4-pro"

# 如果 .env 里没配，尝试从项目 .env 读取
if not API_KEY:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(env_path)
    API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

if not API_KEY:
    print("[ERROR] 请设置 DEEPSEEK_API_KEY 环境变量或在 python_backend/.env 中配置")
    sys.exit(1)

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# ---------------------------------------------------------------------------
# 初始化知识库
# ---------------------------------------------------------------------------

KB_DIR = Path(__file__).resolve().parents[2] / "data_center" / "knowledge"
kb = KnowledgeBase(data_dir=KB_DIR)
kb.load_all()
print(f"[KB] 知识库已加载: {kb.document_count} 篇文档")

# 加载所有 KB 文本用于溯源验证
kb_full_text = ""
for doc in kb.retriever._documents:
    kb_full_text += doc.content + "\n\n"


# ---------------------------------------------------------------------------
# 20 个测试问题（覆盖五行、十神、格局、滴天髓、干支、综合）
# ---------------------------------------------------------------------------

TEST_QUESTIONS = [
    # === 五行基础 (5题) ===
    "五行相生的顺序是什么？请详细说明。",
    "五行相克的规律是怎样的？",
    "金在五行中代表什么特性和方位？",
    "木在五行中对应哪些身体器官和情志？",
    "天干甲乙丙丁各属什么五行？",

    # === 十神 (5题) ===
    "八字中的十神是怎么确定的？以什么为基准？",
    "正官格的人有什么性格特点？适合什么职业？",
    "七杀与正官有什么区别？七杀格的人如何化解煞气？",
    "伤官见官是什么意思？为什么命理中认为不吉利？",
    "食神和伤官有什么不同？各自的吉凶如何判断？",

    # === 格局 (4题) ===
    "什么是正官格？月令为正官如何判断格局高低？",
    "从强格和从弱格分别是什么意思？如何判断？",
    "建禄格和月刃格有何区别？各自适合什么发展方向？",
    "八字用神有哪几种选取方法？各自适用什么情况？",

    # === 滴天髓 (3题) ===
    "滴天髓中'甲木参天，脱胎要火'是什么意思？",
    "滴天髓中'五阳皆阳丙为最，五阴皆阴癸为至'如何理解？",
    "滴天髓关于从格八字的大运走向有什么论述？",

    # === 干支与地支 (3题) ===
    "十二地支中哪些属阳哪些属阴？阳支和阴支各有什么特点？",
    "天干中哪几个是五阳干？丙火和癸水各有什么特性？",
    "各地支的五行属性是什么？寅卯辰分别属什么？",
]


# ---------------------------------------------------------------------------
# AI 调用工具
# ---------------------------------------------------------------------------

def ask_ai(prompt: str, system_prompt: str = "", temperature: float = 0.1) -> str:
    """调用 DeepSeek API。"""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=1024,
        timeout=60.0,
    )
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# 断言提取
# ---------------------------------------------------------------------------

ASSERTION_EXTRACTOR_PROMPT = """你是一个断言提取器。请从以下AI回答中提取所有独立的领域断言。

规则：
1. 每条断言必须是一个完整的、可验证的事实陈述
2. 只提取与命理、五行、八字相关的领域断言
3. 忽略寒暄语、过渡句、建议性/推测性表达
4. 每条断言用一行输出，格式为 "序号. 断言内容"
5. 至少提取 3 条，最多 15 条

AI回答：
---
{response}
---

请提取断言（用中文，一行一条）："""


def extract_assertions(response_text: str) -> list[str]:
    """从 AI 回答中提取领域断言。"""
    prompt = ASSERTION_EXTRACTOR_PROMPT.format(response=response_text)
    result = ask_ai(prompt, temperature=0.0)

    assertions = []
    for line in result.strip().split("\n"):
        line = line.strip()
        # 匹配 "1. xxx" 或 "1、xxx" 或 "- xxx" 格式
        match = re.match(r"^(?:\d+[\.\、\)]\s*|[-•]\s*)(.+)", line)
        if match:
            text = match.group(1).strip()
            if len(text) >= 6:  # 至少 6 个字
                assertions.append(text)
        elif len(line) >= 10 and not line.startswith(("请", "以上", "总共", "断言")):
            # 可能是纯文本断言
            assertions.append(line)

    return assertions[:15]  # 最多 15 条


# ---------------------------------------------------------------------------
# 溯源验证
# ---------------------------------------------------------------------------

def verify_assertion(assertion: str) -> tuple[bool, float, str]:
    """
    在知识库中验证一条断言是否可溯源。

    三级匹配：
    1. 词语级：2-4字词语在 KB 段落中的命中率
    2. 字符级：断言中每个汉字在 KB 段落中的覆盖率（解决短断言匹配问题）
    3. 短句级：3-5字连续子串的精确命中率

    综合分数 >= 阈值 → 可溯源。
    短断言自动降阈值（短文本天然匹配更难）。

    Returns:
        (is_verifiable, confidence, evidence_snippet)
    """
    results = kb.search(assertion, top_k=3)
    if not results:
        return False, 0.0, ""

    # 提取多字词和所有汉字
    words = re.findall(r"[一-鿿]{2,4}", assertion)
    chars = re.findall(r"[一-鿿]", assertion)

    best_score = 0.0
    best_snippet = ""

    for result in results:
        snippet = result.content_snippet

        # 1. 词语命中率
        if words:
            word_hits = sum(1 for w in words if w in snippet)
            word_score = word_hits / len(words)
        else:
            word_score = 0.0

        # 2. 字符覆盖率（每个字都能在 KB 找到 = 高度可溯源）
        if chars:
            char_hits = sum(1 for c in chars if c in snippet)
            char_score = char_hits / len(chars)
        else:
            char_score = 0.0

        # 3. 短句精确命中
        phrase_score = _check_phrase_overlap(assertion, snippet)

        # 加权综合：字符覆盖权重最高（解决短断言问题）
        combined = word_score * 0.25 + char_score * 0.45 + phrase_score * 0.30

        if combined > best_score:
            best_score = combined
            best_snippet = snippet[:200]

    # 动态阈值：短断言更低门槛
    assertion_len = len(assertion)
    if assertion_len < 15:
        threshold = 0.15  # 短断言：只要大部分字在 KB 里就算可溯源
    elif assertion_len < 30:
        threshold = 0.20
    else:
        threshold = 0.25

    is_verifiable = best_score >= threshold
    return is_verifiable, best_score, best_snippet


def _check_phrase_overlap(assertion: str, snippet: str) -> float:
    """检查断言中的 2-5 字短句在 KB 段落中的精确命中比例。"""
    phrases = set()
    for length in (2, 3, 4, 5):
        for i in range(len(assertion) - length + 1):
            sub = assertion[i:i + length]
            if re.match(r"^[一-鿿]+$", sub):
                phrases.add(sub)

    if not phrases:
        return 0.0

    hits = sum(1 for p in phrases if p in snippet)
    return hits / len(phrases)


# ---------------------------------------------------------------------------
# RAG 增强 Prompt 构建
# ---------------------------------------------------------------------------

def build_rag_prompt(question: str) -> str:
    """检索知识库并构建增强后的 prompt。"""
    results = kb.search(question, top_k=3)

    if not results:
        return question

    context_parts = []
    for i, result in enumerate(results, 1):
        context_parts.append(
            f"[参考{i}] 来源: {result.title}\n{result.content_snippet}"
        )

    context_block = "\n\n".join(context_parts)

    return f"""请基于以下参考资料回答问题。如果资料中没有相关信息，请如实说不知道，不要编造。

参考资料：
---
{context_block}
---

问题：{question}

请回答（基于参考资料）："""


# ---------------------------------------------------------------------------
# 主评估流程
# ---------------------------------------------------------------------------

def run_evaluation():
    print("=" * 70)
    print("[EVAL] RAG 幻觉率量化评估")
    print(f"   测试问题: {len(TEST_QUESTIONS)} 个")
    print(f"   知识库: {kb.document_count} 篇文档, {len(kb.retriever._paragraphs)} 个段落")
    print(f"   评估方法: A组(无RAG) vs B组(有RAG) 对比")
    print("=" * 70)

    results = {
        "no_rag": {"total_assertions": 0, "verifiable": 0, "unverifiable": 0, "details": []},
        "with_rag": {"total_assertions": 0, "verifiable": 0, "unverifiable": 0, "details": []},
    }

    for qi, question in enumerate(TEST_QUESTIONS, 1):
        print(f"\n{'-' * 60}")
        print(f"[{qi}/{len(TEST_QUESTIONS)}] Q: {question}")

        # ---- A组：无 RAG ----
        print("  A组 (无RAG): 生成中...", end=" ", flush=True)
        t0 = time.time()
        response_no_rag = ask_ai(question, temperature=0.1)
        no_rag_time = time.time() - t0

        assertions_no_rag = extract_assertions(response_no_rag)
        print(f"完成 ({no_rag_time:.1f}s, {len(assertions_no_rag)} 条断言)")

        # ---- B组：有 RAG ----
        print("  B组 (有RAG): 生成中...", end=" ", flush=True)
        t0 = time.time()
        rag_prompt = build_rag_prompt(question)
        response_with_rag = ask_ai(rag_prompt, temperature=0.1)
        rag_time = time.time() - t0

        assertions_with_rag = extract_assertions(response_with_rag)
        print(f"完成 ({rag_time:.1f}s, {len(assertions_with_rag)} 条断言)")

        # ---- 验证 A 组断言 ----
        print("  A组 溯源验证中...", end=" ", flush=True)
        for assertion in assertions_no_rag:
            is_ver, conf, evidence = verify_assertion(assertion)
            results["no_rag"]["total_assertions"] += 1
            if is_ver:
                results["no_rag"]["verifiable"] += 1
            else:
                results["no_rag"]["unverifiable"] += 1
            results["no_rag"]["details"].append({
                "question": question,
                "assertion": assertion,
                "verifiable": is_ver,
                "confidence": round(conf, 3),
            })
        print(f"[OK]")

        # ---- 验证 B 组断言 ----
        print("  B组 溯源验证中...", end=" ", flush=True)
        for assertion in assertions_with_rag:
            is_ver, conf, evidence = verify_assertion(assertion)
            results["with_rag"]["total_assertions"] += 1
            if is_ver:
                results["with_rag"]["verifiable"] += 1
            else:
                results["with_rag"]["unverifiable"] += 1
            results["with_rag"]["details"].append({
                "question": question,
                "assertion": assertion,
                "verifiable": is_ver,
                "confidence": round(conf, 3),
            })
        print(f"[OK]")

        # 避免 API 限流
        time.sleep(0.3)

    # -----------------------------------------------------------------------
    # 输出结果
    # -----------------------------------------------------------------------

    no_rag = results["no_rag"]
    with_rag = results["with_rag"]

    no_rag_rate = (no_rag["verifiable"] / no_rag["total_assertions"] * 100) if no_rag["total_assertions"] > 0 else 0
    with_rag_rate = (with_rag["verifiable"] / with_rag["total_assertions"] * 100) if with_rag["total_assertions"] > 0 else 0
    no_rag_hall = (no_rag["unverifiable"] / no_rag["total_assertions"] * 100) if no_rag["total_assertions"] > 0 else 0
    with_rag_hall = (with_rag["unverifiable"] / with_rag["total_assertions"] * 100) if with_rag["total_assertions"] > 0 else 0

    verifiable_improvement = with_rag_rate - no_rag_rate
    hallucination_reduction = no_rag_hall - with_rag_hall
    if no_rag_hall > 0:
        hallucination_reduction_pct = (hallucination_reduction / no_rag_hall) * 100
    else:
        hallucination_reduction_pct = 0.0

    print("\n")
    print("=" * 70)
    print("                        [RESULT] 评 估 结 果")
    print("=" * 70)
    print()
    print(f"  {'指标':<24} {'无 RAG (A组)':>16} {'有 RAG (B组)':>16} {'变化':>16}")
    print(f"  {'-' * 24} {'-' * 16} {'-' * 16} {'-' * 16}")
    print(f"  {'总断言数':<24} {no_rag['total_assertions']:>16} {with_rag['total_assertions']:>16} {'—':>16}")
    print(f"  {'可溯源断言':<24} {no_rag['verifiable']:>16} {with_rag['verifiable']:>16} {f'+{with_rag["verifiable"] - no_rag["verifiable"]}':>16}")
    print(f"  {'不可溯源断言 (幻觉)':<24} {no_rag['unverifiable']:>16} {with_rag['unverifiable']:>16} {f'{with_rag["unverifiable"] - no_rag["unverifiable"]}':>16}")
    print(f"  {'-' * 24} {'-' * 16} {'-' * 16} {'-' * 16}")
    print(f"  {'可溯源率':<24} {no_rag_rate:>15.1f}% {with_rag_rate:>15.1f}% {f'+{verifiable_improvement:.1f}pp':>16}")
    print(f"  {'幻觉率':<24} {no_rag_hall:>15.1f}% {with_rag_hall:>15.1f}% {f'{hallucination_reduction:.1f}pp':>16}")
    print()
    print(f"  [UP] 可溯源率提升: +{verifiable_improvement:.1f} 个百分点")
    print(f"  [DOWN] 幻觉率降低: {hallucination_reduction_pct:.0f}% ({no_rag_hall:.1f}% → {with_rag_hall:.1f}%)")
    print()
    print("=" * 70)

    # -----------------------------------------------------------------------
    # 保存详细结果
    # -----------------------------------------------------------------------
    output_path = Path(__file__).resolve().parents[1] / "tests" / "eval_results.json"
    output_data = {
        "timestamp": datetime.now().isoformat(),
        "config": {
            "model": MODEL,
            "kb_documents": kb.document_count,
            "kb_paragraphs": len(kb.retriever._paragraphs),
            "test_questions": len(TEST_QUESTIONS),
        },
        "summary": {
            "no_rag": {
                "total_assertions": no_rag["total_assertions"],
                "verifiable": no_rag["verifiable"],
                "unverifiable": no_rag["unverifiable"],
                "verifiable_rate": round(no_rag_rate, 1),
                "hallucination_rate": round(no_rag_hall, 1),
            },
            "with_rag": {
                "total_assertions": with_rag["total_assertions"],
                "verifiable": with_rag["verifiable"],
                "unverifiable": with_rag["unverifiable"],
                "verifiable_rate": round(with_rag_rate, 1),
                "hallucination_rate": round(with_rag_hall, 1),
            },
            "improvement": {
                "verifiable_rate_pp": round(verifiable_improvement, 1),
                "hallucination_reduction_pct": round(hallucination_reduction_pct, 0),
                "hallucination_reduction_pp": round(hallucination_reduction, 1),
            },
        },
        "details": {
            "no_rag_samples": [
                d for d in no_rag["details"] if not d["verifiable"]
            ][:20],
            "with_rag_samples": [
                d for d in with_rag["details"] if not d["verifiable"]
            ][:20],
        },
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"\n[FILE] 详细结果已保存至: {output_path}")

    return output_data


if __name__ == "__main__":
    run_evaluation()
