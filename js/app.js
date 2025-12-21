const pages = ["github", "docker", "download", "email", "sms", "cursor", "sponsors"];

function showPage(name) {
  pages.forEach(p => {
    const pageEl = document.getElementById("page-" + p);
    if (pageEl) pageEl.style.display = "none";
  });
  const targetPage = document.getElementById("page-" + name);
  if (targetPage) targetPage.style.display = "block";
}

function router() {
  const hash = location.hash.replace("#/", "") || "github";
  showPage(hash);
  
  // 如果切换到邮箱页面，加载历史
  if (hash === 'email') {
    setTimeout(() => loadEmailHistory(), 100);
  }
  
  // 如果切换到感谢名单页面，加载数据
  if (hash === 'sponsors') {
    setTimeout(() => loadSponsors(), 100);
  }
  
  // 如果切换到短信接码页面，加载使用情况
  if (hash === 'sms') {
    setTimeout(() => loadSmsUsage(), 100);
  }
}
window.addEventListener("hashchange", router);
router();

/* 欢迎模态框控制 */
function showWelcomeModal() {
  const modal = document.getElementById("welcome-modal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden"; // 防止背景滚动
  }
}

function closeWelcomeModal() {
  const modal = document.getElementById("welcome-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = ""; // 恢复滚动
    // 标记为已访问，不再显示
    localStorage.setItem("mirror_welcome_shown", "true");
  }
}

// 检测是否是首次访问
function checkFirstVisit() {
  const hasShown = localStorage.getItem("mirror_welcome_shown");
  if (!hasShown) {
    // 延迟显示，确保页面加载完成
    setTimeout(() => {
      showWelcomeModal();
    }, 300);
  }
}

// 更新导航栏登录按钮（未登录 = 登录/注册；已登录 = 显示昵称）
function updateNavUser(user) {
  const link = document.getElementById("nav-user");
  if (!link) return;

  if (user && (user.nickname || user.email)) {
    const name = user.nickname || user.email;
    link.textContent = name;
    link.classList.add("logged-in");
    link.href = "/user/"; // 点击进入用户中心
  } else {
    link.textContent = "登录 / 注册";
    link.classList.remove("logged-in");
    link.href = "/user/";
  }
}

async function initAuthNav() {
  // 1) 先尝试从本地缓存获取用户信息（登录时由 /user/ 页面写入）
  try {
    const cached = localStorage.getItem("mirror_user");
    if (cached) {
      const user = JSON.parse(cached);
      if (user && (user.nickname || user.email)) {
        updateNavUser(user);
      }
    }
  } catch (e) {}

  // 2) 再尝试通过 token 向后端确认一次（保证信息最新）
  try {
    const token = localStorage.getItem("mirror_token");
    if (!token) {
      if (!localStorage.getItem("mirror_user")) {
        updateNavUser(null);
      }
      return;
    }

    const res = await fetch("/api/user/profile", {
      headers: {
        "Authorization": "Bearer " + token,
      },
    });
    if (!res.ok) {
      // token 失效，清理
      localStorage.removeItem("mirror_token");
      localStorage.removeItem("mirror_user");
      updateNavUser(null);
      return;
    }
    const data = await res.json();
    if (data && data.user) {
      updateNavUser(data.user);
      try {
        localStorage.setItem("mirror_user", JSON.stringify(data.user));
      } catch (e) {}
    }
  } catch (e) {
    // 网络异常时保留本地缓存显示
  }
}

// 获取用户专属子域名（从缓存或 API）
let cachedSubdomain = null;
async function getUserSubdomain() {
  if (cachedSubdomain) return cachedSubdomain;
  
  try {
    const cached = localStorage.getItem("mirror_user");
    if (cached) {
      const user = JSON.parse(cached);
      if (user && user.subdomain) {
        cachedSubdomain = user.subdomain;
        return cachedSubdomain;
      }
    }
    
    const token = localStorage.getItem("mirror_token");
    if (!token) return null;
    
    const res = await fetch("/api/user/profile", {
      headers: { "Authorization": "Bearer " + token },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user && data.user.subdomain) {
        cachedSubdomain = data.user.subdomain;
        try {
          localStorage.setItem("mirror_user", JSON.stringify(data.user));
        } catch (e) {}
        return cachedSubdomain;
      }
    }
  } catch (e) {}
  return null;
}

// 通知模态框（替代 alert）
// 显示加载提示
function showLoading(message = '加载中...') {
  showNotify(message, 'info');
}

// 隐藏加载提示（实际上不需要，因为 showNotify 会自动关闭）
function hideLoading() {
  // 可以在这里添加隐藏加载指示器的逻辑
  // 目前使用 showNotify，它会自动关闭，所以这里可以为空
}

function showNotify(message, type = "info") {
  const modal = document.getElementById("notify-modal");
  const iconEl = document.getElementById("notify-icon");
  const msgEl = document.getElementById("notify-message");
  if (!modal || !iconEl || !msgEl) {
    alert(message); // 降级到 alert
    return;
  }
  
  const labels = {
    info: "[信息]",
    success: "[成功]",
    error: "[错误]",
    warning: "[警告]"
  };
  const colors = {
    info: "#3b82f6",
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b"
  };
  
  iconEl.textContent = labels[type] || labels.info;
  iconEl.style.color = colors[type] || colors.info;
  msgEl.textContent = message;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeNotifyModal() {
  const modal = document.getElementById("notify-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

// 确认对话框
let confirmCallback = null;

function showConfirm(message, callback) {
  // console.log('[showConfirm] 调用，消息:', message);
  const modal = document.getElementById("confirm-modal");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok-btn");
  
  // console.log('[showConfirm] 元素检查:', {
  //   modal: !!modal,
  //   msgEl: !!msgEl,
  //   okBtn: !!okBtn
  // });
  
  if (!modal || !msgEl || !okBtn) {
    // console.log('[showConfirm] 元素不存在，使用原生 confirm');
    // 降级到原生 confirm
    if (confirm(message)) {
      // console.log('[showConfirm] 用户点击确定');
      callback?.();
    } else {
      // console.log('[showConfirm] 用户点击取消');
    }
    return;
  }
  
  msgEl.textContent = message;
  confirmCallback = callback;
  // console.log('[showConfirm] 回调已保存');
  
  // 移除旧的事件监听器，添加新的
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  
  newOkBtn.addEventListener('click', () => {
    // console.log('[showConfirm] 确定按钮被点击');
    // 先保存回调函数引用
    const callback = confirmCallback;
    // console.log('[showConfirm] 回调函数引用已保存:', !!callback);
    
    // 关闭对话框
    closeConfirmModal();
    
    // 执行回调函数
    if (callback) {
      // console.log('[showConfirm] 执行回调函数');
      callback();
    } else {
      // console.log('[showConfirm] 警告：回调函数为空');
    }
  });
  
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  // console.log('[showConfirm] 对话框已显示');
}

function closeConfirmModal() {
  // console.log('[closeConfirmModal] 关闭对话框');
  const modal = document.getElementById("confirm-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
    confirmCallback = null;
  }
}

// 点击模态框外部关闭 + 初始化导航登录状态
document.addEventListener("DOMContentLoaded", function() {
  const welcomeModal = document.getElementById("welcome-modal");
  if (welcomeModal) {
    welcomeModal.addEventListener("click", function(e) {
      if (e.target === welcomeModal) {
        closeWelcomeModal();
      }
    });

    // ESC 键关闭
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        if (welcomeModal.style.display === "flex") {
          closeWelcomeModal();
        }
        const notifyModal = document.getElementById("notify-modal");
        if (notifyModal && notifyModal.style.display === "flex") {
          closeNotifyModal();
        }
      }
    });

    // 检测首次访问
    checkFirstVisit();
  }
  
  const notifyModal = document.getElementById("notify-modal");
  if (notifyModal) {
    notifyModal.addEventListener("click", function(e) {
      if (e.target === notifyModal) {
        closeNotifyModal();
      }
    });
  }

  // 监听下载输入框变化，清空时禁用下载按钮
  const dlUrlInput = document.getElementById("dl-url");
  const downloadBtn = document.getElementById("download-btn");
  if (dlUrlInput && downloadBtn) {
    dlUrlInput.addEventListener("input", function() {
      if (!this.value.trim()) {
        downloadBtn.disabled = true;
        const resultInput = document.getElementById("dl-result");
        if (resultInput) {
          resultInput.value = "";
          resultInput.dataset.url = "";
        }
      }
    });
  }

  // 初始化导航登录状态
  initAuthNav();
});

