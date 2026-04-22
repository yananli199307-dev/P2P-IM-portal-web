// ==================== 状态 ====================
const state = {
    token: localStorage.getItem('token'),
    user: null,
    portalUrl: '',
    contacts: [],
    groups: [],
    selectedChat: null, // { type: 'private'|'group', id: string, name: string }
    ws: null
};

// ==================== API ====================
const API_URL = '/api';

async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // 绑定事件
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
        showInitPage(window.location.origin);
    } else if (state.token) {
        // 有 token，尝试加载用户信息
        try {
            await loadUserInfo();
            showMainPage();
        } catch (e) {
            // token 无效，清除并显示登录页
            localStorage.removeItem('token');
            state.token = null;
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

function bindEvents() {
    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
    
    // 列表类型切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchListType(btn));
    });
    
    // 设置项
    document.getElementById('show-share-link')?.addEventListener('click', showShareModal);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // 分享弹窗
    document.getElementById('copy-url-btn')?.addEventListener('click', copyShareUrl);
    document.querySelector('#share-modal .modal-close, #share-modal .modal-cancel')?.addEventListener('click', () => hideModal('share-modal'));
    
    // 添加联系人弹窗
    document.getElementById('add-contact-btn')?.addEventListener('click', handleAddContact);
    document.querySelector('#add-contact-modal .modal-close, #add-contact-modal .modal-cancel')?.addEventListener('click', () => hideModal('add-contact-modal'));
    
    // 通用弹窗关闭
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn?.addEventListener('click', () => {
            btn.closest('.modal')?.classList.add('hidden');
        });
    });
    
    // 创建群组
    document.getElementById('create-group-form')?.addEventListener('submit', handleCreateGroup);
    
    // 发送消息
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('message-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // 发送群消息
    document.getElementById('send-group-btn')?.addEventListener('click', sendGroupMessage);
    document.getElementById('group-message-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendGroupMessage();
    });
    
    // 群成员
    document.getElementById('group-members-btn')?.addEventListener('click', showGroupMembers);
    document.getElementById('close-group-members')?.addEventListener('click', hideGroupMembers);
}

// ==================== 页面切换 ====================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
}

function showInitPage(portalUrl) {
    document.getElementById('init-portal-url').textContent = portalUrl;
    showPage('init-page');
    initFormHandler();
}

function showLoginPage() {
    showPage('login-page');
    document.getElementById('login-portal-url').value = window.location.origin;
    loginFormHandler();
}

function showApplyPage(targetPortal) {
    showPage('apply-page');
    document.getElementById('target-portal-display').textContent = targetPortal;
    applyFormHandler(targetPortal);
}

async function showMainPage() {
    showPage('main-page');
    await loadUserInfo();
    await loadContacts();
    await loadGroups();
    renderChatList();
    renderContactList();
    renderGroupList();
    renderRequestList();
    connectWebSocket();
}

// ==================== Tab 切换 ====================
function switchTab(tab) {
    // 更新导航
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tab);
    });
    
    // 更新列表
    document.querySelectorAll('.list-section').forEach(section => {
        section.classList.toggle('hidden', !section.id.startsWith(`list-${tab}`));
    });
    
    // 显示内容区欢迎页
    if (tab !== 'messages') {
        document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
        document.getElementById('welcome-page')?.classList.remove('hidden');
    }
}

function switchListType(btn) {
    const parent = btn.closest('.list-section');
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const type = btn.dataset.type;
    const sectionId = parent.id;
    
    // 隐藏所有列表
    parent.querySelectorAll('.list-items').forEach(list => list.classList.add('hidden'));
    
    // 显示对应列表
    if (sectionId === 'list-messages') {
        document.getElementById('chat-list').classList.remove('hidden');
    } else if (sectionId === 'list-contacts') {
        document.getElementById(`contact-list`).classList.remove('hidden');
        if (type === 'groups') {
            document.getElementById('group-list').classList.remove('hidden');
            document.getElementById('contact-list').classList.add('hidden');
        } else if (type === 'requests') {
            document.getElementById('request-list').classList.remove('hidden');
            document.getElementById('contact-list').classList.add('hidden');
        }
    }
}

// ==================== 加载数据 ====================
async function checkInitStatus() {
    try {
        const data = await fetch(`${API_URL}/auth/status`).then(r => r.json());
        // 后端返回 initialized 或 is_initialized
        const isInitialized = data.initialized || data.is_initialized;
        if (data.portal_url) {
            state.portalUrl = data.portal_url;
        }
        return isInitialized;
    } catch {
        return false;
    }
}

