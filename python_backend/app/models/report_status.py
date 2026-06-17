# -*- coding: utf-8 -*-
"""报告状态枚举（与数据库 Enum 对齐）。"""

from enum import Enum


class ReportStatus(str, Enum):
    """报告处理状态。

    与 SQLAlchemy Enum 列、前端 status 字段保持一致。
    """

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
