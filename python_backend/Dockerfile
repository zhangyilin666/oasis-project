# 小易 Backend Dockerfile
# 构建: docker build -t oasis-backend:0.1.0 .
# 运行: docker run -d -p 8000:8000 --env-file .env oasis-backend:0.1.0

FROM python:3.11-slim

LABEL app="小易" version="0.1.0"

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依赖层（利用 Docker 缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 源码
COPY . .

# 知识库数据
RUN mkdir -p /app/data_center/knowledge

EXPOSE 8000

# 启动前执行数据库迁移 + 启动服务
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
