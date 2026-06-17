-- 小易 数据库初始化脚本
-- 由 docker-compose 在首次启动时自动执行

CREATE DATABASE IF NOT EXISTS oasis_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 如果用户不是 root，授权
GRANT ALL PRIVILEGES ON oasis_db.* TO 'oasis_user'@'%';
FLUSH PRIVILEGES;