/* GitHub 搜索（Clone 仍然走镜像） */
async function searchGithub(page) {
  const q = document.getElementById("gh-keyword").value.trim();
  if (!q) return;

  const list = document.getElementById("gh-results");
  const p = document.getElementById("gh-pagination");
  const loading = document.getElementById("gh-loading");

  list.innerHTML = "";
  p.innerHTML = "";
  loading.style.display = "inline-block";

  try {
    const res = await fetch(`/gh/search/repositories?q=${encodeURIComponent(q)}&page=${page}&per_page=10&sort=stars`);
    if (!res.ok) throw new Error("搜索失败");
    const data = await res.json();

  data.items.forEach(r => {
    const div = document.createElement("div");
    div.className = "repo";
      const cloneUrl = `${window.location.origin}/${r.full_name}.git`;
    div.innerHTML = `
        <a href="/${r.full_name}" target="_blank" rel="noopener">${r.full_name}</a>
      <div class="desc">${r.description || "暂无描述"}</div>
      ⭐ ${r.stargazers_count} · Fork ${r.forks_count}
      <div class="clone">
          <span class="mono">${cloneUrl}</span>
          <button class="copy-btn" onclick="copyClone('${cloneUrl}')">复制</button>
      </div>
    `;
    list.appendChild(div);
  });

  if (page > 1) p.innerHTML += `<button onclick="searchGithub(${page-1})">上一页</button>`;
    if (data.items && data.items.length) p.innerHTML += `<button onclick="searchGithub(${page+1})">下一页</button>`;
  } catch (err) {
    list.innerHTML = `<div class="hint">搜索失败，请稍后再试</div>`;
  } finally {
    loading.style.display = "none";
  }
}

/* 复制 clone 地址 */
function copyClone(text) {
  copyTextById(null, text);
  showNotify("已复制到剪贴板", "success");
}

/* 检测镜像在指定节点是否可用 */
async function checkImageAvailability(host, imageName) {
  try {
    // 构造 Registry API v2 路径
    // 官方镜像（library）路径：/v2/library/<name>/manifests/latest
    // 其他镜像路径：/v2/<namespace>/<name>/manifests/latest
    let apiPath = "";
    if (imageName.includes("/")) {
      const parts = imageName.split("/");
      if (parts.length === 2) {
        apiPath = `/v2/${parts[0]}/${parts[1]}/manifests/latest`;
      } else {
        apiPath = `/v2/${imageName}/manifests/latest`;
      }
    } else {
      // 官方镜像
      apiPath = `/v2/library/${imageName}/manifests/latest`;
    }

    // 节点检测策略说明：
    // - 香港节点 mirror.yljdteam.com：直接代理 Docker Hub
    // - 广州节点 violetteam.cloud：代理腾讯云加速，但底层仍从 Docker Hub 同步镜像
    // => 镜像是否存在统一以 Docker Hub 官方 Registry 为准，两个节点检测逻辑相同
    let proxyUrl;
    if (host === "mirror.yljdteam.com" || host === "violetteam.cloud") {
      proxyUrl = `/file/https/registry-1.docker.io${apiPath}`;
    } else {
      // 其他情况，使用通用方式
      proxyUrl = `/file/https/${host}${apiPath}`;
    }
    
    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    try {
      const res = await fetch(proxyUrl, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return { available: true, error: null };
      } else if (res.status === 404) {
        return { available: false, error: "镜像不存在" };
      } else if (res.status === 401 || res.status === 403) {
        // 401/403 可能表示需要认证，但镜像可能存在
        return { available: true, error: null }; // 镜像存在但可能需要认证
      } else {
        return { available: false, error: `状态码: ${res.status}` };
      }
      
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err.name === "AbortError") {
        return { available: false, error: "检测超时" };
      }
      
      // 如果 HEAD 失败，尝试 GET 请求（某些 Registry 可能不支持 HEAD）
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 8000);
      try {
        const getRes = await fetch(proxyUrl, {
          method: "GET",
          signal: getController.signal,
        });
        clearTimeout(getTimeoutId);
        if (getRes.ok) {
          return { available: true, error: null };
        } else if (getRes.status === 404) {
          return { available: false, error: "镜像不存在" };
        } else {
          return { available: false, error: `状态码: ${getRes.status}` };
        }
      } catch (getErr) {
        clearTimeout(getTimeoutId);
        if (getErr.name === "AbortError") {
          return { available: false, error: "检测超时" };
        }
        return { available: null, error: "检测失败" };
      }
    }
  } catch (err) {
    return { available: null, error: err.message || "检测失败" };
  }
}

/* 更新节点状态显示 */
function updateNodeStatus(elementId, status, error) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let statusClass, statusText;
  
  if (status === "checking") {
    statusClass = "status-checking";
    statusText = "检测中...";
  } else if (status === "available") {
    statusClass = "status-available";
    statusText = "✓ 可用";
  } else if (status === null) {
    // 无法检测（可能是 CORS 或其他网络问题）
    statusClass = "status-unknown";
    statusText = `? 无法检测${error ? ` (${error})` : ""}`;
  } else {
    // unavailable
    statusClass = "status-unavailable";
    statusText = `✗ 不可用${error ? ` (${error})` : ""}`;
  }

  element.className = `node-status ${statusClass}`;
  element.textContent = statusText;
}

