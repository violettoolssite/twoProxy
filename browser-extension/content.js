(() => {
  // === 获取 Release 代理地址，仅用于文件加速下载 ===
  const getReleaseBase = async () => {
    // 只读取 releaseBase，不再受 enableRelease 开关影响，确保开箱即用
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.get({ releaseBase: "https://violetteam.cloud/ghproxy/github" }, (items) => {
          resolve(items.releaseBase || "https://violetteam.cloud/ghproxy/github");
        });
      } else {
        resolve("https://violetteam.cloud/ghproxy/github");
      }
    });
  };

  // === Release 页面添加“加速下载”按钮（GitHub / 镜像站通用）===
  const addReleaseButtons = async () => {
    const isReleasePage = location.pathname.includes("/releases");
    if (!isReleasePage) return;

    const releaseBase = await getReleaseBase();
    if (!releaseBase) return;

    const downloadLinks = document.querySelectorAll('a[href*="/releases/download/"]');
    downloadLinks.forEach((link) => {
      if (link.dataset.accelAdded) return;
      link.dataset.accelAdded = "true";

      const href = link.getAttribute("href");
      if (!href) return;

      let accelUrl;
      if (href.startsWith("https://github.com/")) {
        // 例如：https://github.com/ollama/... → https://violetteam.cloud/ghproxy/github/ollama/...
        accelUrl = releaseBase.replace(/\/+$/, "") + "/" + href.replace("https://github.com/", "");
      } else if (href.startsWith("/")) {
        // 例如：/ollama/... → https://violetteam.cloud/ghproxy/github/ollama/...
        accelUrl = releaseBase.replace(/\/+$/, "") + href;
      } else {
        return;
      }

      const btn = document.createElement("a");
      btn.href = accelUrl;
      btn.textContent = "加速下载";
      btn.style.cssText = `
        display: inline-block;
        margin-left: 8px;
        padding: 4px 12px;
        background: #2563eb;
        color: #fff;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        vertical-align: middle;
        transition: background 0.2s, transform 0.15s;
        border: none;
      `;
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#1d4ed8";
        btn.style.transform = "translateY(-1px)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "#2563eb";
        btn.style.transform = "translateY(0)";
      });

      link.parentNode.insertBefore(btn, link.nextSibling);
    });
  };

  // === 扫描并处理 ===
  const scan = () => {
    addReleaseButtons();
  };

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === "A" && node.href?.includes("/releases/download/")) {
            addReleaseButtons();
          }
          if (node.querySelectorAll?.('a[href*="/releases/download/"]').length) {
            addReleaseButtons();
          }
        }
      });
    }
  });

  document.addEventListener("DOMContentLoaded", scan);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    scan();
  }
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