async function loadUserInfo() {
    try {
        const data = await apiRequest('/auth/me');
        state.user = data;
        state.portalUrl = data.portal_url || window.location.origin;
        
        document.getElementById('user-name').textContent = data.display_name || '用户';
        document.getElementById('user-portal').textContent = state.portalUrl.replace(/^https?:\/\//, '');
        document.getElementById('user-avatar').textContent = (data.display_name || 'U')[0].toUpperCase();
    } catch (error) {
        console.error('Load user info failed:', error);
    }
}

async function loadContacts() {
    try {
        const data = await apiRequest('/contacts');
        state.contacts = data.contacts || [];
    } catch (error) {
        console.error('Load contacts failed:', error);
        state.contacts = [];
    }
}

async function loadGroups() {
    try {
        const data = await apiRequest('/groups/my-groups');
        state.groups = data.groups || [];
    } catch (error) {
        console.error('Load groups failed:', error);
        state.groups = [];
    }
}

// ==================== 渲染列表 ====================
function renderChatList() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    
    // 合并私聊和群聊
    const chats = [];
    
    // 私聊
    state.contacts.forEach(contact => {
        chats.push({
            type: 'private',
            id: contact.portal_url,
            name: contact.display_name || '未知',
            portal: contact.portal_url,
            avatar: (contact.display_name || '?')[0].toUpperCase()
        });
    });
    
    // 群聊
    state.groups.forEach(group => {
        chats.push({
            type: 'group',
            id: group.group_id,
            name: group.group_name || '群组',
            memberCount: group.member_count || 0,
            avatar: (group.group_name || '群')[0].toUpperCase()
        });
    });
    
    if (chats.length === 0) {
        container.innerHTML = '<div class="empty">暂无聊天</div>';
        return;
    }
    
    container.innerHTML = chats.map(chat => `
        <div class="list-item" data-type="${chat.type}" data-id="${chat.id}" onclick="openChat('${chat.type}', '${chat.id}', '${chat.name.replace(/'/g, "\\'")}')">
            <div class="avatar">${chat.avatar}</div>
            <div class="list-item-info">
                <div class="list-item-name">${escapeHtml(chat.name)}</div>
                <div class="list-item-preview">${chat.type === 'group' ? `${chat.memberCount} 人` : chat.portal || ''}</div>
            </div>
        </div>
    `).join('');
}

function renderContactList() {
    const container = document.getElementById('contact-list');
    if (!container) return;
    
    if (state.contacts.length === 0) {
        container.innerHTML = '<div class="empty">暂无联系人<br><button class="btn btn-small" onclick="showAddContactModal()">添加联系人</button></div>';
        return;
    }
    
    container.innerHTML = state.contacts.map(contact => `
        <div class="list-item" onclick="openChat('private', '${contact.portal_url}', '${contact.display_name || '未知'.replace(/'/g, "\\'")}')">
            <div class="avatar">${(contact.display_name || '?')[0].toUpperCase()}</div>
            <div class="list-item-info">
                <div class="list-item-name">${escapeHtml(contact.display_name || '未知')}</div>
                <div class="list-item-preview">${contact.portal_url || ''}</div>
            </div>
        </div>
    `).join('');
}

function renderGroupList() {
    const container = document.getElementById('group-list');
    if (!container) return;
    
    if (state.groups.length === 0) {
        container.innerHTML = '<div class="empty">暂无群组<br><button class="btn btn-small btn-primary" onclick="showCreateGroupModal()">创建群组</button></div>';
        return;
    }
    
    container.innerHTML = state.groups.map(group => `
        <div class="list-item" onclick="openChat('group', '${group.group_id}', '${group.group_name || '群组'.replace(/'/g, "\\'")}')">
            <div class="avatar">${(group.group_name || '群')[0].toUpperCase()}</div>
            <div class="list-item-info">
                <div class="list-item-name">${escapeHtml(group.group_name || '群组')}</div>
                <div class="list-item-preview">${group.member_count || 0} 人</div>
            </div>
        </div>
    `).join('');
}

function renderRequestList() {
    const container = document.getElementById('request-list');
    if (!container) return;
    
    container.innerHTML = '<div class="empty">暂无新请求</div>';
}

// ==================== 打开聊天 ====================
function openChat(type, id, name) {
    state.selectedChat = { type, id, name };
    
    // 高亮列表项
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
    });
    
    if (type === 'private') {
        openPrivateChat(id, name);
    } else {
        openGroupChat(id, name);
    }
}

