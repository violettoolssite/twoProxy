const DEFAULTS = {
  // 仅保留 Release 文件加速相关配置，始终启用
  // 默认使用新的 ghproxy 前缀
  releaseBase: "https://violetteam.cloud/ghproxy/github"
};

function qs(id) {
  return document.getElementById(id);
}

function setStatus(msg, ok = true) {
  const el = qs("status");
  el.textContent = msg;
  el.className = ok ? "status ok" : "status err";
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    qs("releaseBase").value = s.releaseBase;
    // 始终启用，无需开关
    qs("enableRelease").checked = true;
  });
}

function saveAndApply() {
  const settings = {
    releaseBase: qs("releaseBase").value.trim() || DEFAULTS.releaseBase
  };

  chrome.storage.sync.set(settings, () => {
    chrome.runtime.sendMessage({ type: "applyRules" }, (resp) => {
      if (resp?.ok) {
        setStatus("已保存并应用重写规则", true);
      } else {
        setStatus("应用规则失败：" + (resp?.error || "未知错误"), false);
      }
    });
  });
}

function resetDefaults() {
  chrome.storage.sync.set(DEFAULTS, () => {
    loadSettings();
    chrome.runtime.sendMessage({ type: "applyRules" }, () => {
      setStatus("已恢复默认并应用", true);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  qs("saveBtn").addEventListener("click", saveAndApply);
  qs("resetBtn").addEventListener("click", resetDefaults);
});

