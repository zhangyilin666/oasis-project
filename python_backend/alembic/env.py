# -*- coding: utf-8 -*-
"""Alembic 迁移环境配置。"""

import sys
from logging.config import fileConfig
from pathlib import Path

# 将项目根目录加入 sys.path，确保 alembic 能找到 app 包
_proj_root = Path(__file__).resolve().parent.parent
if str(_proj_root) not in sys.path:
    sys.path.insert(0, str(_proj_root))

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# 1. 读取 alembic.ini 中的配置
# ---------------------------------------------------------------------------
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# 2. 导入所有模型，确保它们注册到 Base.metadata
#    ⚠️ 必须导入 app.db.base 之后再导入所有 model 模块！
# ---------------------------------------------------------------------------
from app.db.base import Base
import app.models  # noqa: F401  pylint: disable=unused-import,wrong-import-position

# ---------------------------------------------------------------------------
# 3. 从 .env 读取真实 DATABASE_URL（覆盖 ini 中的占位值）
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

env_path = Path(config.get_main_option("script_location")) / ".." / ".." / ".env"
env_path = env_path.resolve()
if env_path.exists():
    load_dotenv(env_path)

from app.core.config import settings

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# ---------------------------------------------------------------------------
# 4. 目标 metadata（Alembic 用它检测 model 变更）
# ---------------------------------------------------------------------------
target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# 5. 迁移参数
# ---------------------------------------------------------------------------
SCHEMA_NAME = None   # MySQL 不需要 schema
VERSION_TABLE_PREFIX = ""  # 版本表前缀（多租户时可填 "oasis_"）
VERSION_TABLE_SCHEMA = None


# ---------------------------------------------------------------------------
# offline 模式（生成 SQL 但不执行）
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Generate SQL from migrations in 'offline' mode."""

    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_prefix=VERSION_TABLE_PREFIX,
        version_table_schema=VERSION_TABLE_SCHEMA,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# online 模式（连接数据库并执行迁移）
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_prefix=VERSION_TABLE_PREFIX,
            version_table_schema=VERSION_TABLE_SCHEMA,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
