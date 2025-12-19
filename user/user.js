/**
 * 用户中心 JavaScript
 */

const API_BASE = '/api';
let currentUser = null;
let apiKeyVisible = false;

// 确认模态框（替代 confirm）
function showConfirm(message, onConfirm, onCancel) {
  const modal = document.getElementById('notify-modal');
  const content = modal.querySelector('.modal-content');
  
  content.innerHTML = `
    <button class="modal-close" onclick="closeConfirmModal(false)" aria-label="关闭">×</button>
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 48px; margin-bottom: 16px; color: #f59e0b;">⚠</div>
      <div style="font-size: 16px; color: var(--text); line-height: 1.5; margin-bottom: 24px;">${message}</div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn ghost" onclick="closeConfirmModal(false)">取消</button>
        <button class="btn primary" onclick="closeConfirmModal(true)">确定</button>
      </div>
    </div>
  `;
  
  window._confirmCallback = { onConfirm, onCancel };
  modal.style.display = 'flex';
}

function closeConfirmModal(confirmed) {
  const modal = document.getElementById('notify-modal');
  modal.style.display = 'none';
  
  const content = modal.querySelector('.modal-content');
  content.innerHTML = `
    <button class="modal-close" onclick="closeNotifyModal()" aria-label="关闭">×</button>
    <div style="text-align: center; padding: 8px 0;">
      <div id="notify-icon" style="font-size: 20px; font-weight: bold; margin-bottom: 16px;"></div>
      <div id="notify-message" style="font-size: 16px; color: var(--text); line-height: 1.5;"></div>
      <div style="margin-top: 24px;">
        <button class="btn primary" onclick="closeNotifyModal()">确定</button>
      </div>
    </div>
  `;
  
  if (window._confirmCallback) {
    if (confirmed && window._confirmCallback.onConfirm) {
      window._confirmCallback.onConfirm();
    } else if (!confirmed && window._confirmCallback.onCancel) {
      window._confirmCallback.onCancel();
    }
    window._confirmCallback = null;
  }
}

// 通知模态框
function showNotify(message, type = 'info') {
  const modal = document.getElementById('notify-modal');
  const icon = document.getElementById('notify-icon');
  const msg = document.getElementById('notify-message');
  
  // 设置图标（不使用 emoji）
  const icons = {
    success: '[成功]',
    error: '[错误]',
    warning: '[警告]',
    info: '[提示]'
  };
  icon.textContent = icons[type] || icons.info;
  icon.style.fontSize = '20px';
  icon.style.fontWeight = 'bold';
  
  // 设置消息
  msg.textContent = message;
  
  // 显示模态框
  modal.style.display = 'flex';
}

function closeNotifyModal() {
  const modal = document.getElementById('notify-modal');
  modal.style.display = 'none';
}

// 工具函数
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  return (bytes / 1024).toFixed(2) + ' KB';
}

function getToken() {
  return localStorage.getItem('mirror_token');
}

function setToken(token) {
  localStorage.setItem('mirror_token', token);
}

function clearToken() {
  localStorage.removeItem('mirror_token');
  localStorage.removeItem('mirror_user');
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

// 更新导航栏登录按钮（与主站保持一致）
function updateNavUser(user) {
  const link = document.getElementById('nav-user');
  if (!link) return;

  if (user && (user.nickname || user.email)) {
    const name = user.nickname || user.email;
    link.textContent = name;
    link.classList.add('logged-in');
    link.href = '/user/'; // 已登录点击进入用户中心
  } else {
    link.textContent = '登录 / 注册';
    link.classList.remove('logged-in');
    link.href = '/user/';
  }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
  initAuthTabs();
  initForms();
  checkAuth();
  
  // 检查 URL 中的邀请码参数
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  if (inviteCode) {
    // 自动填入邀请码
    const inviteInput = document.getElementById('reg-invite');
    if (inviteInput) {
      inviteInput.value = inviteCode.toUpperCase();
    }
    // 切换到注册标签
    const registerTab = document.querySelectorAll('.auth-tab')[1];
    if (registerTab) {
      registerTab.click();
    }
  }
});