/* Docker Hub 搜索 */
async function searchDocker(page) {
  const q = document.getElementById("docker-keyword").value.trim();
  if (!q) return;

  const list = document.getElementById("docker-results");
  const p = document.getElementById("docker-pagination");
  const loading = document.getElementById("docker-loading");

  list.innerHTML = "";
  p.innerHTML = "";
  loading.style.display = "inline-block";

  try {
    // 通过通用 /file/https 代理访问 Docker Hub，避免专门的 /v2/search 代理带来的 400 问题
    const res = await fetch(
      `/file/https/hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(q)}&page=${page}&page_size=10`
    );
    if (!res.ok) throw new Error("搜索失败");
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      list.innerHTML = `<div class="hint">未找到相关镜像</div>`;
      return;
    }

    // 获取用户专属子域名（如果有）- 在循环外获取一次即可
    const userSubdomain = await getUserSubdomain();

    data.results.forEach((r, index) => {
      const div = document.createElement("div");
      div.className = "repo";

      // -------- 构造镜像名（防止出现 undefined/xxx 的情况）--------
      let imageName = "";
      if (r.repo_name && r.repo_name.includes("/")) {
        // repo_name 已经包含 namespace，例如 "ollama/ollama"
        imageName = r.repo_name;
      } else if (r.namespace && r.namespace !== "library") {
        imageName = `${r.namespace}/${r.repo_name}`;
      } else {
        // 官方镜像或无 namespace 的情况
        imageName = r.repo_name || "";
      }

      // 如果有专属子域名，优先显示专属域名；否则显示公共节点
      let primaryHost, primaryLabel, secondaryHost, secondaryLabel;
      if (userSubdomain) {
        primaryHost = `${userSubdomain}.mirror.yljdteam.com`;
        primaryLabel = "专属节点：";
        secondaryHost = "mirror.yljdteam.com";
        secondaryLabel = "香港节点：";
      } else {
        primaryHost = "mirror.yljdteam.com";
        primaryLabel = "香港节点：";
        secondaryHost = "violetteam.cloud";
        secondaryLabel = "广州节点：";
      }
      
      const primaryImage = `${primaryHost}/${imageName}`;
      const secondaryImage = `${secondaryHost}/${imageName}`;
      const pullPrimary = `docker pull ${primaryImage}`;
      const pullSecondary = `docker pull ${secondaryImage}`;

      // 为每个节点创建唯一的 ID
      const primaryStatusId = `status-primary-${page}-${index}`;
      const secondaryStatusId = `status-secondary-${page}-${index}`;

      // Docker Hub 原始仓库地址（通过本机通用代理打开 Web 页面）
      const hubPath =
        (r.namespace === "library" || imageName.startsWith("library/"))
          ? `/_/${imageName.split("/").pop()}`
          : `/r/${imageName}`;

      div.innerHTML = `
        <a href="/file/https/hub.docker.com${hubPath}" target="_blank" rel="noopener">${imageName}</a>
        <div class="desc">${r.short_description || "暂无描述"}</div>
        ⭐ ${r.star_count || 0} · 拉取 ${formatPullCount(r.pull_count || 0)}
        <div class="clone">
          <div class="docker-node-header">
          <div class="mono docker-node-title">${primaryLabel}</div>
            <span id="${primaryStatusId}" class="node-status status-checking">检测中...</span>
          </div>
          <div class="clone-command-row">
          <span class="mono">${pullPrimary}</span>
          <button class="copy-btn" onclick="copyClone('${pullPrimary}')">复制</button>
          </div>
        </div>
        <div class="clone">
          <div class="docker-node-header">
          <div class="mono docker-node-title">${secondaryLabel}</div>
            <span id="${secondaryStatusId}" class="node-status status-checking">检测中...</span>
          </div>
          <div class="clone-command-row">
          <span class="mono">${pullSecondary}</span>
          <button class="copy-btn" onclick="copyClone('${pullSecondary}')">复制</button>
          </div>
        </div>
      `;
      list.appendChild(div);

      // 异步检测两个节点的可用性
      (async () => {
        // 检测主节点（专属或香港）
        const primaryResult = await checkImageAvailability(primaryHost, imageName);
        const primaryStatus = primaryResult.available === true ? "available" : 
                             primaryResult.available === false ? "unavailable" : 
                             null;
        updateNodeStatus(primaryStatusId, primaryStatus, primaryResult.error);

        // 检测次节点（香港或广州）
        const secondaryResult = await checkImageAvailability(secondaryHost, imageName);
        const secondaryStatus = secondaryResult.available === true ? "available" : 
                                secondaryResult.available === false ? "unavailable" : 
                                null;
        updateNodeStatus(secondaryStatusId, secondaryStatus, secondaryResult.error);
      })();
    });

    // 分页
    if (page > 1) p.innerHTML += `<button onclick="searchDocker(${page-1})">上一页</button>`;
    if (data.next) p.innerHTML += `<button onclick="searchDocker(${page+1})">下一页</button>`;
  } catch (err) {
    list.innerHTML = `<div class="hint">搜索失败，请稍后再试</div>`;
  } finally {
    loading.style.display = "none";
  }
}

/* 格式化拉取次数 */
function formatPullCount(count) {
  if (count >= 1000000000) return (count / 1000000000).toFixed(1) + "B";
  if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
  if (count >= 1000) return (count / 1000).toFixed(1) + "K";
  return count.toString();
}

/* 通用复制：若传 elementId 则取元素内容，否则用 text */
function copyTextById(elementId, fallbackText) {
  try {
    let text = fallbackText || "";
    if (elementId) {
      const el = document.getElementById(elementId);
      if (!el) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        text = el.value;
      } else {
        text = el.innerText || el.textContent || "";
      }
    }
    text = (text || "").trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showNotify("已复制到剪贴板", "success");
    }).catch(() => {
      showNotify("复制失败，请手动复制", "error");
    });
  } catch (e) {
    showNotify("复制失败，请手动复制", "error");
  }
}

/* 构造加速链接（统一处理 GitHub / 其他域名） */
function buildAcceleratedUrl(u) {
  let host = u.host;
  let pathname = u.pathname;

  // 如果是本站中转出来的链接，解析出真实的目标 host/path
  if (host === "mirror.yljdteam.com") {
    // 1) /<owner>/<repo>/... (直接格式，无需 /github/ 前缀)
    // 直接使用，不需要处理
    // 2) /file/https/github.com/...
    if (pathname.startsWith("/file/https/")) {
      const rest = pathname.replace(/^\/file\/https\//, "");
      const idx = rest.indexOf("/");
      if (idx !== -1) {
        host = rest.slice(0, idx);
        pathname = rest.slice(idx);
      } else {
        host = rest;
        pathname = "/";
      }
    }
  }

  const isGithub = host === "github.com";
  if (isGithub) {
    // GitHub 软件包下载统一走广州节点 https://violetteam.cloud:9090
    // 路径格式：/<owner>/<repo>/... 直接转发到 https://github.com/...
    return "https://violetteam.cloud/ghproxy/github" + pathname + (u.search || "");
  }

  // 非 GitHub => 直接由本站代理下载，保留查询参数
  const proto = u.protocol.replace(":", "");
  return (
    location.origin +
    "/file/" +
    proto +
    "/" +
    host +
    pathname +
    (u.search || "")
  );
}

/* 文件下载加速
 * - 支持直接粘贴 URL
 * - 也支持粘贴 curl/wget 安装命令，会自动替换其中的 URL 为加速地址
 */
function genDownload() {
  const raw = document.getElementById("dl-url").value.trim();
  if (!raw) return;

  try {
    // 尝试从命令中提取 URL（支持 curl -fsSL https://... | sh 这类）
    const urlMatch = raw.match(/https?:\/\/[^\s'"]+/);
    const targetUrl = urlMatch ? urlMatch[0] : raw;

    const u = new URL(targetUrl);
    const accel = buildAcceleratedUrl(u);

    let output = accel;
    if (urlMatch) {
      // 命令模式：用加速后的链接替换原始链接
      output = raw.replace(urlMatch[0], accel);
    }

    const resultInput = document.getElementById("dl-result");
    resultInput.value = output;
    // 存一份纯链接，用于"直接下载"按钮
    resultInput.dataset.url = accel;
    
    // 启用下载按钮
    const downloadBtn = document.getElementById("download-btn");
    if (downloadBtn) {
      downloadBtn.disabled = false;
    }
  } catch (e) {
    showNotify("请输入合法的下载链接或命令", "warning");
    const downloadBtn = document.getElementById("download-btn");
    if (downloadBtn) {
      downloadBtn.disabled = true;
    }
  }
}

/* 一键下载文件 */
function downloadFile() {
  const resultInput = document.getElementById("dl-result");
  const url = resultInput.dataset.url || resultInput.value.trim();
  
  if (!url) {
    showNotify("请先生成加速地址", "warning");
    return;
  }

  try {
    // 创建临时链接并触发下载（不跳转新标签页），兼容移动端
    const link = document.createElement("a");
    link.href = url;
    link.download = ""; // 让浏览器自动检测文件名
    link.target = "_self";
    link.rel = "noopener noreferrer";
    link.style.display = "none";

    document.body.appendChild(link);
    // 对部分移动端浏览器，使用合成事件更可靠
    link.dispatchEvent(new MouseEvent("click", { view: window, bubbles: true, cancelable: true }));
    document.body.removeChild(link);
  } catch (e) {
    // 如果下载失败，直接在当前页跳转
    window.location.href = url;
  }
}

/* ============================================
 * 临时邮箱功能
 * ============================================ */
let currentEmailAddress = '';
const EMAIL_HISTORY_KEY = 'temp_email_history';
let emailRefreshTimer = null;

// 监听路由变化，显示历史邮箱
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#/email') {
    setTimeout(() => loadEmailHistory(), 100);
  }
});

// 页面加载时也检查
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#/email') {
    setTimeout(() => loadEmailHistory(), 100);
  }
  if (window.location.hash === '#/sponsors') {
    setTimeout(() => loadSponsors(), 100);
  }
});

