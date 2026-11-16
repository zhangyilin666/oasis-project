from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 基础配置
    APP_NAME: str = "猫来运转"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # 数据库
    DATABASE_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # AI Provider 选择: "deepseek" | "anthropic" | "" (mock)
    AI_PROVIDER: str = "deepseek"

    # Anthropic Claude API
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_BASE_URL: str = ""  # 留空使用官方 API；使用代理时填入代理地址
    ANTHROPIC_DEFAULT_MODEL: str = "claude-sonnet-4-6"

    # DeepSeek API (OpenAI 兼容协议)
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_DEFAULT_MODEL: str = "deepseek-flash"

    # WeChat Mini-Program
    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""

    # SMS 短信服务（App 手机号登录）
    # 生产环境使用 "aliyun" / "tencent"；开发环境留空或设为 "mock"
    SMS_PROVIDER: str = ""
    SMS_ACCESS_KEY_ID: str = ""
    SMS_ACCESS_KEY_SECRET: str = ""
    SMS_SIGN_NAME: str = ""         # 短信签名（需在阿里云短信控制台审核通过）
    SMS_TEMPLATE_CODE: str = ""     # 短信模板 CODE（需在阿里云短信控制台审核通过）

    # CORS 允许的来源域名

    # CORS 允许的来源域名（逗号分隔，不含空格）
    # 生产环境必须显式设置小程序合法域名，禁止留空
    # 开发环境可设为 http://localhost:*
    CORS_ORIGINS: str = ""

    # 速率限制：每用户每天最大分析次数（0 = 无限制）
    RATE_LIMIT_ANALYZE_PER_DAY: int = 5
    KNOWLEDGE_DIR: str = ""
    ALLOW_MOCK_AI: bool = False
    REPORT_TIMEOUT_MINUTES: int = 15

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