// 认证标签切换
function initAuthTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.getElementById('login-form').style.display = tabName === 'login' ? 'flex' : 'none';
      document.getElementById('register-form').style.display = tabName === 'register' ? 'flex' : 'none';
      document.getElementById('forgot-form').style.display = 'none';
    });
  });
}

// 显示忘记密码表单
function showForgotPassword() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('forgot-form').style.display = 'flex';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
}

// 返回登录表单
function showLoginForm() {
  document.getElementById('forgot-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'flex';
  document.querySelectorAll('.auth-tab')[0].classList.add('active');
}

// 表单初始化
function initForms() {
  // 登录表单
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(data.token);
    currentUser = data.user;
    // 缓存用户信息，供主页导航使用
    try {
      localStorage.setItem('mirror_user', JSON.stringify(data.user));
    } catch (e) {}
      showDashboard();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // 注册表单
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';

    const email = document.getElementById('reg-email').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const inviteCode = document.getElementById('reg-invite').value.trim();

    if (password !== password2) {
      errorEl.textContent = '两次输入的密码不一致';
      return;
    }

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname, inviteCode }),
      });

      setToken(data.token);
      currentUser = data.user;
      try {
        localStorage.setItem('mirror_user', JSON.stringify(data.user));
      } catch (e) {}
      showDashboard();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // 忘记密码表单
  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    const email = document.getElementById('forgot-email').value.trim();

    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      // 固定成功提示文案，避免出现“如果该邮箱已注册...”之类的措辞
      successEl.textContent = '重置链接已发送到您的邮箱，请查收';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// 检查登录状态
async function checkAuth() {
  const token = getToken();
  if (!token) {
    showAuthSection();
    updateNavUser(null);
    return;
  }

  try {
    const data = await apiRequest('/user/profile');
    currentUser = data.user;
    showDashboard(data);
  } catch (err) {
    clearToken();
    showAuthSection();
    updateNavUser(null);
  }
}

// 显示登录/注册区域
function showAuthSection() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('dashboard-section').style.display = 'none';
  updateNavUser(null);
}

// 显示仪表盘
async function showDashboard(data) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';

  if (!data) {
    data = await apiRequest('/user/profile');
  }

  // 更新用户信息
  document.getElementById('user-nickname').textContent = data.user.nickname || data.user.email;
  updateNavUser(data.user);

  // 同步缓存，防止主页拿不到最新昵称
  try {
    localStorage.setItem('mirror_user', JSON.stringify(data.user));
  } catch (e) {}
  
  // 更新流量统计（无限制模式）
  document.getElementById('traffic-used').textContent = formatBytes(data.usage.bytesUsed);
  document.getElementById('requests-count').textContent = data.usage.requestsCount.toLocaleString();

  // 子域名设置（所有用户均可使用）
  if (data.user.subdomain) {
    document.getElementById('subdomain-display').style.display = 'block';
    document.getElementById('subdomain-edit').style.display = 'none';
    document.getElementById('subdomain-upgrade').style.display = 'none';
    document.getElementById('subdomain-link').textContent = `https://${data.user.subdomain}.mirror.yljdteam.com`;
    document.getElementById('subdomain-link').href = `https://${data.user.subdomain}.mirror.yljdteam.com`;
  } else {
    document.getElementById('subdomain-display').style.display = 'none';
    document.getElementById('subdomain-edit').style.display = 'block';
    document.getElementById('subdomain-upgrade').style.display = 'none';
  }

  // 邀请码
  updateInviteCodeSection(data);

  // API Key
  document.getElementById('api-key-input').value = data.user.apiKey;

  // 加载流量图表
  loadTrafficChart();
  
  // 加载团队成员
  loadTeamMembers();
}

// 更新邀请码区域
function updateInviteCodeSection(data) {
  const user = data.user;
  
  // 生成邀请码（使用用户ID）
  const inviteCode = `YLJD${user.id.toString().padStart(6, '0')}`;
  document.getElementById('invite-code-input').value = inviteCode;
  
  // 生成邀请链接
  const inviteLink = `${window.location.origin}/user/?invite=${inviteCode}`;
  document.getElementById('invite-link').textContent = inviteLink;
  
  // 显示邀请统计（暂时使用模拟数据，后续需要后端支持）
  document.getElementById('invited-count').textContent = user.invitedCount || 0;
  document.getElementById('team-members-count').textContent = user.teamMembersCount || 0;
}