// 从外部 JSON 文件加载感谢名单
async function loadSponsors() {
  try {
    const response = await fetch('/sponsors.json?t=' + Date.now());
    const data = await response.json();
    
    const domainSponsors = data.domainSponsors || [];
    const moneySponsors = data.moneySponsors || [];
    
    // 渲染域名赞助者
    const domainContainer = document.getElementById('domain-sponsors');
    if (domainContainer) {
      if (domainSponsors.length > 0) {
        domainContainer.innerHTML = domainSponsors.map(sponsor => `
          <div style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
            <span style="font-size: 15px; font-weight: 600; color: #667eea;">${escapeHtml(sponsor.name)}</span>
            <span style="font-size: 13px; color: var(--text);">提供 <strong>${escapeHtml(sponsor.domain)}</strong></span>
            <span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(sponsor.date)}</span>
          </div>
        `).join('');
      } else {
        domainContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; width: 100%; text-align: center; padding: 20px 0;">暂无域名赞助者，期待您的支持 💜</div>';
      }
    }
    
    // 渲染资金赞助者
    const moneyContainer = document.getElementById('money-sponsors');
    if (moneyContainer) {
      if (moneySponsors.length > 0) {
        moneyContainer.innerHTML = moneySponsors.map(sponsor => `
          <div style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(245, 87, 108, 0.1); border: 1px solid rgba(245, 87, 108, 0.3); border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(245, 87, 108, 0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
            <span style="font-size: 15px; font-weight: 600; color: #f5576c;">${escapeHtml(sponsor.name)}</span>
            <span style="font-size: 13px; color: var(--text); font-weight: 600;">${escapeHtml(sponsor.amount)}</span>
            <span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(sponsor.date)}</span>
          </div>
        `).join('');
      } else {
        moneyContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; width: 100%; text-align: center; padding: 20px 0;">暂无资金赞助者，期待您的支持 ❤️</div>';
      }
    }
  } catch (error) {
    // console.error('加载感谢名单失败:', error);
    const domainContainer = document.getElementById('domain-sponsors');
    const moneyContainer = document.getElementById('money-sponsors');
    if (domainContainer) {
      domainContainer.innerHTML = '<div style="color: #ef4444; font-size: 14px; width: 100%; text-align: center;">加载失败，请刷新重试</div>';
    }
    if (moneyContainer) {
      moneyContainer.innerHTML = '<div style="color: #ef4444; font-size: 14px; width: 100%; text-align: center;">加载失败，请刷新重试</div>';
    }
  }
}

// HTML 转义函数（防止 XSS）
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 加载历史邮箱
function loadEmailHistory() {
  try {
    const historyContainer = document.getElementById('email-history');
    const historyList = document.getElementById('email-history-list');
    
    if (!historyContainer || !historyList) {
      return; // 元素还未加载
    }
    
    const historyData = localStorage.getItem(EMAIL_HISTORY_KEY);
    // console.log('[加载历史] localStorage 数据:', historyData);
    
    const history = JSON.parse(historyData || '[]');
    const now = Date.now();
    
    // 过滤掉过期的邮箱（24小时）
    const validHistory = history.filter(item => {
      return (now - item.timestamp) < 24 * 60 * 60 * 1000;
    });
    
    // console.log('[加载历史] 原始数量:', history.length, '有效数量:', validHistory.length);
    
    // 仅当有过期项时才保存过滤后的历史
    if (validHistory.length > 0 && validHistory.length !== history.length) {
      // console.log('[加载历史] 保存过滤后的历史');
      localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(validHistory));
    }
    
    // 显示历史列表
    historyContainer.style.display = 'block';
    
    if (validHistory.length > 0) {
      historyList.innerHTML = validHistory.map(item => {
        const timeAgo = getTimeAgo(item.timestamp);
        const escapedEmail = item.email.replace(/'/g, "\\'");
        return `
          <div style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; cursor: pointer; transition: all 0.2s; hover: opacity: 0.8;" onclick="useHistoryEmail('${escapedEmail}')" title="点击使用此邮箱">
            <span style="font-size: 12px; color: #3b82f6; font-family: monospace;">${item.email}</span>
            <span style="font-size: 10px; color: var(--text-muted);">(${timeAgo})</span>
          </div>
        `;
      }).join('');
    } else {
      historyList.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 20px 0; color: var(--text-muted); font-size: 13px;">
          暂无历史记录，生成邮箱后会自动显示在这里
        </div>
      `;
    }
  } catch (e) {
    // console.error('Load email history error:', e);
  }
}

// 使用历史邮箱
function useHistoryEmail(email) {
  const [name, domain] = email.split('@');
  document.getElementById('email-name').value = name;
  
  // 设置域名选择器
  const domainSelect = document.getElementById('email-domain');
  if (domainSelect) {
    domainSelect.value = domain;
  }
  
  // 直接设置当前邮箱，不需要重新生成（避免重复保存到历史）
  currentEmailAddress = email;
  document.getElementById('current-email').textContent = currentEmailAddress;
  document.getElementById('email-result').style.display = 'block';
  document.getElementById('email-inbox').style.display = 'none';
  
  showNotify('已加载邮箱：' + email, 'success');
}

// 清空历史
function clearEmailHistory() {
  // console.log('[clearEmailHistory] 函数被调用');
  showConfirm('确定要清空所有历史邮箱吗？', () => {
    // console.log('[清空历史] 回调函数开始执行');
    // console.log('[清空历史] 开始清空，当前历史:', localStorage.getItem(EMAIL_HISTORY_KEY));
    localStorage.removeItem(EMAIL_HISTORY_KEY);
    // console.log('[清空历史] 清空后:', localStorage.getItem(EMAIL_HISTORY_KEY));
    
    // 强制刷新历史显示
    const historyList = document.getElementById('email-history-list');
    if (historyList) {
      // console.log('[清空历史] 更新界面显示');
      historyList.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 20px 0; color: var(--text-muted); font-size: 13px;">
          暂无历史记录，生成邮箱后会自动显示在这里
        </div>
      `;
    }
    
    showNotify('历史记录已清空', 'success');
    // console.log('[清空历史] 完成');
  });
  // console.log('[clearEmailHistory] showConfirm 已调用');
}

// 保存到历史
function saveToHistory(email) {
  try {
    // console.log('[保存历史] 保存邮箱:', email);
    let history = JSON.parse(localStorage.getItem(EMAIL_HISTORY_KEY) || '[]');
    
    // 移除重复项
    history = history.filter(item => item.email !== email);
    
    // 添加新项到开头
    history.unshift({
      email: email,
      timestamp: Date.now()
    });
    
    // 最多保留10个
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(history));
    // console.log('[保存历史] 已保存，当前数量:', history.length);
    loadEmailHistory();
  } catch (e) {
    // console.error('Save to history error:', e);
  }
}

// 获取相对时间
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return '1天前';
}

// 随机生成邮箱前缀
function generateRandomEmail() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 8 + Math.floor(Math.random() * 5); // 8-12位
  let randomName = '';
  
  // 第一个字符必须是字母
  randomName += chars.charAt(Math.floor(Math.random() * 26));
  
  // 其余字符可以是字母或数字
  for (let i = 1; i < length; i++) {
    randomName += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  document.getElementById('email-name').value = randomName;
  
  // 随机选择一个域名（所有域名已配置完成）
  const domains = [
    'logincursor.xyz', 
    'email.logincursor.xyz',
    'vip.logincursor.xyz',
    'qxfy.store',
    'email.qxfy.store',
    'kami666.xyz',
    'email.kami666.xyz',
    'login.kami666.xyz',
    'deploytools.site'
  ];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  document.getElementById('email-domain').value = randomDomain;
  
  showNotify('已生成随机邮箱前缀', 'success');
}

// 生成邮箱
function generateEmail() {
  const emailName = document.getElementById('email-name').value.trim();
  const emailDomain = document.getElementById('email-domain').value;
  
  if (!emailName) {
    showNotify('请输入邮箱前缀或点击随机生成', 'warning');
    return;
  }
  
  if (!/^[a-zA-Z0-9._-]+$/.test(emailName)) {
    showNotify('邮箱前缀只能包含字母、数字、点、下划线和连字符', 'error');
    return;
  }
  
  currentEmailAddress = `${emailName}@${emailDomain}`;
  document.getElementById('current-email').textContent = currentEmailAddress;
  document.getElementById('email-result').style.display = 'block';
  document.getElementById('email-inbox').style.display = 'none';
  
  // 保存到历史
  saveToHistory(currentEmailAddress);
  
  showNotify('邮箱地址已生成', 'success');
}

