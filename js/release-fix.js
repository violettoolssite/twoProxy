(function () {
  function fixReleaseLinks() {
    document.querySelectorAll('a[href^="https://release-assets.githubusercontent.com/"]').forEach(a => {
      try {
        const u = new URL(a.href);
        a.href = 'https://mirror.yljdteam.com/release' + u.pathname;
        a.setAttribute('data-mirror', 'release');
      } catch (e) {}
    });
  }

  // 页面初始执行
  fixReleaseLinks();

  // 监听 GitHub PJAX / Turbo 页面切换
  document.addEventListener('pjax:end', fixReleaseLinks);
  document.addEventListener('turbo:load', fixReleaseLinks);

  // 防止动态加载漏网
  const observer = new MutationObserver(fixReleaseLinks);
  observer.observe(document.body, { childList: true, subtree: true });
})();
