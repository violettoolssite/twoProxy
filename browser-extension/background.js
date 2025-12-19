const DEFAULTS = {
  // 仅保留 Release 文件加速相关配置
  // 现在采用 ghproxy 前缀：例如 https://violetteam.cloud/ghproxy/github
  releaseBase: "https://violetteam.cloud/ghproxy/github"
};

function trimSlash(url) {
  return url.replace(/\/+$/, "");
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => resolve(items));
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => resolve());
  });
}

function buildRule({ id, priority, regex, substitution, resourceTypes, domains, initiatorDomains }) {
  const rule = {
    id,
    priority,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: substitution }
    },
    condition: {
      regexFilter: regex,
      resourceTypes
    }
  };
  if (domains) rule.condition.requestDomains = domains;
  if (initiatorDomains) rule.condition.initiatorDomains = initiatorDomains;
  return rule;
}

function getHost(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return "";
  }
}

async function applyRules() {
  const s = await getSettings();
  const releaseBase = trimSlash(s.releaseBase || DEFAULTS.releaseBase);
  const rules = [];
  let ruleId = 1;

  // ====== Release 下载规则（仅保留这一类功能，始终启用）======
  if (releaseBase) {
    rules.push(buildRule({
      id: ruleId++,
      priority: 2,
      regex: "^https://github\\.com/(.*?/releases/download/.*)$",
      // 例如：https://github.com/ollama/... → https://violetteam.cloud/ghproxy/github/ollama/...
      substitution: `${releaseBase}/\\1`,
      resourceTypes: ["main_frame", "sub_frame"],
      domains: ["github.com"]
    }));
  }

  const allIds = rules.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1),
    addRules: rules
  });

  console.log("[YLJD] Applied rules:", allIds);
}

chrome.runtime.onInstalled.addListener(() => {
  applyRules();
});

chrome.runtime.onStartup.addListener(() => {
  applyRules();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "applyRules") {
    applyRules().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
