// API 配置 - 使用当前域名
const API_BASE_URL = window.location.origin + '/api';
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';

// 状态管理
let storedUser = null;
try {
    const userStr = localStorage.getItem('user');
    storedUser = userStr ? JSON.parse(userStr) : null;
} catch (e) {
    console.error('解析用户数据失败:', e);
    storedUser = null;
}

const state = {
    token: localStorage.getItem('token'),
    user: storedUser,
    portalUrl: localStorage.getItem('portalUrl') || '',
    contacts: [],
    messages: [],
    requests: [],
    selectedContact: null,
    ws: null,
    isConnected: false,
    isInitialized: false
};

// DOM 元素
const elements = {
    // 页面
    initPage: document.getElementById('init-page'),
    loginPage: document.getElementById('login-page'),
    applyPage: document.getElementById('apply-page'),
    mainPage: document.getElementById('main-page'),
    
    // 初始化表单
    initForm: document.getElementById('init-form'),
    initPortalUrl: document.getElementById('init-portal-url'),
    initDisplayName: document.getElementById('init-display-name'),
    initPassword: document.getElementById('init-password'),
    initConfirm: document.getElementById('init-confirm'),
    
    // 登录表单
    loginForm: document.getElementById('login-form'),
    loginPortalUrl: document.getElementById('login-portal-url'),
    loginPassword: document.getElementById('login-password'),
    
    // 匿名申请表单
    applyForm: document.getElementById('apply-form'),
    applyName: document.getElementById('apply-name'),
    applyPortal: document.getElementById('apply-portal'),
    applyMessage: document.getElementById('apply-message'),
    targetPortalDisplay: document.getElementById('target-portal-display'),
    applyToLogin: document.getElementById('apply-to-login'),
    
    // 主页面
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userPortal: document.getElementById('user-portal'),
    logoutBtn: document.getElementById('logout-btn'),
    connectionStatus: document.getElementById('connection-status'),
    requestBadge: document.getElementById('request-badge'),
    
    // 分享
    shareBtn: document.getElementById('share-btn'),
    shareBox: document.getElementById('share-box'),
    shareUrlInput: document.getElementById('share-url-input'),
    copyUrlBtn: document.getElementById('copy-url-btn'),
    
    // 添加联系人
    addContactBox: document.getElementById('add-contact-box'),
    addContactUrl: document.getElementById('add-contact-url'),
    addContactBtn: document.getElementById('add-contact-btn'),
    addContactMessage: document.getElementById('add-contact-message'),
    
    // 联系人
    contactsList: document.getElementById('contacts-list'),
    
    // 请求
    requestsList: document.getElementById('requests-list'),
    
    // 聊天
    chatPanel: document.getElementById('chat-panel'),
    closeChat: document.getElementById('close-chat'),
    chatContactName: document.getElementById('chat-contact-name'),
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    
    // 修改密码弹窗
    changePasswordModal: document.getElementById('change-password-modal'),
    changePasswordForm: document.getElementById('change-password-form'),
    oldPassword: document.getElementById('old-password'),
    newPassword: document.getElementById('new-password'),
    confirmNewPassword: document.getElementById('confirm-new-password'),
    changePasswordBtn: document.getElementById('change-password-btn'),
    
    // 导航
    navItems: document.querySelectorAll('.nav-item'),
    contactsPage: document.getElementById('contacts-page'),
    groupsPage: document.getElementById('groups-page'),
    requestsPage: document.getElementById('requests-page'),
    settingsPage: document.getElementById('settings-page'),
    logoutSetting: document.getElementById('logout-setting'),
    
    // Toast
    toast: document.getElementById('toast')
};

