# Agent Portal Web

纯前端 Web 应用 - P2P 安全通讯

## 特点

- ✅ 纯 HTML/CSS/JS，无需构建工具
- ✅ 响应式设计，支持移动端
- ✅ 实时聊天（WebSocket）
- ✅ 完整的登录/注册/联系人管理

## 快速开始

### 1. 本地打开（最简单）

```bash
cd portal_web
# 用浏览器直接打开
open index.html
# 或
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 2. 部署到服务器

```bash
# 复制到 Portal 服务器
scp -r portal_web/* ubuntu@43.160.224.49:/opt/portal/static/

# 或部署到任意静态托管
# - GitHub Pages
# - Vercel
# - Netlify
# - 腾讯云 COS
```

## 文件结构

```
portal_web/
├── index.html      # 主页面
├── style.css       # 样式
├── app.js          # 逻辑代码
└── README.md       # 文档
```

## 配置

修改 `app.js` 中的 API 地址：

```javascript
const API_BASE_URL = 'https://your-portal.com/api';
const WS_URL = 'wss://your-portal.com/ws';
```

## 功能清单

| 功能 | 状态 |
|------|------|
| 用户注册/登录 | ✅ |
| JWT Token 存储 | ✅ |
| 联系人列表 | ✅ |
| 添加联系人 | ✅ |
| 实时聊天 | ✅ |
| WebSocket 连接 | ✅ |
| 响应式布局 | ✅ |
| 消息气泡 | ✅ |

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 与 Flutter App 对比

| 功能 | Web 版本 | Flutter App |
|------|---------|-------------|
| 安装 | 无需安装 | 需要下载安装 |
| 更新 | 自动更新 | 需要重新下载 |
| WebSocket | ✅ | ✅ |
| 文件传输 | ⚠️ 有限制 | ✅ 完整支持 |
| WebRTC 通话 | ⚠️ 浏览器兼容 | ✅ 原生支持 |
| 推送通知 | ⚠️ PWA | ✅ 原生支持 |

## 后端 API

连接同一套 Portal 后端：
- https://agentp2p.cn

## 开发计划

- [ ] WebRTC 语音/视频
- [ ] PWA 离线支持
- [ ] 文件上传/下载
- [ ] 消息搜索
