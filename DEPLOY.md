# P2P Portal Web 部署指南

## 快速部署

### 后端部署（关键！）

```bash
# 进入后端目录
cd /opt/portal

# 方法1：使用部署脚本（推荐）
sudo ./deploy.sh

# 方法2：手动部署
git pull origin master
python3 init_db.py  # 更新数据库
sudo rm -rf __pycache__
sudo systemctl restart portal
```

### 前端部署

```bash
# 进入前端目录
cd /opt/portal/static

# 更新代码
git pull origin master

# 或者手动复制
cp /path/to/new/app.js .
```

## 常见问题

### 1. 404 /api/messages/contact/1
**原因**：后端代码未更新或数据库未迁移  
**解决**：运行 `sudo ./deploy.sh`

### 2. 500 Internal Server Error
**原因**：数据库缺少 sender_portal 列  
**解决**：运行 `python3 init_db.py`

### 3. 403 Not authenticated
**原因**：Token 问题  
**解决**：清除浏览器缓存，重新登录

## 完整更新流程

```bash
# 1. 备份数据库
cp /opt/portal/portal.db /opt/portal/portal.db.backup.$(date +%Y%m%d)

# 2. 更新后端
cd /opt/portal
sudo ./deploy.sh

# 3. 更新前端
cd /opt/portal/static
git pull origin master

# 4. 验证
curl http://localhost:8000/api/health
```
