import json

from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

_options = {"pool_size": 10, "max_overflow": 20}
if settings.DATABASE_URL.startswith("mysql"):
    # 用户锁等待结束后，额度/缓存查询必须能看到其他事务的新提交。
    _options["isolation_level"] = "READ COMMITTED"
if settings.DATABASE_URL.startswith("sqlite"):
    _options = {"connect_args": {"check_same_thread": False}}
    if settings.DATABASE_URL.endswith(":memory:"):
        _options["poolclass"] = StaticPool
engine = create_engine(
    settings.DATABASE_URL,
    **_options,
    pool_pre_ping=True,          # 每次使用前 ping 测试连接
    pool_recycle=1800,           # 30分钟后主动回收连接，避免 MySQL wait_timeout 断连
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False),
    json_deserializer=json.loads,
)

if engine.dialect.name == "mysql":
    @event.listens_for(engine, "connect")
    def set_mysql_timezone(connection, _):
        with connection.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
)


def get_db():
    """FastAPI 依赖注入：每个请求获取独立 session，请求结束自动回滚/关闭。"""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