// 复制当前邮箱
function copyCurrentEmail() {
  const email = document.getElementById('current-email').textContent;
  const textarea = document.createElement('textarea');
  textarea.value = email;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showNotify('邮箱地址已复制到剪贴板', 'success');
}

// 查看收件箱
async function checkEmails(silent = false) {
  if (!currentEmailAddress) {
    showNotify('请先生成邮箱地址', 'warning');
    return;
  }
  
  // 显示收件箱区域
  const inboxEl = document.getElementById('email-inbox');
  inboxEl.style.display = 'block';
  
  // 非静默模式显示加载状态
  if (!silent) {
    document.getElementById('email-list').innerHTML = '<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">加载中...</div>';
  }
  
  try {
    // 根据邮箱域名选择对应的 API 端点
    const domain = currentEmailAddress.split('@')[1];
    const apiUrl = `https://${domain}/api/emails/${encodeURIComponent(currentEmailAddress)}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error('获取邮件失败');
    }
    
    const data = await response.json();
    displayEmails(data.emails || [], silent);
    
    // 启动自动刷新（如果还没启动）
    startAutoRefresh();
    
  } catch (err) {
    // console.error('Check emails error:', err);
    if (!silent) {
      document.getElementById('email-list').innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: #dc3545;">
          加载失败：${err.message}
        </div>
      `;
    }
  }
}

// 启动自动刷新
function startAutoRefresh() {
  // 清除旧的定时器
  stopAutoRefresh();
  
  // 每10秒刷新一次
  emailRefreshTimer = setInterval(() => {
    if (currentEmailAddress && document.getElementById('email-inbox').style.display === 'block') {
      checkEmails(true); // 静默刷新
      updateRefreshIndicator();
    } else {
      // 如果收件箱不可见，停止刷新
      stopAutoRefresh();
    }
  }, 10000);
  
  // console.log('Auto refresh started');
}

// 停止自动刷新
function stopAutoRefresh() {
  if (emailRefreshTimer) {
    clearInterval(emailRefreshTimer);
    emailRefreshTimer = null;
    // console.log('Auto refresh stopped');
  }
}

// 更新刷新指示器
function updateRefreshIndicator() {
  const indicator = document.querySelector('.refresh-indicator');
  if (indicator) {
    indicator.style.animation = 'none';
    setTimeout(() => {
      indicator.style.animation = 'spin 1s ease-in-out';
    }, 10);
  }
}

// 刷新邮件列表
function refreshEmails() {
  checkEmails(false); // 手动刷新，显示加载状态
}