function openPrivateChat(portal, name) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
    document.getElementById('chat-page')?.classList.remove('hidden');
    
    document.getElementById('chat-name').textContent = name;
    document.getElementById('chat-portal').textContent = portal.replace(/^https?:\/\//, '');
    document.getElementById('chat-avatar').textContent = (name || '?')[0].toUpperCase();
    
    loadPrivateMessages(portal);
}

async function loadPrivateMessages(portal) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="loading">加载中</div>';
    
    try {
        const messages = await apiRequest(`/messages/${encodeURIComponent(portal)}`);
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty">暂无消息<br>发送消息开始聊天吧！</div>';
            return;
        }
        
        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.is_from_me ? 'sent' : 'received'}">
                ${!msg.is_from_me ? `<div class="message-sender">${escapeHtml(msg.sender_name || '对方')}</div>` : ''}
                <div class="message-content">${escapeHtml(msg.content)}</div>
                <div class="message-time">${formatTime(msg.created_at)}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        container.innerHTML = '<div class="empty">加载失败</div>';
    }
}

function openGroupChat(groupId, name) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
    document.getElementById('group-chat-page')?.classList.remove('hidden');
    
    document.getElementById('group-chat-name').textContent = name;
    document.getElementById('group-chat-avatar').textContent = (name || '群')[0].toUpperCase();
    
    // 找到群组信息
    const group = state.groups.find(g => g.group_id === groupId);
    document.getElementById('group-member-count').textContent = group ? `${group.member_count || 0} 人` : '';
    
    // 显示/隐藏退出按钮
    const leaveBtn = document.getElementById('group-leave-btn');
    if (group && !group.is_owner) {
        leaveBtn.classList.remove('hidden');
        leaveBtn.onclick = () => handleLeaveGroup(groupId);
    } else {
        leaveBtn.classList.add('hidden');
    }
    
    loadGroupMessages(groupId);
}

async function loadGroupMessages(groupId) {
    const container = document.getElementById('group-chat-messages');
    container.innerHTML = '<div class="loading">加载中</div>';
    
    try {
        const group = state.groups.find(g => g.group_id === groupId);
        const endpoint = group?.db_id 
            ? `/messages/group/${group.db_id}`
            : `/messages/group/by-uuid/${groupId}`;
        
        const messages = await apiRequest(endpoint);
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty">暂无群消息<br>发送消息开始聊天吧！</div>';
            return;
        }
        
        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.is_from_owner ? 'sent' : 'received'}">
                ${!msg.is_from_owner ? `<div class="message-sender">${escapeHtml(msg.sender_name || '成员')}</div>` : ''}
                <div class="message-content">${escapeHtml(msg.content)}</div>
                <div class="message-time">${formatTime(msg.created_at)}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        container.innerHTML = '<div class="empty">加载失败</div>';
    }
}

// ==================== 发送消息 ====================
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    
    const portal = state.selectedChat?.id;
    if (!portal) return;
    
    try {
        await apiRequest(`/messages/${encodeURIComponent(portal)}`, {
            method: 'POST',
            body: { content }
        });
        input.value = '';
        loadPrivateMessages(portal);
    } catch (error) {
        showToast('发送失败: ' + error.message, 'error');
    }
}

async function sendGroupMessage() {
    const input = document.getElementById('group-message-input');
    const content = input.value.trim();
    if (!content) return;
    
    const groupId = state.selectedChat?.id;
    if (!groupId) return;
    
    const group = state.groups.find(g => g.group_id === groupId);
    if (!group) return;
    
    try {
        const endpoint = group.is_owner && group.db_id
            ? `/groups/${group.db_id}/messages/p2p`
            : `/groups/by-uuid/${groupId}/messages/send`;
        
        await apiRequest(endpoint, {
            method: 'POST',
            body: { content }
        });
        input.value = '';
        loadGroupMessages(groupId);
    } catch (error) {
        showToast('发送失败: ' + error.message, 'error');
    }
}

// ==================== 群成员 ====================
function showGroupMembers() {
    const panel = document.querySelector('.group-members-panel');
    if (panel) panel.classList.remove('hidden');
}

function hideGroupMembers() {
    const panel = document.querySelector('.group-members-panel');
    if (panel) panel.classList.add('hidden');
}

// ==================== 弹窗 ====================
function showModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function showAddContactModal() {
    showModal('add-contact-modal');
}

