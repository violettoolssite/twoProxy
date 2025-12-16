(function () {
  const MIRROR = "https://mirror.yljdteam.com/https://github.com/";

  function rewriteClone() {
    // 找所有可能的 clone 输入框
    document.querySelectorAll('input[value^="https://github.com/"]').forEach(input => {
      const v = input.value;
      if (!v.startsWith(MIRROR)) {
        input.value = MIRROR + v.replace("https://github.com/", "");
      }
    });

    // 劫持复制按钮
    document.querySelectorAll('clipboard-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('value');
        if (text && text.startsWith("https://github.com/")) {
          btn.setAttribute(
            'value',
            MIRROR + text.replace("https://github.com/", "")
          );
        }
      }, { once: true });
    });
  }

  // 初次执行
  rewriteClone();

  // 监听 DOM 变化（GitHub 是 SPA）
  const obs = new MutationObserver(rewriteClone);
  obs.observe(document.body, { childList: true, subtree: true });
})();