// 复制邀请码
function copyInviteCode() {
  const input = document.getElementById('invite-code-input');
  input.select();
  document.execCommand('copy');
  showNotify('邀请码已复制到剪贴板', 'success');
}

// 复制邀请链接
function copyInviteLink() {
  const link = document.getElementById('invite-link').textContent;
  const textarea = document.createElement('textarea');
  textarea.value = link;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showNotify('邀请链接已复制到剪贴板', 'success');
}

// 加载团队成员
async function loadTeamMembers() {
  try {
    const data = await apiRequest('/user/team-members');
    const container = document.getElementById('team-members-list');
    
    if (!data.members || data.members.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
          <p>暂无团队成员</p>
          <p style="font-size: 12px; margin-top: 8px;">分享您的邀请码来邀请成员加入</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    data.members.forEach(member => {
      html += `
        <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <div style="font-size: 16px; font-weight: bold; color: var(--text);">${escapeHtml(member.nickname || member.email)}</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                加入时间：${formatDate(member.created_at)}
              </div>
            </div>
            ${member.is_self ? '<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">我</span>' : ''}
          </div>
          
          ${member.recent_activities && member.recent_activities.length > 0 ? `
            <div style="margin-top: 12px;">
              <div style="font-size: 13px; color: var(--text); margin-bottom: 8px; font-weight: 500;">最近活动：</div>
              ${member.recent_activities.map(activity => `
                <div style="padding: 8px; background: rgba(59, 130, 246, 0.05); border-radius: 4px; margin-bottom: 6px; font-size: 12px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: ${getActivityColor(activity.type)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                      ${getActivityLabel(activity.type)}
                    </span>
                    <span style="color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${escapeHtml(activity.path)}
                    </span>
                  </div>
                  <div style="color: var(--text-muted); font-size: 11px; margin-top: 4px;">
                    ${formatDateTime(activity.created_at)}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 20px 0; color: var(--text-muted); font-size: 12px;">
              暂无活动记录
            </div>
          `}
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Load team members error:', err);
    document.getElementById('team-members-list').innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: #dc3545;">
        加载失败：${err.message}
      </div>
    `;
  }
}

// 获取活动类型标签
function getActivityLabel(type) {
  const labels = {
    github: 'GitHub',
    docker: 'Docker',
    file: '文件下载',
    api: 'API',
    other: '其他'
  };
  return labels[type] || type;
}

// 获取活动类型颜色
function getActivityColor(type) {
  const colors = {
    github: '#10b981',
    docker: '#3b82f6',
    file: '#f59e0b',
    api: '#8b5cf6',
    other: '#6b7280'
  };
  return colors[type] || '#6b7280';
}

// 转义HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// 格式化日期时间
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }
  // 小于1小时
  if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  }
  // 小于24小时
  if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  }
  // 小于7天
  if (diff < 604800000) {
    return Math.floor(diff / 86400000) + '天前';
  }
  
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// 更新子域名区域
function updateSubdomainSection(data) {
  const displayEl = document.getElementById('subdomain-display');
  const editEl = document.getElementById('subdomain-edit');
  const upgradeEl = document.getElementById('subdomain-upgrade');

  if (!data.subscription.hasSubdomain) {
    // 当前套餐不支持子域名
    displayEl.style.display = 'none';
    editEl.style.display = 'none';
    upgradeEl.style.display = 'block';
  } else if (data.user.subdomain) {
    // 已设置子域名
    const link = document.getElementById('subdomain-link');
    link.textContent = `${data.user.subdomain}.mirror.yljdteam.com`;
    link.href = `https://${data.user.subdomain}.mirror.yljdteam.com`;
    displayEl.style.display = 'block';
    editEl.style.display = 'none';
    upgradeEl.style.display = 'none';
  } else {
    // 可以设置子域名
    displayEl.style.display = 'none';
    editEl.style.display = 'block';
    upgradeEl.style.display = 'none';
  }
}

function showSubdomainEdit() {
  document.getElementById('subdomain-display').style.display = 'none';
  document.getElementById('subdomain-edit').style.display = 'block';
}

async function saveSubdomain() {
  const input = document.getElementById('subdomain-input');
  const errorEl = document.getElementById('subdomain-error');
  errorEl.textContent = '';

  const subdomain = input.value.trim().toLowerCase();

  if (!subdomain) {
    errorEl.textContent = '请输入子域名';
    return;
  }

  try {
    const data = await apiRequest('/user/subdomain', {
      method: 'POST',
      body: JSON.stringify({ subdomain }),
    });

    showNotify('子域名设置成功！', 'success');
    checkAuth(); // 刷新页面数据
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// API Key 操作
function toggleApiKey() {
  const input = document.getElementById('api-key-input');
  const btn = event.target;
  apiKeyVisible = !apiKeyVisible;
  input.type = apiKeyVisible ? 'text' : 'password';
  btn.textContent = apiKeyVisible ? '隐藏' : '显示';
}

function copyApiKey() {
  const input = document.getElementById('api-key-input');
  navigator.clipboard.writeText(input.value).then(() => {
    showNotify('API Key 已复制到剪贴板', 'success');
  }).catch(() => {
    showNotify('复制失败，请手动复制', 'error');
  });
}

async function refreshApiKey() {
  const confirmed = await new Promise((resolve) => {
    showConfirm('确定要刷新 API Key 吗？刷新后原有的 Key 将失效。', 
      () => resolve(true),
      () => resolve(false)
    );
  });
  
  if (!confirmed) {
    return;
  }

  try {
    const data = await apiRequest('/user/api-key/refresh', {
      method: 'POST',
    });

    document.getElementById('api-key-input').value = data.apiKey;
    showNotify('API Key 已刷新', 'success');
  } catch (err) {
    showNotify('刷新失败：' + err.message, 'error');
  }
}

// 为爱发电模式 - 不再需要套餐购买相关代码

// 加载流量图表
let trafficChart = null;

async function loadTrafficChart() {
  try {
    // 检查 Chart.js 是否已加载
    if (typeof Chart === 'undefined') {
      console.error('Chart.js 未加载，请刷新页面重试');
      return;
    }
    
    const data = await apiRequest('/user/traffic/stats?days=30');
    
    const canvas = document.getElementById('traffic-chart');
    if (!canvas) {
      console.error('找不到流量图表容器');
      return;
    }
    const ctx = canvas.getContext('2d');

    // 准备数据
    const chartData = data.daily;
    const labels = chartData.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const bytesData = chartData.map(d => d.bytesUsed);

    // 如果图表已存在，销毁它
    if (trafficChart) {
      trafficChart.destroy();
    }

    // 创建折线图
    trafficChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '流量使用',
          data: bytesData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4, // 平滑曲线
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#6b7280',
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return '流量: ' + formatBytes(context.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            },
            ticks: {
              color: '#6b7280',
              font: {
                size: 11
              },
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(229, 231, 235, 0.5)'
            },
            ticks: {
              color: '#6b7280',
              font: {
                size: 11
              },
              callback: function(value) {
                return formatBytes(value);
              }
            },
            beginAtZero: true
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

  } catch (err) {
    console.error('加载流量统计失败:', err);
    // 显示错误信息
    const canvas = document.getElementById('traffic-chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ef4444';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('加载流量统计失败', canvas.width / 2, canvas.height / 2);
  }
}

// 登出
async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // 忽略错误
  }
  clearToken();
  showAuthSection();
}

// 切换用户：不调用后端登出，只清本地状态并回到登录表单
function switchAccount() {
  try {
    clearToken();
    localStorage.removeItem('mirror_user');
  } catch (e) {}

  showAuthSection();
  // 强制切回登录 Tab
  document.getElementById('login-form').style.display = 'flex';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('forgot-form').style.display = 'none';
  const tabs = document.querySelectorAll('.auth-tab');
  if (tabs[0]) {
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');
  }
}