function showShareModal() {
    const url = `${state.portalUrl}?action=apply&portal=${encodeURIComponent(state.portalUrl)}`;
    document.getElementById('share-url-input').value = url;
    showModal('share-modal');
}

function showCreateGroupModal() {
    // 渲染联系人选择
    const container = document.getElementById('group-members-select');
    if (container && state.contacts.length > 0) {
        container.innerHTML = state.contacts.map(c => `
            <label class="member-checkbox">
                <input type="checkbox" value="${c.id}">
                <span>${escapeHtml(c.display_name || '未知')} (${c.portal_url || ''})</span>
            </label>
        `).join('');
    }
    showModal('create-group-modal');
}

// ==================== 表单处理 ====================
function initFormHandler() {
    document.getElementById('init-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('init-display-name').value;
        const password = document.getElementById('init-password').value;
        const confirm = document.getElementById('init-confirm').value;
        
        if (password !== confirm) {
            showToast('两次密码不一致', 'error');
            return;
        }
        
        try {
            await apiRequest('/auth/init', {
                method: 'POST',
                body: { display_name: name, password }
            });
            showToast('设置成功，请登录');
            showLoginPage();
        } catch (error) {
            showToast('设置失败: ' + error.message, 'error');
        }
    });
}

function loginFormHandler() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const portalUrl = document.getElementById('login-portal-url').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: { portal_url: portalUrl, password }
            });
            state.token = data.token;
            state.portalUrl = portalUrl;
            localStorage.setItem('token', data.token);
            showMainPage();
        } catch (error) {
            showToast('登录失败: ' + error.message, 'error');
        }
    });
}

function applyFormHandler(targetPortal) {
    document.getElementById('apply-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('apply-name').value;
        const portal = document.getElementById('apply-portal').value;
        const message = document.getElementById('apply-message').value;
        
        try {
            await apiRequest('/contact-requests', {
                method: 'POST',
                body: { target_portal: targetPortal, your_portal: portal, your_name: name, message }
            });
            showToast('申请已发送');
            setTimeout(() => window.close(), 1500);
        } catch (error) {
            showToast('申请失败: ' + error.message, 'error');
        }
    });
}

async function handleAddContact() {
    const url = document.getElementById('add-contact-url').value.trim();
    if (!url) return;
    
    try {
        await apiRequest('/contact-requests', {
            method: 'POST',
            body: { target_portal: url }
        });
        showToast('申请已发送');
        hideModal('add-contact-modal');
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

async function handleCreateGroup(e) {
    e.preventDefault();
    
    const name = document.getElementById('group-name').value;
    const description = document.getElementById('group-description').value;
    const checkboxes = document.querySelectorAll('#group-members-select input:checked');
    const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    try {
        await apiRequest('/groups', {
            method: 'POST',
            body: { name, description, member_ids: memberIds }
        });
        showToast('群组创建成功');
        hideModal('create-group-modal');
        document.getElementById('create-group-form').reset();
        await loadGroups();
        renderGroupList();
        renderChatList();
    } catch (error) {
        showToast('创建失败: ' + error.message, 'error');
    }
}

async function handleLeaveGroup(groupId) {
    if (!confirm('确定要退出该群吗？')) return;
    
    try {
        await apiRequest(`/groups/by-uuid/${groupId}/leave`, { method: 'POST' });
        showToast('已退出群聊');
        await loadGroups();
        renderGroupList();
        renderChatList();
        document.querySelectorAll('.content-page').forEach(p => p.classList.add('hidden'));
        document.getElementById('welcome-page')?.classList.remove('hidden');
    } catch (error) {
        showToast('退出失败: ' + error.message, 'error');
    }
}

// ==================== WebSocket ====================
function connectWebSocket() {
    if (!state.user) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${state.user.id}`;
    state.ws = new WebSocket(wsUrl);
    
    state.ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWSMessage(data);
        } catch (e) {
            console.error('WS message parse error:', e);
        }
    };
    
    state.ws.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWSMessage(data) {
    if (data.type === 'new_message') {
        if (state.selectedChat?.id === data.portal_url) {
            loadPrivateMessages(data.portal_url);
        }
        showToast(`新消息 from ${data.sender_name}`);
    }
}

// ==================== 工具函数 ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function copyShareUrl() {
    const input = document.getElementById('share-url-input');
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('链接已复制');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast') || document.createElement('div');
    toast.id = 'toast';
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--text)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function logout() {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    location.reload();
}