// 显示邮件列表
function displayEmails(emails, silent = false) {
  const container = document.getElementById('email-list');
  
  if (!emails || emails.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
        <p>暂无邮件</p>
        <p style="font-size: 12px; margin-top: 8px;">新邮件会自动刷新（每10秒）</p>
      </div>
    `;
    return;
  }
  
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  
  emails.forEach((email, index) => {
    html += `
      <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; cursor: pointer;" onclick="showEmailDetail(${index})">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: bold; color: var(--text); margin-bottom: 4px;">
              ${escapeHtml(email.subject || '(无主题)')}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              来自: ${escapeHtml(email.from || '未知')}
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-left: 12px;">
            ${formatEmailTime(email.date)}
          </div>
        </div>
        <div style="font-size: 13px; color: var(--text); line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
          ${escapeHtml(email.text || email.html || '(无内容)')}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
  window.currentEmails = emails;
}

// 显示邮件详情
function showEmailDetail(index) {
  if (!window.currentEmails || !window.currentEmails[index]) return;
  
  const email = window.currentEmails[index];
  const modal = document.getElementById('notify-modal');
  const content = modal.querySelector('.modal-content');
  
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // 提取邮件内容（优先使用 text，如果没有则尝试从 raw 中提取）
  let emailContent = email.text || email.html || '';
  
  // 如果没有内容，尝试从 raw 中提取
  if (!emailContent && email.raw) {
    emailContent = extractContentFromRaw(email.raw);
  }
  
  // 识别验证码
  const verificationCode = extractVerificationCode(emailContent);
  
  // 构建验证码按钮HTML
  let codeButtonHtml = '';
  if (verificationCode) {
    codeButtonHtml = `
      <div style="margin-bottom: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid #3b82f6;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">验证码</div>
            <div style="font-size: 24px; font-weight: bold; color: #3b82f6; font-family: monospace; letter-spacing: 2px;">${verificationCode}</div>
          </div>
          <button class="btn primary" onclick="copyVerificationCode('${verificationCode}')" style="white-space: nowrap;">
            复制验证码
          </button>
        </div>
      </div>
    `;
  }
  
  // 增大模态框样式
  content.style.maxWidth = '800px';
  content.style.width = '90vw';
  content.style.maxHeight = '90vh';
  
  content.innerHTML = `
    <button class="modal-close" onclick="closeNotifyModal()" aria-label="关闭">×</button>
    <div style="padding: 24px; height: 100%; display: flex; flex-direction: column;">
      <h3 style="font-size: 18px; margin-bottom: 16px; color: var(--text);">${escapeHtml(email.subject || '(无主题)')}</h3>
      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
          <strong>发件人:</strong> ${escapeHtml(email.from || '未知')}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
          <strong>收件人:</strong> ${escapeHtml(email.to || currentEmailAddress)}
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          <strong>时间:</strong> ${formatEmailTime(email.date)}
        </div>
      </div>
      ${codeButtonHtml}
      <div style="flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.8; color: var(--text); padding: 16px; background: rgba(0,0,0,0.2); border-radius: 6px;">
        ${email.html ? email.html : `<pre style="white-space: pre-wrap; word-break: break-word; margin: 0; font-family: inherit;">${escapeHtml(emailContent || '(无内容)')}</pre>`}
      </div>
      <div style="margin-top: 16px; text-align: center;">
        <button class="btn primary" onclick="closeEmailDetail()">关闭</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

// 从 raw 邮件中提取内容
function extractContentFromRaw(raw) {
  if (!raw) return '';
  
  try {
    // 尝试提取 plain text 部分
    const lines = raw.split('\n');
    let inBody = false;
    let inBase64 = false;
    let content = [];
    let base64Content = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测 Content-Transfer-Encoding: base64
      if (line.match(/Content-Transfer-Encoding:\s*base64/i)) {
        inBase64 = true;
        continue;
      }
      
      // 检测邮件正文开始（Content-Type 后的空行）
      if (!inBody && line === '' && i > 0) {
        const prevLine = lines[i-1] || '';
        if (prevLine.match(/Content-Type:/i) || inBase64) {
          inBody = true;
          continue;
        }
      }
      
      if (inBody) {
        // MIME 边界结束
        if (line.startsWith('--')) {
          inBody = false;
          inBase64 = false;
          
          // 如果收集到 base64 内容，尝试解码
          if (base64Content.length > 0) {
            try {
              const decoded = atob(base64Content.join(''));
              content.push(decoded);
            } catch (e) {
              // 解码失败，使用原始内容
              content.push(base64Content.join('\n'));
            }
            base64Content = [];
          }
          continue;
        }
        
        // 跳过 Content- 开头的行
        if (line.match(/^Content-/i)) continue;
        
        // 如果是 base64 编码
        if (inBase64) {
          // 检查是否是 base64 字符串
          if (line.match(/^[A-Za-z0-9+/=]+$/)) {
            base64Content.push(line);
          }
        } else {
          content.push(line);
        }
      }
    }
    
    // 处理剩余的 base64 内容
    if (base64Content.length > 0) {
      try {
        const decoded = atob(base64Content.join(''));
        content.push(decoded);
      } catch (e) {
        content.push(base64Content.join('\n'));
      }
    }
    
    let result = content.join('\n').trim();
    
    // 如果仍然没有内容，返回原始内容的一部分
    if (!result) {
      result = raw.substring(0, 5000);
    }
    
    return result;
  } catch (e) {
    // console.error('Extract content error:', e);
    return raw.substring(0, 5000);
  }
}

// 提取验证码
function extractVerificationCode(text) {
  if (!text) return null;
  
  // 常见验证码模式
  const patterns = [
    /验证码[：:]\s*([A-Z0-9]{4,8})/i,
    /verification code[：:]\s*([A-Z0-9]{4,8})/i,
    /code[：:]\s*([A-Z0-9]{4,8})/i,
    /(\d{4,8})\s*是.*验证码/i,
    /your code is[：:]\s*([A-Z0-9]{4,8})/i,
    /(\d{6})/,  // 6位数字验证码（最后尝试）
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

// 复制验证码
function copyVerificationCode(code) {
  const textarea = document.createElement('textarea');
  textarea.value = code;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showNotify('验证码已复制：' + code, 'success');
}

// 关闭邮件详情
function closeEmailDetail() {
  closeNotifyModal();
  const modal = document.getElementById('notify-modal');
  const content = modal.querySelector('.modal-content');
  
  // 恢复默认大小
  content.style.maxWidth = '';
  content.style.width = '';
  content.style.maxHeight = '';
  
  content.innerHTML = `
    <button class="modal-close" onclick="closeNotifyModal()" aria-label="关闭">×</button>
    <div style="text-align: center; padding: 8px 0;">
      <div id="notify-icon" style="font-size: 48px; margin-bottom: 16px;">ℹ️</div>
      <div id="notify-message" style="font-size: 16px; color: var(--text); line-height: 1.5;"></div>
      <div style="margin-top: 24px;">
        <button class="btn primary" onclick="closeNotifyModal()">确定</button>
      </div>
    </div>
  `;
  
  // 重启自动刷新（关闭详情后继续刷新列表）
  if (currentEmailAddress && document.getElementById('email-inbox').style.display === 'block') {
    startAutoRefresh();
  }
}

// 格式化邮件时间
function formatEmailTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/* ============================================
 * 短信接码功能
 * ============================================ */
let currentSmsPhone = '';
let currentSmsProject = '';
let smsCheckTimer = null;
const SMS_HISTORY_KEY = 'temp_sms_history';

// 页面加载时获取项目列表
document.addEventListener('DOMContentLoaded', async () => {
  await loadSmsProjects();
});

// 监听路由变化，加载SMS历史
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#/sms') {
    setTimeout(() => {
      loadSmsProjects();
      loadSmsHistory();
    }, 100);
  }
});

// 加载项目列表
async function loadSmsProjects() {
  // 只支持Cursor项目，直接设置默认值
  const select = document.getElementById('sms-project');
  if (select) {
    select.innerHTML = '<option value="cursor" selected>Cursor</option>';
    select.value = 'cursor';
  }
}

// 获取手机号
async function getPhoneNumber() {
  const token = localStorage.getItem('mirror_token');
  if (!token) {
    showNotify('请先登录', 'warning');
    setTimeout(() => {
      window.location.href = '/user/';
    }, 1500);
    return;
  }
  
  const projectId = document.getElementById('sms-project').value;
  if (!projectId) {
    showNotify('请先选择项目类型', 'warning');
    return;
  }
  
  // 获取指定号码
  const specifiedPhone = document.getElementById('sms-specified-phone').value.trim();
  if (specifiedPhone && (specifiedPhone.length !== 11 || !/^[0-9]{11}$/.test(specifiedPhone))) {
    showNotify('请输入正确的11位手机号', 'warning');
    return;
  }
  
  const isp = document.getElementById('sms-isp').value;
  const type = document.getElementById('sms-type').value;
  
  try {
    const params = new URLSearchParams({ sid: projectId });
    if (specifiedPhone) {
      params.append('phone', specifiedPhone);
    }
    if (isp) params.append('isp', isp);
    if (type) params.append('ascription', type);
    
    const response = await fetch('/api/sms/get-phone?' + params, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const result = await response.json();
    
    if (result.success && result.data && result.data.phone) {
      currentSmsPhone = result.data.phone;
      currentSmsProject = projectId;
      
      document.getElementById('sms-phone-number').textContent = currentSmsPhone;
      document.getElementById('sms-phone-result').style.display = 'block';
      document.getElementById('sms-code-result').style.display = 'none';
      
      // 清空指定号码输入框
      document.getElementById('sms-specified-phone').value = '';
      
      // 保存到历史
      saveSmsToHistory(currentSmsPhone, projectId);
      
      // 更新使用情况显示
      if (result.usage) {
        updateSmsUsageDisplay(result.usage);
      }
      
      showNotify('手机号获取成功', 'success');
    } else {
      showNotify(result.message || '获取手机号失败', 'error');
      
      // 如果是次数用完，更新显示
      if (result.usage) {
        updateSmsUsageDisplay(result.usage);
      }
    }
  } catch (error) {
    // console.error('获取手机号失败:', error);
    showNotify('网络错误，请稍后重试', 'error');
  }
}

// 复制手机号
function copySmsPhone() {
  if (!currentSmsPhone) return;
  
  navigator.clipboard.writeText(currentSmsPhone).then(() => {
    showNotify('手机号已复制', 'success');
  }).catch(() => {
    // 降级方案
    const input = document.createElement('input');
    input.value = currentSmsPhone;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showNotify('手机号已复制', 'success');
  });
}

// 查看验证码
async function checkSmsCode() {
  if (!currentSmsPhone || !currentSmsProject) {
    showNotify('请先获取手机号', 'warning');
    return;
  }
  
  document.getElementById('sms-code-result').style.display = 'block';
  
  // 立即检查一次
  await refreshSmsCode();
  
  // 启动自动刷新（每5秒）
  if (smsCheckTimer) clearInterval(smsCheckTimer);
  smsCheckTimer = setInterval(refreshSmsCode, 5000);
}

// 刷新验证码
async function refreshSmsCode() {
  if (!currentSmsPhone || !currentSmsProject) return;
  
  try {
    const response = await fetch(`/api/sms/get-message?sid=${currentSmsProject}&phone=${currentSmsPhone}`);
    const result = await response.json();
    
    const contentDiv = document.getElementById('sms-code-content');
    if (!contentDiv) return;
    
    if (result.success && result.data) {
      if (result.data.code === '0' && result.data.yzm) {
        // 收到验证码
        contentDiv.innerHTML = `
          <div style="margin-bottom: 16px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; border-left: 3px solid #22c55e;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">验证码：</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 28px; font-weight: bold; color: #22c55e; font-family: monospace; letter-spacing: 4px;">${escapeHtml(result.data.yzm)}</div>
              <button class="btn ghost" onclick="navigator.clipboard.writeText('${escapeHtml(result.data.yzm)}').then(() => showNotify('验证码已复制', 'success'))">复制</button>
            </div>
          </div>
          <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 4px; font-size: 13px; color: var(--text); line-height: 1.6; word-break: break-all;">
            <strong>完整短信内容：</strong><br/>
            ${escapeHtml(result.data.sms || '暂无')}
          </div>
        `;
        
        // 停止自动刷新
        if (smsCheckTimer) {
          clearInterval(smsCheckTimer);
          smsCheckTimer = null;
        }
        
        showNotify('验证码已收到', 'success');
      } else {
        contentDiv.innerHTML = `
          <div style="text-align: center; padding: 20px 0; color: var(--text-muted);">
            <div style="font-size: 14px; margin-bottom: 8px;">等待接收验证码...</div>
            <div style="font-size: 12px; color: var(--text-muted);">自动刷新中（每5秒）</div>
          </div>
        `;
      }
    } else {
      contentDiv.innerHTML = `
        <div style="text-align: center; padding: 20px 0; color: var(--text-muted);">
          ${escapeHtml(result.message || '获取失败')}
        </div>
      `;
    }
  } catch (error) {
    // console.error('获取验证码失败:', error);
  }
}

// 释放号码
async function releaseSmsPhone() {
  if (!currentSmsPhone || !currentSmsProject) {
    showNotify('没有可释放的号码', 'warning');
    return;
  }
  
  try {
    const response = await fetch('/api/sms/release-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sid: currentSmsProject,
        phone: currentSmsPhone
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 停止自动刷新
      if (smsCheckTimer) {
        clearInterval(smsCheckTimer);
        smsCheckTimer = null;
      }
      
      // 清空当前状态
      currentSmsPhone = '';
      currentSmsProject = '';
      document.getElementById('sms-phone-result').style.display = 'none';
      document.getElementById('sms-code-result').style.display = 'none';
      
      showNotify('号码已释放', 'success');
    } else {
      showNotify(result.message || '释放失败', 'error');
    }
  } catch (error) {
    // console.error('释放号码失败:', error);
    showNotify('网络错误，请稍后重试', 'error');
  }
}

// 释放全部号码
async function releaseAllPhones() {
  try {
    // 确认操作
    const confirmed = await new Promise((resolve) => {
      showConfirm(
        '确定要释放全部号码吗？这将释放您账号下所有未释放的号码。',
        () => resolve(true),
        () => resolve(false)
      );
    });
    
    if (!confirmed) {
      return;
    }
    
    showNotify('正在释放全部号码...', 'info');
    
    const response = await fetch('/api/sms/release-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 停止自动刷新
      if (smsCheckTimer) {
        clearInterval(smsCheckTimer);
        smsCheckTimer = null;
      }
      
      // 清空当前状态
      currentSmsPhone = '';
      currentSmsProject = '';
      document.getElementById('sms-phone-result').style.display = 'none';
      document.getElementById('sms-code-result').style.display = 'none';
      
      showNotify('已释放全部号码，现在可以重新获取', 'success');
    } else {
      showNotify(result.message || '释放全部失败', 'error');
    }
  } catch (error) {
    // console.error('释放全部失败:', error);
    showNotify('网络错误，请稍后重试', 'error');
  }
}

// 保存到历史
function saveSmsToHistory(phone, projectId) {
  try {
    let history = JSON.parse(localStorage.getItem(SMS_HISTORY_KEY) || '[]');
    
    // 移除相同的号码
    history = history.filter(item => item.phone !== phone);
    
    // 添加到开头
    history.unshift({
      phone: phone,
      projectId: projectId,
      timestamp: Date.now()
    });
    
    // 保留最近10条
    history = history.slice(0, 10);
    
    localStorage.setItem(SMS_HISTORY_KEY, JSON.stringify(history));
    loadSmsHistory();
  } catch (error) {
    // console.error('保存历史失败:', error);
  }
}

// 加载历史
function loadSmsHistory() {
  try {
    const historyList = document.getElementById('sms-history-list');
    if (!historyList) return;
    
    const history = JSON.parse(localStorage.getItem(SMS_HISTORY_KEY) || '[]');
    
    if (history.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; width: 100%; padding: 20px 0; color: var(--text-muted); font-size: 13px;">
          暂无历史记录
        </div>
      `;
      return;
    }
    
    historyList.innerHTML = history.map(item => `
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 6px; cursor: pointer; transition: all 0.2s;" 
           onclick="navigator.clipboard.writeText('${item.phone}').then(() => showNotify('号码已复制', 'success'))"
           onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 2px 8px rgba(34, 197, 94, 0.2)';"
           onmouseout="this.style.transform=''; this.style.boxShadow='';"
           title="点击复制">
        <span style="font-size: 14px; font-weight: 500; color: #22c55e; font-family: monospace;">${item.phone}</span>
        <span style="font-size: 11px; color: var(--text-muted);">${formatRelativeTime(item.timestamp)}</span>
      </div>
    `).join('');
  } catch (error) {
    // console.error('加载历史失败:', error);
  }
}

