/**
 * Cursor 自动填写 Content Script
 * 用于在 Cursor 注册页面自动填写表单
 */

(function() {
  'use strict';

  // 监听来自页面的消息
  window.addEventListener('message', function(event) {
    // 只接受来自同源的消息（或者信任的来源）
    if (event.data && event.data.type === 'CURSOR_AUTO_FILL') {
      const data = event.data.data;
      if (data) {
        fillCursorForm(data);
      }
    }
    
    if (event.data && event.data.type === 'CURSOR_FILL_CODE') {
      fillVerificationCode(event.data.code);
    }
  });

  /**
   * 填写 Cursor 注册表单
   */
  function fillCursorForm(data) {
    console.log('[Cursor Auto Fill] 开始填写表单', data);
    
    // 等待页面加载完成
    const fillForm = () => {
      try {
        // 查找表单字段（根据实际页面结构调整）
        // 方法1: 通过 label 查找
        const firstNameInput = findInputByLabel('名') || findInputByLabel('First Name') || findInputByPlaceholder('您的名字') || findInputByPlaceholder('Your first name');
        const lastNameInput = findInputByLabel('姓') || findInputByLabel('Last Name') || findInputByPlaceholder('您的姓氏') || findInputByPlaceholder('Your last name');
        const emailInput = findInputByLabel('邮箱') || findInputByLabel('Email') || findInputByPlaceholder('您的邮箱地址') || findInputByPlaceholder('Your email address') || document.querySelector('input[type="email"]');
        
        if (firstNameInput && data.firstName) {
          setInputValue(firstNameInput, data.firstName);
          triggerInputEvent(firstNameInput);
          console.log('[Cursor Auto Fill] 已填写名:', data.firstName);
        }
        
        if (lastNameInput && data.lastName) {
          setInputValue(lastNameInput, data.lastName);
          triggerInputEvent(lastNameInput);
          console.log('[Cursor Auto Fill] 已填写姓:', data.lastName);
        }
        
        if (emailInput && data.email) {
          setInputValue(emailInput, data.email);
          triggerInputEvent(emailInput);
          console.log('[Cursor Auto Fill] 已填写邮箱:', data.email);
        }
        
        // 显示成功提示
        showNotification('表单已自动填写！请检查信息后点击"继续"按钮');
        
      } catch (error) {
        console.error('[Cursor Auto Fill] 填写失败:', error);
        showNotification('自动填写失败，请手动填写', 'error');
      }
    };
    
    // 如果页面已加载，立即填写；否则等待
    if (document.readyState === 'complete') {
      setTimeout(fillForm, 500);
    } else {
      window.addEventListener('load', () => setTimeout(fillForm, 500));
    }
  }

  /**
   * 填写验证码
   */
  function fillVerificationCode(code) {
    console.log('[Cursor Auto Fill] 填写验证码:', code);
    
    const tryFillCode = () => {
      try {
        // 查找验证码输入框（多种方法）
        let codeInput = findInputByLabel('验证码') || 
                       findInputByLabel('Verification Code') || 
                       findInputByLabel('Code') ||
                       findInputByPlaceholder('验证码') ||
                       findInputByPlaceholder('Verification code') ||
                       findInputByPlaceholder('Code') ||
                       document.querySelector('input[type="text"][maxlength="6"]') ||
                       document.querySelector('input[type="text"][maxlength="8"]') ||
                       document.querySelector('input[pattern*="[0-9]"]') ||
                       document.querySelector('input[name*="code" i]') ||
                       document.querySelector('input[id*="code" i]');
        
        // 如果还没找到，尝试查找所有输入框，选择最可能的
        if (!codeInput) {
          const allInputs = Array.from(document.querySelectorAll('input[type="text"]'));
          // 查找包含数字限制或验证码相关属性的输入框
          codeInput = allInputs.find(input => 
            input.maxLength === 6 || 
            input.maxLength === 8 ||
            input.pattern && input.pattern.includes('[0-9]') ||
            input.name && input.name.toLowerCase().includes('code') ||
            input.id && input.id.toLowerCase().includes('code')
          );
        }
        
        if (codeInput) {
          setInputValue(codeInput, code);
          triggerInputEvent(codeInput);
          console.log('[Cursor Auto Fill] 验证码已填写:', code);
          showNotification(`✅ 验证码已自动填写: ${code}`);
        } else {
          console.warn('[Cursor Auto Fill] 未找到验证码输入框，等待页面加载...');
          // 如果没找到，等待一下再试（可能是验证码页面还没加载）
          setTimeout(tryFillCode, 2000);
        }
      } catch (error) {
        console.error('[Cursor Auto Fill] 填写验证码失败:', error);
        showNotification(`验证码: ${code}（请手动填写）`, 'info');
      }
    };
    
    // 立即尝试，如果失败则等待
    tryFillCode();
  }

  /**
   * 通过 label 查找输入框
   */
  function findInputByLabel(labelText) {
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      if (label.textContent.includes(labelText)) {
        const input = label.querySelector('input') || 
                     document.getElementById(label.getAttribute('for')) ||
                     document.querySelector(`input[name="${label.getAttribute('for')}"]`);
        if (input) return input;
      }
    }
    return null;
  }

  /**
   * 通过 placeholder 查找输入框
   */
  function findInputByPlaceholder(placeholder) {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.find(input => input.placeholder && input.placeholder.includes(placeholder));
  }

  /**
   * 设置输入框值并触发事件
   */
  function setInputValue(input, value) {
    input.value = value;
    input.focus();
    
    // 触发各种事件以确保表单验证
    triggerInputEvent(input);
  }

  /**
   * 触发输入事件
   */
  function triggerInputEvent(input) {
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      input.dispatchEvent(event);
    });
  }

  /**
   * 显示通知
   */
  function showNotification(message, type = 'success') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#10b981'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // 添加动画样式
    if (!document.getElementById('cursor-auto-fill-styles')) {
      const style = document.createElement('style');
      style.id = 'cursor-auto-fill-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // 如果页面已经加载，立即尝试填写（可能是刷新后的情况）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Cursor Auto Fill] Content script 已加载，页面状态:', document.readyState);
    });
  } else {
    console.log('[Cursor Auto Fill] Content script 已加载，页面状态:', document.readyState);
  }
  
  // 定期检查是否有新字段出现（用于动态加载的表单）
  let checkInterval = null;
  const startFieldChecker = () => {
    if (checkInterval) return;
    
    checkInterval = setInterval(() => {
      // 检查是否有输入框但还没填写
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"]');
      if (inputs.length > 0) {
        console.log('[Cursor Auto Fill] 检测到输入框，等待填写指令...');
      }
    }, 2000);
  };
  
  startFieldChecker();
})();

