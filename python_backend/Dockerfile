# 猫来运转 Backend Dockerfile
# 构建: docker build -t oasis-backend:0.1.0 .
# 运行: docker run -d -p 8000:8000 --env-file .env oasis-backend:0.1.0

FROM python:3.11-slim

LABEL app="猫来运转" version="0.1.0"

# 使用阿里云 Debian 镜像加速（国内构建加速）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources || true

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依赖层（利用 Docker 缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com

# 源码
COPY . .

# 知识库数据
RUN mkdir -p /app/data_center/knowledge
ENV KNOWLEDGE_DIR=/app/data_center/knowledge

EXPOSE 8000

# 启动前执行数据库迁移 + 启动服务
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