// 清空历史
function clearSmsHistory() {
  showConfirm('确定要清空所有历史号码吗？', () => {
    localStorage.removeItem(SMS_HISTORY_KEY);
    loadSmsHistory();
    showNotify('历史已清空', 'success');
  });
}

// 格式化相对时间
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// ============ SMS 使用次数管理 ============

// 加载SMS使用情况
async function loadSmsUsage() {
  const token = localStorage.getItem('mirror_token');
  if (!token) {
    // 未登录，显示提示
    document.getElementById('sms-usage-info').style.display = 'none';
    document.getElementById('sms-limit-warning').style.display = 'none';
    return;
  }
  
  try {
    const response = await fetch('/api/sms/usage', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      updateSmsUsageDisplay(result.data);
    }
  } catch (error) {
    // console.error('加载SMS使用情况失败:', error);
  }
}

// 更新SMS使用情况显示
function updateSmsUsageDisplay(usage) {
  const { used, limit, remaining } = usage;
  
  document.getElementById('sms-remaining-count').textContent = remaining;
  document.getElementById('sms-total-count').textContent = limit;
  
  const usageInfo = document.getElementById('sms-usage-info');
  const limitWarning = document.getElementById('sms-limit-warning');
  
  if (remaining > 0) {
    usageInfo.style.display = 'block';
    limitWarning.style.display = 'none';
  } else {
    usageInfo.style.display = 'none';
    limitWarning.style.display = 'block';
  }
}

/* ============================================
 * YLJD Cursor 一键切换账号功能
 * ============================================ */
let cursorAccountData = null;

// 创建 Cursor 账号
async function createCursorAccount() {
  const btn = document.getElementById('cursor-create-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '创建中...';
  }
  
  try {
    showLoading('正在创建 Cursor 账号...');
    
    const response = await fetch('/api/cursor/create-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      cursorAccountData = result.data;
      
      // 显示账号信息
      document.getElementById('cursor-email').textContent = result.data.email;
      document.getElementById('cursor-firstname').textContent = result.data.firstName;
      document.getElementById('cursor-lastname').textContent = result.data.lastName;
      document.getElementById('cursor-password').textContent = result.data.password;
      document.getElementById('cursor-token').textContent = result.data.token || '等待登录...';
      const accountResult = document.getElementById('cursor-account-result');
      const downloadBtn = document.getElementById('cursor-download-btn');
      const autoFillStatus = document.getElementById('cursor-auto-fill-status');
      
      if (accountResult) accountResult.style.display = 'block';
      if (downloadBtn) downloadBtn.style.display = 'inline-block';
      if (autoFillStatus) autoFillStatus.style.display = 'block';
      
      showNotify('账号信息已生成！正在打开注册页面...', 'success');
      
      // 打开 Cursor 注册页面并自动填写
      await openCursorRegisterPage(result.data);
      
      // 如果还没有 token，等待登录
      if (!result.data.token) {
        await waitForCursorLogin(result.data.email);
      }
    } else {
      showNotify(result.message || '创建账号失败', 'error');
    }
  } catch (error) {
    console.error('创建 Cursor 账号失败:', error);
    showNotify('网络错误，请稍后重试', 'error');
  } finally {
    hideLoading();
    if (btn) {
      btn.disabled = false;
      btn.textContent = '一键创建账号';
    }
  }
}

// 等待 Cursor 登录完成
async function waitForCursorLogin(email) {
  let attempts = 0;
  const maxAttempts = 30; // 最多等待30次（约5分钟）
  
  const checkLogin = async () => {
    attempts++;
    
    try {
      const response = await fetch(`/api/cursor/check-login?email=${encodeURIComponent(email)}`, {
        method: 'GET'
      });
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.token) {
        cursorAccountData.token = result.data.token;
        document.getElementById('cursor-token').textContent = result.data.token;
        showNotify('登录成功！已获取访问凭证', 'success');
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkLogin, 10000); // 每10秒检查一次
      } else {
        showNotify('登录超时，请手动登录', 'warning');
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      if (attempts < maxAttempts) {
        setTimeout(checkLogin, 10000);
      }
    }
  };
  
  setTimeout(checkLogin, 10000); // 10秒后开始检查
}

