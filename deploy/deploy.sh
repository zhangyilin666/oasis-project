#!/bin/bash
# 小易 — 一键部署脚本
# 用法:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
#
# 前置条件:
#   1. 服务器已安装 Docker + Docker Compose
#   2. 域名 DNS 已解析到服务器 IP
#   3. 已从安全渠道获取 .env 生产配置

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════╗"
echo "║     小易 生产环境部署脚本         ║"
echo "╚══════════════════════════════════╝"

# ─── 1. 检查前置条件 ───
echo ""
echo "[1/6] 检查环境..."

if ! command -v docker &>/dev/null; then
    echo "❌ 未安装 Docker，请先安装: curl -fsSL https://get.docker.com | bash"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo "❌ 未安装 Docker Compose，请先安装"
    exit 1
fi

echo "  ✓ Docker $(docker --version | head -1)"
echo "  ✓ Docker Compose $(docker compose version --short)"

# ─── 2. 检查 .env 文件 ───
echo ""
echo "[2/6] 检查 .env 配置..."

ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$SCRIPT_DIR/.env.production.template" ]; then
        echo "  ⚠ .env 不存在，已从模板创建，请编辑后重新运行"
        cp "$SCRIPT_DIR/.env.production.template" "$ENV_FILE"
        echo "  → 请编辑 $ENV_FILE 填入真实配置后重新运行"
        exit 1
    else
        echo "  ❌ .env 和模板均不存在"
        exit 1
    fi
fi

echo "  ✓ .env 已存在"

# ─── 3. 生成安全密钥（如果未设置） ───
echo ""
echo "[3/6] 生成安全密钥..."

source "$ENV_FILE" 2>/dev/null || true

if [ -z "${JWT_SECRET_KEY:-}" ]; then
    NEW_JWT=$(openssl rand -hex 32)
    echo "  → 自动生成 JWT_SECRET_KEY..."
    # macOS 和 Linux 兼容的 sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=$NEW_JWT/" "$ENV_FILE"
    else
        sed -i "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=$NEW_JWT/" "$ENV_FILE"
    fi
    echo "  ✓ JWT_SECRET_KEY 已自动生成"
else
    echo "  ✓ JWT_SECRET_KEY 已配置"
fi

if [ -z "${MYSQL_ROOT_PASSWORD:-}" ]; then
    NEW_MYSQL_ROOT=$(openssl rand -hex 16)
    echo "  → 自动生成 MYSQL_ROOT_PASSWORD..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^MYSQL_ROOT_PASSWORD=$/MYSQL_ROOT_PASSWORD=$NEW_MYSQL_ROOT/" "$ENV_FILE"
    else
        sed -i "s/^MYSQL_ROOT_PASSWORD=$/MYSQL_ROOT_PASSWORD=$NEW_MYSQL_ROOT/" "$ENV_FILE"
    fi
    echo "  ✓ MYSQL_ROOT_PASSWORD 已自动生成"
else
    echo "  ✓ MYSQL_ROOT_PASSWORD 已配置"
fi

if [ -z "${MYSQL_PASSWORD:-}" ]; then
    NEW_MYSQL=$(openssl rand -hex 16)
    echo "  → 自动生成 MYSQL_PASSWORD..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^MYSQL_PASSWORD=$/MYSQL_PASSWORD=$NEW_MYSQL/" "$ENV_FILE"
    else
        sed -i "s/^MYSQL_PASSWORD=$/MYSQL_PASSWORD=$NEW_MYSQL/" "$ENV_FILE"
    fi
    echo "  ✓ MYSQL_PASSWORD 已自动生成"
else
    echo "  ✓ MYSQL_PASSWORD 已配置"
fi

# ─── 4. 启动服务 ───
echo ""
echo "[4/6] 构建并启动容器..."

cd "$PROJECT_DIR"
docker compose up -d --build

echo "  ✓ 容器已启动"

# ─── 5. 等待服务就绪 ───
echo ""
echo "[5/6] 等待服务就绪..."

MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "  ✓ Backend 健康检查通过 (${ELAPSED}s)"
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo "  ... 等待中 (${ELAPSED}s)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "  ❌ Backend 启动超时，请检查日志: docker compose logs backend"
    exit 1
fi

# ─── 6. 申请 SSL 证书 ───
echo ""
echo "[6/6] SSL 证书..."

# 从 nginx 配置中提取域名
DOMAIN=$(grep -oP 'server_name\s+\K[^ ;]+' "$SCRIPT_DIR/nginx/oasis.conf" | head -1 | sed 's/www\.//')

if [ "$DOMAIN" = "your-domain.com" ]; then
    echo "  ⚠ 域名尚未配置，跳过 SSL"
    echo "  → 请在 nginx/oasis.conf 中填入真实域名后运行:"
    echo "    docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d 你的域名"
else
    echo "  → 为 $DOMAIN 申请 SSL 证书..."
    docker compose run --rm certbot certonly --webroot \
        -w /var/www/certbot \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --non-interactive --agree-tos \
        --email "admin@$DOMAIN" \
        --deploy-hook "docker compose exec -T nginx nginx -s reload" || {
        echo "  ⚠ SSL 证书申请失败，请手动执行:"
        echo "    docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
    }
fi

# ─── 完成 ───
echo ""
echo "╔══════════════════════════════════╗"
echo "║  部署完成！                       ║"
echo "║                                  ║"
echo "║  验证:  curl https://$DOMAIN/     ║"
echo "║  日志:  docker compose logs -f    ║"
echo "║  状态:  docker compose ps         ║"
echo "╚══════════════════════════════════╝"