// ========== API 请求 ==========

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    let body = options.body;
    
    // 处理 body：如果是对象则 stringify
    if (body && typeof body === 'object') {
        body = JSON.stringify(body);
    }
    
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body
    };
    
    if (state.token) {
        config.headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            let errorDetail = `请求失败: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorDetail = typeof errorData.detail === 'string' 
                        ? errorData.detail 
                        : JSON.stringify(errorData.detail);
                }
            } catch (e) {
                // ignore parse error
            }
            throw new Error(errorDetail);
        }
        
        // 处理空响应
        const text = await response.text();
        if (!text) {
            return null;
        }
        
        return JSON.parse(text);
    } catch (error) {
        const errorMsg = error.message || String(error) || '请求失败';
        showToast(errorMsg, 'error');
        throw error;
    }
}

// ========== 初始化 ==========

async function checkInitStatus() {
    try {
        const data = await apiRequest('/auth/status');
        state.isInitialized = data.initialized;
        return data.initialized;
    } catch (error) {
        console.error('检查初始化状态失败:', error);
        return false;
    }
}

async function initAccount(password, displayName) {
    const data = await apiRequest('/auth/init', {
        method: 'POST',
        body: { password, display_name: displayName }
    });
    
    state.isInitialized = true;
    showToast('初始化完成，请登录');
    showLoginPage();
}

// ========== 认证 ==========

async function login(portalUrl, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { portal_url: portalUrl, password }
    });
    
    state.token = data.access_token;
    state.portalUrl = portalUrl;
    localStorage.setItem('token', state.token);
    localStorage.setItem('portalUrl', portalUrl);
    
    const user = await apiRequest('/auth/me');
    state.user = user;
    localStorage.setItem('user', JSON.stringify(user));
    
    showMainPage();
    showToast('登录成功');
}

function logout() {
    state.token = null;
    state.user = null;
    state.portalUrl = '';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('portalUrl');
    
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
    
    showLoginPage();
    showToast('已退出登录');
}

async function changePassword(oldPassword, newPassword) {
    await apiRequest('/auth/change-password', {
        method: 'POST',
        body: { old_password: oldPassword, new_password: newPassword }
    });
    showToast('密码修改成功');
}

// ========== 匿名申请 ==========

function generateSharedKey() {
    // 生成共享密钥 - 申请方生成，双方使用
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'shared_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function showApplyPage(targetPortal) {
    hideAllPages();
    elements.applyPage.classList.remove('hidden');
    elements.targetPortalDisplay.textContent = targetPortal;
    elements.applyForm.dataset.targetPortal = targetPortal;
}

async function applyContact(targetPortal, requesterName, requesterPortal, message) {
    // 申请方生成 shared_key
    const sharedKey = generateSharedKey();
    
    // 保存到本地存储（用于后续验证回调）
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    pendingRequests.push({
        target_portal: targetPortal,
        requester_portal: requesterPortal,
        shared_key: sharedKey,
        created_at: new Date().toISOString()
    });
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
    
    await apiRequest('/contact-requests/apply', {
        method: 'POST',
        body: {
            target_portal: targetPortal,
            requester_name: requesterName,
            requester_portal: requesterPortal,
            shared_key: sharedKey,  // 申请方提供 shared_key
            message: message
        }
    });
    
    showToast('申请已提交，等待对方批准');
    showLoginPage();
}

// ========== 联系人请求 ==========

async function loadRequests() {
    try {
        // 加载联系人请求
        const contactRequests = await apiRequest('/contact-requests/received');
        state.requests = contactRequests.map(r => ({...r, type: 'contact'}));
        
        // 加载群邀请
        try {
            const groupInvites = await apiRequest('/groups/invites');
            const invites = groupInvites.map(i => ({...i, type: 'group'}));
            state.requests = [...state.requests, ...invites];
        } catch (e) {
            console.log('加载群邀请失败:', e);
        }
        
        renderRequests();
        updateRequestBadge();
    } catch (error) {
        console.error('加载请求失败:', error);
    }
}

async function approveRequest(requestId) {
    try {
        await apiRequest(`/contact-requests/${requestId}/approve`, {
            method: 'POST'
        });
        showToast('已批准，已添加为联系人');
        await loadRequests();
        await loadContacts();
    } catch (error) {
        console.error('批准请求失败:', error);
    }
}

async function rejectRequest(requestId) {
    try {
        await apiRequest(`/contact-requests/${requestId}/reject`, {
            method: 'POST'
        });
        showToast('已拒绝');
        await loadRequests();
    } catch (error) {
        console.error('拒绝请求失败:', error);
    }
}

async function acceptGroupInvite(inviteId) {
    try {
        await apiRequest(`/groups/invites/${inviteId}/accept`, {
            method: 'POST'
        });
        showToast('已接受群邀请');
        await loadRequests();
        await loadGroups();
    } catch (error) {
        console.error('接受群邀请失败:', error);
        showToast('接受失败: ' + error.message, 'error');
    }
}

async function rejectGroupInvite(inviteId) {
    try {
        await apiRequest(`/groups/invites/${inviteId}/reject`, {
            method: 'POST'
        });
        showToast('已拒绝群邀请');
        await loadRequests();
    } catch (error) {
        console.error('拒绝群邀请失败:', error);
    }
}

function renderRequests() {
    if (state.requests.length === 0) {
        elements.requestsList.innerHTML = '<div class="empty">暂无新的请求</div>';
        return;
    }
    
    elements.requestsList.innerHTML = state.requests.map(req => {
        if (req.type === 'group') {
            // 群邀请
            return `
                <div class="request-item" data-id="${req.id}" data-type="group">
                    <div class="request-avatar">群</div>
                    <div class="request-info">
                        <div class="request-name">群邀请: ${escapeHtml(req.group_name)}</div>
                        <div class="request-portal">来自: ${escapeHtml(req.inviter_portal)}</div>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-primary btn-small" onclick="window.acceptGroupInvite(${req.id})">接受</button>
                        <button class="btn btn-secondary btn-small" onclick="window.rejectGroupInvite(${req.id})">拒绝</button>
                    </div>
                </div>
            `;
        } else {
            // 联系人请求
            return `
                <div class="request-item" data-id="${req.id}" data-type="contact">
                    <div class="request-avatar">${req.requester_name[0].toUpperCase()}</div>
                    <div class="request-info">
                        <div class="request-name">${escapeHtml(req.requester_name)}</div>
                        <div class="request-portal">${escapeHtml(req.requester_portal)}</div>
                        ${req.message ? `<div class="request-message">${escapeHtml(req.message)}</div>` : ''}
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-primary btn-small" onclick="window.approveRequest(${req.id})">批准</button>
                        <button class="btn btn-secondary btn-small" onclick="window.rejectRequest(${req.id})">拒绝</button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function updateRequestBadge() {
    const count = state.requests.length;
    elements.requestBadge.textContent = count;
    elements.requestBadge.classList.toggle('hidden', count === 0);
}

// ========== 联系人 ==========

// 添加联系人
async function addContactByUrl() {
    const url = elements.addContactUrl.value.trim();
    
    if (!url) {
        elements.addContactMessage.textContent = '请输入 Portal 地址';
        elements.addContactMessage.className = 'add-contact-message error';
        return;
    }
    
    // 验证 URL 格式
    try {
        new URL(url);
    } catch (e) {
        elements.addContactMessage.textContent = '请输入有效的 URL';
        elements.addContactMessage.className = 'add-contact-message error';
        return;
    }
    
    // 检查不能添加自己
    if (url === state.portalUrl) {
        elements.addContactMessage.textContent = '不能添加自己';
        elements.addContactMessage.className = 'add-contact-message error';
        return;
    }
    
    elements.addContactBtn.disabled = true;
    elements.addContactMessage.textContent = '发送中...';
    elements.addContactMessage.className = 'add-contact-message';
    
    try {
        // 发送添加联系人请求
        const response = await apiRequest('/contacts/request', {
            method: 'POST',
            body: JSON.stringify({
                target_portal: url,
                display_name: state.userName || '用户'
            })
        });
        
        elements.addContactMessage.textContent = '申请已发送，等待对方接受';
        elements.addContactMessage.className = 'add-contact-message success';
        elements.addContactUrl.value = '';
        
        // 3秒后清除消息
        setTimeout(() => {
            elements.addContactMessage.textContent = '';
            elements.addContactMessage.className = 'add-contact-message';
        }, 3000);
        
    } catch (error) {
        console.error('添加联系人失败:', error);
        elements.addContactMessage.textContent = '添加失败: ' + (error.message || '未知错误');
        elements.addContactMessage.className = 'add-contact-message error';
    } finally {
        elements.addContactBtn.disabled = false;
    }
}

async function loadContacts() {
    try {
        const contacts = await apiRequest('/contacts');
        state.contacts = contacts;
        renderContacts();
        // 加载未读消息后更新联系人显示
        await loadUnreadMessages();
    } catch (error) {
        console.error('加载联系人失败:', error);
    }
}

// 未读消息状态
state.unreadCounts = {};

async function loadUnreadMessages() {
    // 加载所有未读消息
    try {
        const unreadMessages = await apiRequest('/messages/unread');
        // 按联系人统计未读数量
        state.unreadCounts = {};
        if (unreadMessages && Array.isArray(unreadMessages)) {
            unreadMessages.forEach(msg => {
                if (!state.unreadCounts[msg.contact_id]) {
                    state.unreadCounts[msg.contact_id] = 0;
                }
                state.unreadCounts[msg.contact_id]++;
            });
        }
        // 更新联系人列表显示未读标记
        updateContactUnreadBadges();
        // 更新页面标题显示总未读数
        updateTotalUnreadCount();
    } catch (error) {
        console.error('加载未读消息失败:', error);
    }
}

function updateContactUnreadBadges() {
    // 更新联系人列表的未读标记
    document.querySelectorAll('.contact-item').forEach(item => {
        const contactId = parseInt(item.dataset.id);
        const unreadCount = state.unreadCounts[contactId] || 0;
        
        // 移除旧的未读标记
        const oldBadge = item.querySelector('.unread-badge');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        // 添加新的未读标记
        if (unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-badge';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            item.appendChild(badge);
        }
    });
}

function updateTotalUnreadCount() {
    // 更新页面标题显示总未读数
    const totalUnread = Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
    if (totalUnread > 0) {
        document.title = `(${totalUnread}) P2P-IM Portal`;
    } else {
        document.title = 'P2P-IM Portal';
    }
}

async function markMessagesAsRead(contactId) {
    // 标记联系人的所有消息为已读
    try {
        // 获取该联系人的未读消息
        const unreadMessages = await apiRequest('/messages/unread');
        const contactUnreadMessages = unreadMessages.filter(msg => msg.contact_id === contactId);
        
        // 逐个标记为已读
        for (const msg of contactUnreadMessages) {
            await apiRequest(`/messages/${msg.id}/read`, { method: 'POST' });
        }
        
        // 更新本地未读计数
        delete state.unreadCounts[contactId];
        updateContactUnreadBadges();
        updateTotalUnreadCount();
    } catch (error) {
        console.error('标记已读失败:', error);
    }
}

function renderContacts() {
    if (state.contacts.length === 0) {
        elements.contactsList.innerHTML = '<div class="empty">暂无联系人<br>分享你的 Portal 地址让别人申请添加你</div>';
        return;
    }
    
    elements.contactsList.innerHTML = state.contacts.map(contact => `
        <div class="contact-item" data-id="${contact.id}">
            <div class="contact-avatar">${contact.display_name[0].toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(contact.display_name)}</div>
                <div class="contact-url">${escapeHtml(contact.portal_url)}</div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const contact = state.contacts.find(c => c.id === id);
            if (contact) {
                openChat(contact);
            }
        });
    });
}

// ========== 聊天 ==========

async function openChat(contact) {
    state.selectedContact = contact;
    elements.chatContactName.textContent = contact.display_name;
    elements.chatPanel.classList.remove('hidden');
    elements.chatMessages.innerHTML = '<div class="empty">暂无消息</div>';
    elements.messageInput.focus();
    await loadMessages(contact.id);
    // 标记消息为已读
    await markMessagesAsRead(contact.id);
}

function closeChat() {
    state.selectedContact = null;
    elements.chatPanel.classList.add('hidden');
}

async function loadMessages(contactId) {
    try {
        const messages = await apiRequest(`/messages?contact_id=${contactId}`);
        state.messages = messages;
        renderMessages();
    } catch (error) {
        console.error('加载消息失败:', error);
    }
}

async function sendMessage(content) {
    if (!state.selectedContact || !content.trim()) return;
    
    try {
        const message = await apiRequest('/messages', {
            method: 'POST',
            body: {
                contact_id: state.selectedContact.id,
                content: content.trim(),
                message_type: 'text'
            }
        });
        
        state.messages.push(message);
        renderMessages();
        elements.messageInput.value = '';
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    } catch (error) {
        console.error('发送消息失败:', error);
    }
}

function renderMessages() {
    if (state.messages.length === 0) {
        elements.chatMessages.innerHTML = '<div class="empty">暂无消息</div>';
        return;
    }
    
    // 按时间排序（旧的在上面，新的在下面）
    const sortedMessages = [...state.messages].sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
    });
    
    elements.chatMessages.innerHTML = sortedMessages.map(msg => {
        const isSent = msg.is_from_owner;
        // 后端已存储北京时间，直接显示
        const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div>${escapeHtml(msg.content)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }).join('');
    
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ========== WebSocket ==========

function connectWebSocket() {
    if (!state.token || state.ws) return;
    
    const userId = state.user?.id;
    if (!userId) return;
    
    state.ws = new WebSocket(`${WS_URL}?token=${userId}`);
    
    state.ws.onopen = () => {
        state.isConnected = true;
        updateConnectionStatus();
        console.log('WebSocket 连接成功');
    };
    
    state.ws.onclose = () => {
        state.isConnected = false;
        updateConnectionStatus();
        state.ws = null;
        setTimeout(connectWebSocket, 5000);
    };
    
    state.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
    };
    
    state.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
}

function handleWebSocketMessage(message) {
    if (message.type === 'new_message') {
        const data = message.data;
        if (data && data.contact_id === state.selectedContact?.id) {
            // 检查是否已存在，避免重复添加
            const exists = state.messages.some(m => m.id === data.id);
            if (!exists) {
                state.messages.push(data);
                renderMessages();
                // 如果正在聊天，自动标记为已读
                if (!data.is_from_owner) {
                    markMessagesAsRead(data.contact_id);
                }
            }
        } else if (data && !data.is_from_owner) {
            // 收到其他联系人的新消息，更新未读计数
            if (!state.unreadCounts[data.contact_id]) {
                state.unreadCounts[data.contact_id] = 0;
            }
            state.unreadCounts[data.contact_id]++;
            updateContactUnreadBadges();
            updateTotalUnreadCount();
            // 显示通知
            showToast(`收到新消息`);
        }
    }
}

function updateConnectionStatus() {
    elements.connectionStatus.className = 'status ' + (state.isConnected ? 'connected' : 'disconnected');
}

// ========== 分享功能 ==========

function toggleShareBox() {
    elements.shareBox.classList.toggle('hidden');
    if (!elements.shareBox.classList.contains('hidden')) {
        const shareUrl = `${window.location.origin}?action=apply&portal=${encodeURIComponent(state.portalUrl)}`;
        elements.shareUrlInput.value = shareUrl;
    }
}

function copyShareUrl() {
    elements.shareUrlInput.select();
    document.execCommand('copy');
    showToast('链接已复制');
}

// ========== 页面切换 ==========

function hideAllPages() {
    elements.initPage.classList.add('hidden');
    elements.loginPage.classList.add('hidden');
    elements.applyPage.classList.add('hidden');
    elements.mainPage.classList.add('hidden');
}

function showInitPage(portalUrl) {
    hideAllPages();
    elements.initPage.classList.remove('hidden');
    elements.initPortalUrl.textContent = portalUrl;
}

function showLoginPage() {
    hideAllPages();
    elements.loginPage.classList.remove('hidden');
    if (state.portalUrl) {
        elements.loginPortalUrl.value = state.portalUrl;
    }
}

function showMainPage() {
    hideAllPages();
    elements.mainPage.classList.remove('hidden');
    
    if (state.user) {
        elements.userAvatar.textContent = (state.user.display_name || '用')[0].toUpperCase();
        elements.userName.textContent = state.user.display_name || '用户';
        elements.userPortal.textContent = state.user.portal_url || state.portalUrl;
    }
    
    loadContacts();
    loadRequests();
    connectWebSocket();
}

function showPage(pageName) {
    elements.contactsPage.classList.add('hidden');
    elements.groupsPage.classList.add('hidden');
    elements.requestsPage.classList.add('hidden');
    elements.settingsPage.classList.add('hidden');
    
    if (pageName === 'contacts') {
        elements.contactsPage.classList.remove('hidden');
    } else if (pageName === 'groups') {
        elements.groupsPage.classList.remove('hidden');
        loadGroups();
    } else if (pageName === 'requests') {
        elements.requestsPage.classList.remove('hidden');
    } else if (pageName === 'settings') {
        elements.settingsPage.classList.remove('hidden');
    }
    
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
}

// ========== 弹窗 ==========

function showChangePasswordModal() {
    elements.changePasswordModal.classList.remove('hidden');
}

function hideChangePasswordModal() {
    elements.changePasswordModal.classList.add('hidden');
    elements.changePasswordForm.reset();
}

// ========== 工具函数 ==========

function showToast(message, type = 'success') {
    // 确保 message 是字符串
    if (typeof message !== 'string') {
        message = String(message);
    }
    elements.toast.textContent = message;
    elements.toast.className = 'toast';
    elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 暴露给 HTML 调用的函数
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.acceptGroupInvite = acceptGroupInvite;
window.rejectGroupInvite = rejectGroupInvite;

// ========== 事件绑定 ==========

function bindEvents() {
    // 初始化表单
    elements.initForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (elements.initPassword.value !== elements.initConfirm.value) {
            showToast('两次密码不一致', 'error');
            return;
        }
        
        const btn = elements.initForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = '设置中...';
        
        try {
            await initAccount(
                elements.initPassword.value,
                elements.initDisplayName.value
            );
        } finally {
            btn.disabled = false;
            btn.textContent = '完成设置';
        }
    });
    
    // 登录表单
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = elements.loginForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = '登录中...';
        
        try {
            await login(elements.loginPortalUrl.value, elements.loginPassword.value);
        } finally {
            btn.disabled = false;
            btn.textContent = '登录';
        }
    });
    
    // 匿名申请表单
    elements.applyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const targetPortal = elements.applyForm.dataset.targetPortal;
        const btn = elements.applyForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = '提交中...';
        
        try {
            await applyContact(
                targetPortal,
                elements.applyName.value,
                elements.applyPortal.value,
                elements.applyMessage.value
            );
        } finally {
            btn.disabled = false;
            btn.textContent = '提交申请';
        }
    });
    
    elements.applyToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });
    
    // 退出登录
    elements.logoutBtn.addEventListener('click', logout);
    elements.logoutSetting.addEventListener('click', logout);
    
    // 导航
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(item.dataset.page);
        });
    });
    
    // 分享
    elements.shareBtn.addEventListener('click', toggleShareBox);
    elements.copyUrlBtn.addEventListener('click', copyShareUrl);
    
    // 添加联系人
    elements.addContactBtn.addEventListener('click', addContactByUrl);
    
    // 修改密码
    elements.changePasswordBtn.addEventListener('click', showChangePasswordModal);
    document.querySelector('#change-password-modal .modal-close').addEventListener('click', hideChangePasswordModal);
    document.querySelector('#change-password-modal .modal-cancel').addEventListener('click', hideChangePasswordModal);
    
    elements.changePasswordModal.addEventListener('click', (e) => {
        if (e.target === elements.changePasswordModal) {
            hideChangePasswordModal();
        }
    });
    
    elements.changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (elements.newPassword.value !== elements.confirmNewPassword.value) {
            showToast('两次新密码不一致', 'error');
            return;
        }
        
        try {
            await changePassword(elements.oldPassword.value, elements.newPassword.value);
            hideChangePasswordModal();
        } catch (error) {
            console.error('修改密码失败:', error);
        }
    });
    
    // 聊天
    elements.closeChat.addEventListener('click', closeChat);
    
    elements.sendBtn.addEventListener('click', () => {
        sendMessage(elements.messageInput.value);
    });
    
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(elements.messageInput.value);
        }
    });
    
    // 群组
    document.getElementById('create-group-btn')?.addEventListener('click', showCreateGroupModal);
    document.getElementById('create-group-form')?.addEventListener('submit', handleCreateGroup);
    document.getElementById('close-group-chat')?.addEventListener('click', closeGroupChat);
    document.getElementById('invite-member-btn')?.addEventListener('click', showInviteMemberModal);
    document.getElementById('invite-member-form')?.addEventListener('submit', handleInviteMember);
    document.getElementById('send-group-btn')?.addEventListener('click', () => {
        sendGroupMessage(document.getElementById('group-message-input').value);
    });
    document.getElementById('group-message-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendGroupMessage(document.getElementById('group-message-input').value);
        }
    });
}

// ========== 群组功能 ==========

state.groups = [];
state.selectedGroup = null;

async function loadGroups() {
    try {
        const groups = await apiRequest('/groups');
        state.groups = groups;
        renderGroups();
    } catch (error) {
        console.error('加载群组失败:', error);
    }
}

function renderGroups() {
    const container = document.getElementById('groups-list');
    if (!container) return;
    
    if (state.groups.length === 0) {
        container.innerHTML = '<div class="empty">暂无群组<br>点击上方按钮创建</div>';
        return;
    }
    
    container.innerHTML = state.groups.map(group => `
        <div class="contact-item" data-id="${group.id}">
            <div class="contact-avatar">${group.name[0].toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(group.name)}</div>
                <div class="contact-url">${group.members ? group.members.length : 0} 人</div>
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const group = state.groups.find(g => g.id === id);
            if (group) {
                openGroupChat(group);
            }
        });
    });
}

function showCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    const membersSelect = document.getElementById('group-members-select');
    
    // 渲染联系人选择
    membersSelect.innerHTML = state.contacts.map(contact => `
        <label class="member-checkbox">
            <input type="checkbox" value="${contact.id}">
            <span>${escapeHtml(contact.display_name)}</span>
        </label>
    `).join('');
    
    modal.classList.remove('hidden');
}

async function handleCreateGroup(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const name = document.getElementById('group-name').value;
    const description = document.getElementById('group-description').value;
    
    // 获取选中的成员
    const checkboxes = document.querySelectorAll('#group-members-select input:checked');
    const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    console.log('Creating group:', { name, description, member_ids: memberIds });
    console.log('Token:', state.token);
    
    try {
        const result = await apiRequest('/groups', {
            method: 'POST',
            body: { name, description, member_ids: memberIds }
        });
        console.log('Group created:', result);
        
        document.getElementById('create-group-modal').classList.add('hidden');
        document.getElementById('create-group-form').reset();
        showToast('群组创建成功');
        loadGroups();
    } catch (error) {
        console.error('Create group error:', error);
        showToast('创建失败: ' + error.message, 'error');
    }
}

function openGroupChat(group) {
    state.selectedGroup = group;
    document.getElementById('group-chat-name').textContent = group.name;
    document.getElementById('group-chat-panel').classList.remove('hidden');
    loadGroupMessages(group.id);
}

