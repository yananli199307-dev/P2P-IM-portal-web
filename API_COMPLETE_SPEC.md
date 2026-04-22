# P2P Portal API 完整规范

## 接口契约检查清单

### 1. 认证接口 (/auth)

#### POST /auth/login
**前端调用**: `apiRequest('/auth/login', {method: 'POST', body: {portal_url, password}})`

| 字段 | 后端要求 | 前端传入 | 状态 |
|-----|---------|---------|------|
| portal_url | ✅ 需要 | ✅ portal_url | 匹配 |
| password | ✅ 需要 | ✅ password | 匹配 |

**后端响应**:
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**前端使用**: `data.access_token` ✅ 已修复

---

#### POST /auth/init
**前端调用**: `apiRequest('/auth/init', {method: 'POST', body: {portal_url, display_name, password}})`

| 字段 | 后端要求 | 前端传入 | 状态 |
|-----|---------|---------|------|
| portal_url | ✅ 需要 | ✅ portal_url | 匹配 |
| display_name | ✅ 需要 | ✅ display_name | 匹配 |
| password | ✅ 需要 | ✅ password | 匹配 |

**后端响应**: `UserResponse` 对象

---

#### GET /auth/me
**前端调用**: `apiRequest('/auth/me')`

**后端响应**: `UserResponse` 对象

---

#### POST /auth/change-password
**前端调用**: `apiRequest('/auth/change-password', {method: 'POST', body: {current_password, new_password}})`

| 字段 | 后端要求 | 前端传入 | 状态 |
|-----|---------|---------|------|
| current_password | ✅ 需要 | 需确认 | ⚠️ |
| new_password | ✅ 需要 | 需确认 | ⚠️ |

---

### 2. 联系人接口 (/contacts)

#### GET /contacts
**前端调用**: `apiRequest('/contacts')`

**后端响应**: `List[ContactResponse]`

---

#### DELETE /contacts/{contact_id}
**前端调用**: `apiRequest('/contacts/${contactId}', {method: 'DELETE'})`

---

### 3. 联系人请求接口 (/contact-requests)

#### POST /contact-requests/apply ✅ 已修复
**前端调用**: `apiRequest('/contact-requests/apply', {method: 'POST', body: {...}})`

| 字段 | 后端要求 | 前端原字段 | 前端现字段 | 状态 |
|-----|---------|-----------|-----------|------|
| target_portal | ✅ 需要 | target_portal | target_portal | ✅ |
| requester_portal | ✅ 需要 | your_portal | requester_portal | ✅ 已修复 |
| requester_name | ✅ 需要 | your_name | requester_name | ✅ 已修复 |
| shared_key | ✅ 需要 | 缺失 | shared_key | ✅ 已修复 |
| message | 可选 | message | message | ✅ |

---

#### GET /contact-requests/received
**前端调用**: `apiRequest('/contact-requests/received')`

---

#### GET /contact-requests/sent
**前端调用**: `apiRequest('/contact-requests/sent')`

---

#### POST /contact-requests/{request_id}/approve
**前端调用**: `apiRequest('/contact-requests/${requestId}/approve', {method: 'POST'})`

---

#### POST /contact-requests/{request_id}/reject
**前端调用**: `apiRequest('/contact-requests/${requestId}/reject', {method: 'POST'})`

---

### 4. 私聊消息接口 (/messages)

#### GET /messages/contact/{contact_id} ✅ 已修复
**前端调用**: `apiRequest('/messages/contact/${contact.id}')`

**修复历史**: 从 `/messages/portal/${portal_url}` 改为使用 contact_id

---

#### POST /messages
**前端调用**: `apiRequest('/messages', {method: 'POST', body: {contact_id, content}})`

| 字段 | 后端要求 | 前端传入 | 状态 |
|-----|---------|---------|------|
| contact_id | ✅ 需要 | ✅ contact_id | 匹配 |
| content | ✅ 需要 | ✅ content | 匹配 |

---

### 5. 群组接口 (/groups)

#### GET /groups/my-groups
**前端调用**: `apiRequest('/groups/my-groups')`

---

#### POST /groups
**前端调用**: `apiRequest('/groups', {method: 'POST', body: {name, members}})`

| 字段 | 后端要求 | 前端传入 | 状态 |
|-----|---------|---------|------|
| name | ✅ 需要 | 需确认 | ⚠️ |
| members | 可选 | 需确认 | ⚠️ |

---

#### GET /groups/invites
**前端调用**: `apiRequest('/groups/invites')`

---

#### POST /groups/invites/{invite_id}/accept
**前端调用**: `apiRequest('/groups/invites/${inviteId}/accept', {method: 'POST'})`

---

#### POST /groups/invites/{invite_id}/reject
**前端调用**: `apiRequest('/groups/invites/${inviteId}/reject', {method: 'POST'})`

---

### 6. 群聊消息接口

#### GET /messages/group/{group_id}
**前端调用**: `apiRequest('/messages/group/${group.db_id}')`

---

#### GET /messages/group/by-uuid/{group_uuid}
**前端调用**: `apiRequest('/messages/group/by-uuid/${groupId}')`

---

#### POST /groups/{group_id}/messages/p2p
**前端调用**: `apiRequest('/groups/${group.db_id}/messages/p2p', {method: 'POST', body: {content}})`

---

#### POST /groups/by-uuid/{group_uuid}/messages/send
**前端调用**: `apiRequest('/groups/by-uuid/${groupId}/messages/send', {method: 'POST', body: {content}})`

---

## 已修复的不匹配问题汇总

| # | 问题描述 | 类型 | 修复时间 | GitHub Commit |
|---|---------|------|---------|---------------|
| 1 | contact-requests/apply 字段名不匹配 | 请求参数 | 2026-04-22 23:55 | 88c414e |
| 2 | 登录响应 token 字段名 | 响应数据 | 2026-04-23 00:10 | ae00d17 |
| 3 | 私聊消息获取路径 | 请求路径 | 2026-04-22 22:30 | 53fef17 |

## 需要确认的问题

1. **POST /auth/change-password** - 确认前端传的参数字段名
2. **POST /groups** - 确认前端传的参数字段名
3. **所有响应数据结构** - 需要逐一确认前端如何解析

## 建议

1. 使用 TypeScript 定义接口类型
2. 使用 OpenAPI/Swagger 生成文档
3. 添加接口契约测试