// 打开 Cursor 注册页面并自动填写
async function openCursorRegisterPage(accountData) {
  try {
    // Cursor 注册页面 URL
    const registerUrl = 'https://authenticator.cursor.sh/sign-up';
    
    // 更新状态
    const statusText = document.getElementById('cursor-fill-status-text');
    if (statusText) {
      statusText.textContent = '正在打开注册页面...';
    }
    
    // 打开新窗口
    const registerWindow = window.open(registerUrl, '_blank', 'width=1000,height=700');
    
    if (!registerWindow) {
      showNotify('无法打开注册页面，请检查浏览器弹窗设置', 'warning');
      return;
    }
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 尝试自动填写表单
    try {
      // 方法1: 通过 postMessage 发送（需要浏览器扩展支持）
      registerWindow.postMessage({
        type: 'CURSOR_AUTO_FILL',
        data: {
          email: accountData.email,
          firstName: accountData.firstName,
          lastName: accountData.lastName,
          password: accountData.password
        }
      }, '*');
      
      // 方法2: 直接操作（如果同源或已注入脚本）
      setTimeout(() => {
        try {
          // 尝试直接操作新窗口的 DOM（需要绕过跨域限制）
          // 这里我们使用 postMessage，实际填写由浏览器扩展完成
          if (statusText) {
            statusText.textContent = '已发送填写指令，等待浏览器扩展自动填写...';
          }
        } catch (error) {
          console.warn('直接填写失败，使用辅助窗口:', error);
        }
      }, 2000);
      
      // 打开辅助窗口显示账号信息（备用方案）
      setTimeout(() => {
        const helperWindow = window.open('', '_blank', 'width=500,height=600');
        if (helperWindow) {
          helperWindow.document.write(`
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cursor 账号信息 - 请复制填写</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
                color: #333;
              }
              .container {
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                max-width: 450px;
                margin: 0 auto;
              }
              h2 {
                color: #667eea;
                margin-bottom: 20px;
                font-size: 20px;
              }
              .info-item {
                margin-bottom: 16px;
              }
              .info-label {
                font-size: 12px;
                color: #666;
                margin-bottom: 4px;
                font-weight: 500;
              }
              .info-value {
                display: flex;
                align-items: center;
                gap: 8px;
                background: #f5f5f5;
                padding: 10px 12px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 14px;
              }
              .copy-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
              }
              .copy-btn:hover {
                background: #5568d3;
              }
              .copy-btn:active {
                background: #4457c2;
              }
              .instructions {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 12px;
                border-radius: 4px;
                margin-top: 20px;
                font-size: 13px;
                line-height: 1.6;
              }
              .instructions ol {
                margin-left: 20px;
                margin-top: 8px;
              }
              .instructions li {
                margin-bottom: 4px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>📋 Cursor 账号信息</h2>
              
              <div class="info-item">
                <div class="info-label">名（First Name）</div>
                <div class="info-value">
                  <span id="first-name">${accountData.firstName}</span>
                  <button class="copy-btn" onclick="copyText('${accountData.firstName}')">复制</button>
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">姓（Last Name）</div>
                <div class="info-value">
                  <span id="last-name">${accountData.lastName}</span>
                  <button class="copy-btn" onclick="copyText('${accountData.lastName}')">复制</button>
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">邮箱（Email）</div>
                <div class="info-value">
                  <span id="email">${accountData.email}</span>
                  <button class="copy-btn" onclick="copyText('${accountData.email}')">复制</button>
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">密码（Password）</div>
                <div class="info-value">
                  <span id="password">${accountData.password}</span>
                  <button class="copy-btn" onclick="copyText('${accountData.password}')">复制</button>
                </div>
              </div>
              
              <div class="instructions">
                <strong>📝 使用说明：</strong>
                <ol>
                  <li>在 Cursor 注册页面依次填写：名、姓、邮箱</li>
                  <li>点击"继续"按钮</li>
                  <li>等待接收验证码邮件</li>
                  <li>验证码会自动检测并显示在这里</li>
                </ol>
              </div>
              
              <div id="verification-code" style="display: none; margin-top: 20px; padding: 12px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">验证码：</div>
                <div style="font-size: 24px; font-weight: bold; color: #28a745; font-family: monospace; text-align: center;" id="code-value"></div>
                <button class="copy-btn" onclick="copyCode()" style="width: 100%; margin-top: 8px;">复制验证码</button>
              </div>
            </div>
            
            <script>
              function copyText(text) {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                
                // 显示复制成功提示
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = '已复制！';
                btn.style.background = '#28a745';
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.style.background = '#667eea';
                }, 1000);
              }
              
              function copyCode() {
                const code = document.getElementById('code-value').textContent;
                copyText(code);
              }
              
              // 监听来自父窗口的验证码消息
              window.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'CURSOR_VERIFICATION_CODE') {
                  const code = event.data.code;
                  document.getElementById('code-value').textContent = code;
                  document.getElementById('verification-code').style.display = 'block';
                  
                  // 自动复制验证码
                  setTimeout(() => {
                    copyText(code);
                  }, 500);
                }
              });
            </script>
          </body>
          </html>
        `);
        helperWindow.document.close();
      }
      
      // 开始监听验证码
      startCursorVerificationCodeListener(accountData.email, helperWindow);
    }, 2000);
    
  } catch (error) {
    console.error('打开注册页面失败:', error);
    showNotify('打开注册页面失败', 'error');
  }
}

// 监听验证码并自动填写
async function startCursorVerificationCodeListener(email, registerWindow) {
  let attempts = 0;
  const maxAttempts = 60; // 最多等待10分钟（每10秒检查一次）
  
  const checkVerificationCode = async () => {
    attempts++;
    
    try {
      // 从临时邮箱服务获取邮件
      const emailDomain = email.split('@')[1];
      const emailApiUrl = `https://${emailDomain}/api/emails/${encodeURIComponent(email)}`;
      
      const response = await fetch(emailApiUrl);
      const result = await response.json();
      
      if (result.emails && result.emails.length > 0) {
        // 查找验证码邮件
        for (const mail of result.emails) {
          const subject = mail.subject || '';
          const text = mail.text || '';
          const html = mail.html || '';
          
          // 提取验证码（6位数字）
          const codeMatch = (text + html).match(/\b\d{6}\b/);
          if (codeMatch) {
            const code = codeMatch[0];
            
            // 更新状态
            const statusTextEl = document.getElementById('cursor-fill-status-text');
            if (statusTextEl) {
              statusTextEl.textContent = `验证码已收到: ${code}，正在自动填写...`;
            }
            
            // 发送验证码到辅助窗口
            try {
              if (registerWindow && !registerWindow.closed) {
                registerWindow.postMessage({
                  type: 'CURSOR_VERIFICATION_CODE',
                  code: code
                }, '*');
              }
              
              showNotify(`验证码已收到: ${code}，请查看辅助窗口`, 'success');
              
              // 更新状态
              if (statusTextEl) {
                statusTextEl.textContent = `验证码已收到: ${code}，请查看辅助窗口复制`;
              }
              
              return; // 找到验证码，停止检查
            } catch (error) {
              console.error('发送验证码失败:', error);
            }
          }
        }
      }
      
      // 继续检查
      if (attempts < maxAttempts) {
        setTimeout(checkVerificationCode, 10000); // 每10秒检查一次
      } else {
        const statusTextEl3 = document.getElementById('cursor-fill-status-text');
        if (statusTextEl3) {
          statusTextEl3.textContent = '等待验证码超时，请手动查看邮箱';
        }
        showNotify('等待验证码超时，请手动查看邮箱', 'warning');
      }
    } catch (error) {
      console.error('检查验证码失败:', error);
      if (attempts < maxAttempts) {
        setTimeout(checkVerificationCode, 10000);
      }
    }
  };
  
  // 5秒后开始检查
  setTimeout(checkVerificationCode, 5000);
}

// 复制密码
function copyCursorPassword() {
  if (!cursorAccountData || !cursorAccountData.password) {
    showNotify('没有可复制的密码', 'warning');
    return;
  }
  
  const textarea = document.createElement('textarea');
  textarea.value = cursorAccountData.password;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showNotify('密码已复制', 'success');
}

// 下载配置文件
async function downloadCursorConfig() {
  if (!cursorAccountData) {
    showNotify('请先创建账号', 'warning');
    return;
  }
  
  try {
    const response = await fetch('/api/cursor/download-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cursorAccountData)
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cursor-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotify('配置文件已下载', 'success');
    } else {
      showNotify('下载失败', 'error');
    }
  } catch (error) {
    console.error('下载配置文件失败:', error);
    showNotify('网络错误，请稍后重试', 'error');
  }
}
