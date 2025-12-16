const pages = ["github", "docker", "download"];

function showPage(name) {
  pages.forEach(p => {
    document.getElementById("page-" + p).style.display = "none";
    document.getElementById("nav-" + p).classList.remove("active");
  });
  document.getElementById("page-" + name).style.display = "block";
  document.getElementById("nav-" + name).classList.add("active");
}

function router() {
  const hash = location.hash.replace("#/", "") || "github";
  showPage(hash);
}
window.addEventListener("hashchange", router);
router();

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
      const cloneUrl = `https://mirror.yljdteam.com/github/${r.full_name}.git`;
    div.innerHTML = `
        <a href="/github/${r.full_name}" target="_blank" rel="noopener">${r.full_name}</a>
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
    navigator.clipboard.writeText(text).catch(() => alert("复制失败，请手动复制"));
  } catch (e) {
    alert("复制失败，请手动复制");
  }
}

/* 构造加速链接（统一处理 GitHub / 其他域名） */
function buildAcceleratedUrl(u) {
  let host = u.host;
  let pathname = u.pathname;

  // 如果是本站中转出来的链接，解析出真实的目标 host/path
  if (host === "mirror.yljdteam.com") {
    // 1) /github/<owner>/<repo>/...
    if (pathname.startsWith("/github/")) {
      pathname = pathname.replace(/^\/github\//, "/");
      host = "github.com";
    }
    // 2) /file/https/github.com/...
    else if (pathname.startsWith("/file/https/")) {
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
    // 约定后端以 /github/<owner>/<repo>/... 形式转发到 https://github.com/...
    return "https://violetteam.cloud:9090/github" + pathname + (u.search || "");
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
    // 存一份纯链接，用于“直接下载”按钮
    resultInput.dataset.url = accel;
  } catch (e) {
    alert("请输入合法的下载链接或命令");
  }
}
