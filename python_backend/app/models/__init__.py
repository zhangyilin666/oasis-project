# -*- coding: utf-8 -*-
"""Models package — 必须导入所有 model 模块，确保 Alembic 能发现所有表。"""

from app.models.user_model import User  # noqa: F401
from app.models.user_id_alias_model import UserIdAlias  # noqa: F401
from app.models.report_model import Report  # noqa: F401
from app.models.log_model import AnalysisLog  # noqa: F401
from app.models.daily_fortune_model import DailyFortune  # noqa: F401
from app.models.fortune_stick_model import FortuneStick  # noqa: F401
from app.models.report_status import ReportStatus  # noqa: F401
from app.models.otp_code_model import OtpCode  # noqa: F401
