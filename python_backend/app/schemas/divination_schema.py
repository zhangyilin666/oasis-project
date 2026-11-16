"""Bounded inputs and verified output for one divination reading, never a chat API."""
from __future__ import annotations

import math
from datetime import date
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


LineValue = Annotated[StrictInt, Field(ge=6, le=9)]
CoinValue = Annotated[StrictInt, Field(ge=2, le=3)]
SixLines = Annotated[list[LineValue], Field(min_length=6, max_length=6)]
ThreeCoins = Annotated[list[CoinValue], Field(min_length=3, max_length=3)]
PositiveNumber = Annotated[StrictInt, Field(ge=1, le=999999)]


class QuestionContext(StrictModel):
    question: str = Field(min_length=1, max_length=200)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    utcOffset: float

    @field_validator("question", mode="before")
    @classmethod
    def clean_question(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        parsed = date.fromisoformat(value)
        if not 1900 <= parsed.year <= 2099:
            raise ValueError("问事日期须在 1900 至 2099 年之间")
        return value

    @field_validator("utcOffset", mode="before")
    @classmethod
    def valid_offset(cls, value):
        if type(value) not in (int, float):
            raise ValueError("UTC 偏移必须是数值")
        if not -12 <= value <= 14 or not math.isfinite(value) or not float(value * 4).is_integer():
            raise ValueError("UTC 偏移须在 -12 至 +14 小时之间，以 15 分钟为单位")
        return float(value)


class ManualInput(QuestionContext):
    method: Literal["liuyao-manual"]
    lines: SixLines


class NajiaInput(QuestionContext):
    method: Literal["liuyao-najia"]
    lines: SixLines


class CoinsInput(QuestionContext):
    method: Literal["liuyao-coins"]
    lines: SixLines
    coins: Annotated[list[ThreeCoins], Field(min_length=6, max_length=6)]

    @model_validator(mode="after")
    def coins_match_lines(self):
        if [sum(coins) for coins in self.coins] != self.lines:
            raise ValueError("每组三枚钱的总和必须与该爻记录一致")
        return self


class TwoNumbersInput(QuestionContext):
    method: Literal["meihua-two-numbers"]
    numbers: Annotated[list[PositiveNumber], Field(min_length=2, max_length=2)]


class CalendarInput(QuestionContext):
    method: Literal["meihua-calendar"]


DivinationInput = Annotated[
    Union[ManualInput, NajiaInput, CoinsInput, TwoNumbersInput, CalendarInput],
    Field(discriminator="method"),
]
RULE_VERSIONS = {
    "liuyao-manual": "divination-v1",
    "liuyao-najia": "liuyao-najia-v1",
    "liuyao-coins": "liuyao-coins-v1",
    "meihua-two-numbers": "divination-v1",
    "meihua-calendar": "meihua-calendar-v1",
}


class CreateDivination(StrictModel):
    request_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    input: DivinationInput
    rule_version: str = Field(max_length=64)

    @model_validator(mode="after")
    def matching_rule_version(self):
        if self.rule_version != RULE_VERSIONS[self.input.method]:
            raise ValueError("起卦方法与规则版本不匹配")
        return self


EvidenceId = Annotated[str, Field(min_length=1, max_length=64)]
MovingLine = Annotated[StrictInt, Field(ge=1, le=6)]


class FactsEcho(StrictModel):
    original_number: Annotated[StrictInt, Field(ge=1, le=64)]
    changed_number: Annotated[StrictInt, Field(ge=1, le=64)]
    moving_lines: Annotated[list[MovingLine], Field(max_length=6)]


class CitedOverview(StrictModel):
    text: str = Field(min_length=1, max_length=800)
    evidence_ids: Annotated[list[EvidenceId], Field(min_length=1, max_length=10)]


class CitedReading(StrictModel):
    text: str = Field(min_length=1, max_length=1200)
    evidence_ids: Annotated[list[EvidenceId], Field(min_length=1, max_length=10)]


class CitedAction(StrictModel):
    text: str = Field(min_length=1, max_length=240)
    evidence_ids: Annotated[list[EvidenceId], Field(max_length=10)]


class DivinationAnalysis(StrictModel):
    facts_echo: FactsEcho
    overview: CitedOverview
    question_reading: CitedReading
    actions: Annotated[list[CitedAction], Field(min_length=1, max_length=4)]
    reflection_questions: Annotated[list[Annotated[str, Field(min_length=1, max_length=160)]], Field(min_length=1, max_length=3)]
    limits: str = Field(min_length=1, max_length=400)

    @model_validator(mode="after")
    def nonblank_text_and_unique_references(self):
        blocks = [self.overview, self.question_reading, *self.actions]
        for block in blocks:
            block.text = block.text.strip()
            if not block.text or len(block.evidence_ids) != len(set(block.evidence_ids)):
                raise ValueError("解读正文不能为空，引用不得重复")
        self.reflection_questions = [text.strip() for text in self.reflection_questions]
        self.limits = self.limits.strip()
        if not all(self.reflection_questions) or not self.limits:
            raise ValueError("反思问题及范围说明不能为空")
        return self
