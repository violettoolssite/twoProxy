/**
 * Popup 脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const activateBtn = document.getElementById('activate-btn');
  
  // 检查当前标签页是否是 Cursor 注册页面
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('authenticator.cursor.sh')) {
      statusEl.textContent = '✅ 已检测到 Cursor 注册页面';
      statusEl.classList.add('active');
      activateBtn.disabled = false;
      activateBtn.textContent = '等待账号信息...';
      
      // 监听来自 Mirror 网站的消息
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CURSOR_ACCOUNT_DATA') {
          // 发送账号信息到当前标签页
          chrome.tabs.sendMessage(currentTab.id, {
            type: 'CURSOR_AUTO_FILL',
            data: message.data
          });
          
          statusEl.textContent = '✅ 账号信息已发送，正在自动填写...';
          activateBtn.textContent = '已激活';
        }
      });
    } else {
      statusEl.textContent = '⚠️ 请先打开 Cursor 注册页面';
      activateBtn.textContent = '打开注册页面';
      activateBtn.onclick = () => {
        chrome.tabs.create({ url: 'https://authenticator.cursor.sh/sign-up' });
      };
    }
  });
});