function closeGroupChat() {
    document.getElementById('group-chat-panel').classList.add('hidden');
    state.selectedGroup = null;
}

async function loadGroupMessages(groupId) {
    try {
        const messages = await apiRequest(`/messages/group/${groupId}`);
        const container = document.getElementById('group-chat-messages');
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty">暂无消息</div>';
            return;
        }
        
        // 按时间排序
        const sortedMessages = [...messages].sort((a, b) => {
            return new Date(a.created_at) - new Date(b.created_at);
        });
        
        container.innerHTML = sortedMessages.map(msg => {
            const isMe = msg.is_from_owner;
            const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const senderName = msg.sender_name || (isMe ? '我' : '成员');
            
            return `
                <div class="message ${isMe ? 'sent' : 'received'}">
                    <div class="message-sender" style="font-size: 12px; color: #666; margin-bottom: 4px;">${senderName}</div>
                    <div>${escapeHtml(msg.content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('加载群消息失败:', error);
    }
}

async function sendGroupMessage(content) {
    if (!state.selectedGroup || !content.trim()) return;
    
    try {
        await apiRequest('/messages/group', {
            method: 'POST',
            body: {
                group_id: state.selectedGroup.id,
                content: content.trim(),
                message_type: 'text'
            },
            headers: {
                'X-Sender-Portal': state.portalUrl
            }
        });
        
        document.getElementById('group-message-input').value = '';
        loadGroupMessages(state.selectedGroup.id);
    } catch (error) {
        console.error('发送群消息失败:', error);
        showToast('发送失败: ' + error.message, 'error');
    }
}

// ========== 邀请成员 ==========

function showInviteMemberModal() {
    if (!state.selectedGroup) {
        showToast('请先选择群组', 'error');
        return;
    }
    
    const modal = document.getElementById('invite-member-modal');
    const membersSelect = document.getElementById('invite-members-select');
    
    // 渲染联系人选择（排除已在群中的）
    const availableContacts = state.contacts.filter(c => {
        // 简化处理，显示所有联系人
        return true;
    });
    
    if (availableContacts.length === 0) {
        membersSelect.innerHTML = '<div class="empty">暂无可用联系人</div>';
    } else {
        membersSelect.innerHTML = availableContacts.map(contact => `
            <label class="member-checkbox">
                <input type="checkbox" value="${contact.id}" data-portal="${contact.portal_url}">
                <span>${escapeHtml(contact.display_name)} (${contact.portal_url})</span>
            </label>
        `).join('');
    }
    
    modal.classList.remove('hidden');
}

async function handleInviteMember(e) {
    e.preventDefault();
    
    if (!state.selectedGroup) {
        showToast('请先选择群组', 'error');
        return;
    }
    
    // 获取选中的联系人
    const checkboxes = document.querySelectorAll('#invite-members-select input:checked');
    const contactIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (contactIds.length === 0) {
        showToast('请选择要邀请的联系人', 'error');
        return;
    }
    
    console.log('Inviting members:', { group_id: state.selectedGroup.id, contact_ids: contactIds });
    
    try {
        // 逐个邀请
        for (const contactId of contactIds) {
            await apiRequest('/groups/invite', {
                method: 'POST',
                body: {
                    group_id: state.selectedGroup.id,
                    contact_id: contactId
                }
            });
        }
        
        document.getElementById('invite-member-modal').classList.add('hidden');
        document.getElementById('invite-member-form').reset();
        showToast('邀请已发送');
    } catch (error) {
        console.error('邀请失败:', error);
        showToast('邀请失败: ' + error.message, 'error');
    }
}

// ========== 初始化 ==========

async function init() {
    bindEvents();
    
    // 检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const targetPortal = urlParams.get('portal') || window.location.origin;
    
    if (action === 'apply') {
        showApplyPage(targetPortal);
        return;
    }
    
    // 检查初始化状态
    const isInitialized = await checkInitStatus();
    
    if (!isInitialized) {
        // 首次使用，显示初始化页面
        showInitPage(window.location.origin);
    } else if (state.token && state.user) {
        // 已登录
        showMainPage();
    } else {
        // 未登录
        showLoginPage();
    }
}

// 启动
document.addEventListener('DOMContentLoaded', init);
