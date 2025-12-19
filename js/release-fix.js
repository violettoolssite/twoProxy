(function () {
  // 全局 fetch 拦截：把 github.com 的 expanded_assets 请求改到当前镜像域名，彻底避免 CORS
  try {
    if (!window._mirrorFetchPatched) {
      window._mirrorFetchPatched = true;
      const originalFetch = window.fetch;
      if (typeof originalFetch === 'function') {
        window.fetch = function (input, init) {
          try {
            let urlStr = null;
            if (typeof input === 'string') {
              urlStr = input;
            } else if (input instanceof Request) {
              urlStr = input.url;
            } else if (input && typeof input === 'object' && input.url) {
              urlStr = input.url;
            }

            if (urlStr) {
              const u = new URL(urlStr, window.location.href);
              if (u.hostname === 'github.com' && u.pathname.includes('/releases/expanded_assets/')) {
                // 改写为当前镜像域名 + 同路径，走 Nginx 代理，避免跨域
                const mirrorUrl = window.location.origin + u.pathname + u.search + u.hash;
                if (typeof input === 'string') {
                  input = mirrorUrl;
                } else if (input instanceof Request) {
                  input = new Request(mirrorUrl, input);
                } else if (input && typeof input === 'object') {
                  input = Object.assign({}, input, { url: mirrorUrl });
                }
              }
            }
          } catch (e) {}
          return originalFetch.call(this, input, init);
        };
      }
    }
  } catch (e) {}

  function fixReleaseLinks() {
    document.querySelectorAll('a[href^="https://release-assets.githubusercontent.com/"]').forEach(a => {
      try {
        const u = new URL(a.href);
        a.href = 'https://mirror.yljdteam.com/release' + u.pathname;
        a.setAttribute('data-mirror', 'release');
      } catch (e) {}
    });
  }

  // 手动加载 Releases 资产列表，绕过 GitHub 自带的跨域 / CORS 问题
  function fixAssets() {
    try {
      const frag = document.querySelector('include-fragment[src*="/releases/expanded_assets/"]');
      if (!frag) return;
      if (frag.getAttribute('data-mirror-loaded') === '1') return;

      const src = frag.getAttribute('src');
      if (!src) return;

      const u = new URL(src, window.location.origin);
      // 如果目标是 github.com，则改为走当前镜像域名 + 同路径
      let url;
      if (u.hostname === 'github.com') {
        url = window.location.origin + u.pathname + u.search + u.hash;
      } else {
        url = u.toString();
      }

      fetch(url, { credentials: 'include' })
        .then(r => (r.ok ? r.text() : Promise.reject(r.status)))
        .then(html => {
          frag.innerHTML = html;
          frag.removeAttribute('src');
          frag.setAttribute('data-mirror-loaded', '1');
        })
        .catch(() => {});
    } catch (e) {}
  }

  function runAllFixes() {
    fixReleaseLinks();
    fixAssets();
  }

  // 页面初始执行
  runAllFixes();

  // 监听 GitHub PJAX / Turbo 页面切换
  document.addEventListener('pjax:end', runAllFixes);
  document.addEventListener('turbo:load', runAllFixes);

  // 防止动态加载漏网
  const observer = new MutationObserver(runAllFixes);
  observer.observe(document.body, { childList: true, subtree: true });
})();
