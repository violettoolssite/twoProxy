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
        let firstNameInput = findInputByLabel('名') || findInputByLabel('First Name') || findInputByPlaceholder('您的名字') || findInputByPlaceholder('Your first name');
        let lastNameInput = findInputByLabel('姓') || findInputByLabel('Last Name') || findInputByPlaceholder('您的姓氏') || findInputByPlaceholder('Your last name');
        let emailInput = findInputByLabel('邮箱') || findInputByLabel('Email') || findInputByPlaceholder('您的邮箱地址') || findInputByPlaceholder('Your email address') || document.querySelector('input[type="email"]');
        
        // 方法2: 通过 input 的 name 或 id 属性查找
        if (!firstNameInput) {
          firstNameInput = document.querySelector('input[name*="first" i]') || 
                          document.querySelector('input[id*="first" i]') ||
                          document.querySelector('input[placeholder*="first" i]');
        }
        if (!lastNameInput) {
          lastNameInput = document.querySelector('input[name*="last" i]') || 
                         document.querySelector('input[id*="last" i]') ||
                         document.querySelector('input[placeholder*="last" i]');
        }
        if (!emailInput) {
          emailInput = document.querySelector('input[type="email"]') ||
                      document.querySelector('input[name*="email" i]') ||
                      document.querySelector('input[id*="email" i]');
        }
        
        // 方法3: 通过表单字段顺序查找（如果前面方法都失败）
        if (!firstNameInput || !lastNameInput || !emailInput) {
          const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"]:not([readonly])'));
          console.log('[Cursor Auto Fill] 找到所有输入框:', allInputs.length, allInputs.map(i => ({ 
            type: i.type, 
            name: i.name, 
            id: i.id, 
            placeholder: i.placeholder 
          })));
          
          if (allInputs.length >= 3) {
            // 通常第一个是名，第二个是姓，第三个是邮箱
            if (!firstNameInput) firstNameInput = allInputs[0];
            if (!lastNameInput) lastNameInput = allInputs[1];
            if (!emailInput) {
              // 邮箱可能是第三个，或者查找 type="email" 的
              emailInput = allInputs.find(i => i.type === 'email') || allInputs[2];
            }
          } else if (allInputs.length === 2) {
            // 如果只有两个字段，可能是名和姓
            if (!firstNameInput) firstNameInput = allInputs[0];
            if (!lastNameInput) lastNameInput = allInputs[1];
          }
        }
        
        if (firstNameInput && data.firstName) {
          setInputValue(firstNameInput, data.firstName);
          triggerInputEvent(firstNameInput);
          console.log('[Cursor Auto Fill] 已填写名:', data.firstName);
        } else {
          console.warn('[Cursor Auto Fill] 未找到名输入框');
        }
        
        if (lastNameInput && data.lastName) {
          setInputValue(lastNameInput, data.lastName);
          triggerInputEvent(lastNameInput);
          console.log('[Cursor Auto Fill] 已填写姓:', data.lastName);
        } else {
          console.warn('[Cursor Auto Fill] 未找到姓输入框');
        }
        
        if (emailInput && data.email) {
          setInputValue(emailInput, data.email);
          triggerInputEvent(emailInput);
          console.log('[Cursor Auto Fill] 已填写邮箱:', data.email);
        } else {
          console.warn('[Cursor Auto Fill] 未找到邮箱输入框');
        }
        
        // 如果所有字段都填写完成，自动点击"继续"按钮
        if (firstNameInput && lastNameInput && emailInput && data.firstName && data.lastName && data.email) {
          showNotification('✅ 姓名和邮箱已填写，正在自动点击"继续"按钮...', 'success');
          
          // 等待一下让表单验证通过
          setTimeout(() => {
            clickContinueButton().then(() => {
              // 点击成功后，等待密码输入框出现并填写密码
              if (data.password) {
                setTimeout(() => {
                  fillPassword(data.password);
                }, 2000);
              }
            }).catch(() => {
              console.warn('[Cursor Auto Fill] 未找到"继续"按钮，请手动点击');
              showNotification('⚠️ 未找到"继续"按钮，请手动点击', 'warning');
            });
          }, 1000);
        } else {
          showNotification('⚠️ 部分字段未找到，请手动填写缺失的字段', 'warning');
        }
        
      } catch (error) {
        console.error('[Cursor Auto Fill] 填写失败:', error);
        showNotification('❌ 自动填写失败，请手动填写', 'error');
      }
    };
    
    // 如果页面已加载，立即填写；否则等待
    if (document.readyState === 'complete') {
      setTimeout(fillForm, 1000);
    } else {
      window.addEventListener('load', () => setTimeout(fillForm, 1000));
      // 也尝试立即填写（可能页面已经加载但 readyState 还没更新）
      setTimeout(fillForm, 2000);
    }
  }

  /**
   * 点击"继续"按钮
   */
  function clickContinueButton() {
    return new Promise((resolve, reject) => {
      // 多种方法查找"继续"按钮
      let continueButton = null;
      
      // 方法1: 通过按钮文本查找
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
      continueButton = buttons.find(btn => {
        const text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
        return text.includes('继续') || 
               text.includes('continue') || 
               text.includes('next') ||
               text === 'continue' ||
               text === 'next';
      });
      
      // 方法2: 通过 aria-label 或其他属性
      if (!continueButton) {
        continueButton = document.querySelector('button[aria-label*="继续" i]') ||
                        document.querySelector('button[aria-label*="continue" i]') ||
                        document.querySelector('button[type="submit"]') ||
                        document.querySelector('input[type="submit"]');
      }
      
      // 方法3: 查找包含特定类的按钮
      if (!continueButton) {
        continueButton = document.querySelector('button.continue') ||
                        document.querySelector('button.btn-primary') ||
                        document.querySelector('button[class*="continue" i]');
      }
      
      if (continueButton) {
        // 确保按钮可见且可点击
        if (continueButton.offsetParent !== null && !continueButton.disabled) {
          console.log('[Cursor Auto Fill] 找到"继续"按钮，正在点击...');
          
          // 触发点击事件
          continueButton.click();
          
          // 也尝试触发鼠标事件（某些框架需要）
          const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          continueButton.dispatchEvent(mouseEvent);
          
          showNotification('✅ 已自动点击"继续"按钮', 'success');
          resolve();
        } else {
          console.warn('[Cursor Auto Fill] "继续"按钮不可点击');
          reject(new Error('按钮不可点击'));
        }
      } else {
        console.warn('[Cursor Auto Fill] 未找到"继续"按钮');
        reject(new Error('未找到按钮'));
      }
    });
  }

  /**
   * 填写密码
   */
  function fillPassword(password) {
    console.log('[Cursor Auto Fill] 开始填写密码');
    
    const tryFillPassword = () => {
      try {
        // 查找密码输入框
        let passwordInput = findInputByLabel('密码') || 
                           findInputByLabel('Password') || 
                           findInputByPlaceholder('密码') ||
                           findInputByPlaceholder('Password') ||
                           document.querySelector('input[type="password"]') ||
                           document.querySelector('input[name*="password" i]') ||
                           document.querySelector('input[id*="password" i]');
        
        if (passwordInput) {
          setInputValue(passwordInput, password);
          triggerInputEvent(passwordInput);
          console.log('[Cursor Auto Fill] 已填写密码');
          showNotification('✅ 密码已自动填写，正在点击"继续"按钮...', 'success');
          
          // 等待一下让表单验证通过，然后再次点击"继续"
          setTimeout(() => {
            clickContinueButton().then(() => {
              showNotification('✅ 已自动点击"继续"按钮，等待验证码...', 'success');
            }).catch(() => {
              console.warn('[Cursor Auto Fill] 未找到第二个"继续"按钮');
              showNotification('⚠️ 密码已填写，请手动点击"继续"按钮', 'warning');
            });
          }, 1000);
        } else {
          console.warn('[Cursor Auto Fill] 未找到密码输入框，等待页面加载...');
          // 如果没找到，等待一下再试（可能是密码页面还没加载）
          setTimeout(tryFillPassword, 2000);
        }
      } catch (error) {
        console.error('[Cursor Auto Fill] 填写密码失败:', error);
        showNotification('❌ 填写密码失败，请手动填写', 'error');
      }
    };
    
    // 立即尝试，如果失败则等待
    tryFillPassword();
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
                       findInputByPlaceholder('Enter code') ||
                       document.querySelector('input[type="text"][maxlength="6"]') ||
                       document.querySelector('input[type="text"][maxlength="8"]') ||
                       document.querySelector('input[pattern*="[0-9]"]') ||
                       document.querySelector('input[name*="code" i]') ||
                       document.querySelector('input[id*="code" i]') ||
                       document.querySelector('input[name*="verification" i]') ||
                       document.querySelector('input[id*="verification" i]');
        
        // 如果还没找到，尝试查找所有输入框，选择最可能的
        if (!codeInput) {
          const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"]'));
          // 查找包含数字限制或验证码相关属性的输入框
          codeInput = allInputs.find(input => 
            input.maxLength === 6 || 
            input.maxLength === 8 ||
            (input.pattern && input.pattern.includes('[0-9]')) ||
            (input.name && input.name.toLowerCase().includes('code')) ||
            (input.id && input.id.toLowerCase().includes('code')) ||
            (input.name && input.name.toLowerCase().includes('verification')) ||
            (input.id && input.id.toLowerCase().includes('verification'))
          );
        }
        
        if (codeInput) {
          setInputValue(codeInput, code);
          triggerInputEvent(codeInput);
          console.log('[Cursor Auto Fill] 验证码已填写:', code);
          showNotification(`✅ 验证码已自动填写: ${code}，正在自动提交...`, 'success');
          
          // 等待一下让表单验证通过，然后自动提交或点击继续
          setTimeout(() => {
            // 尝试查找并点击提交按钮
            const submitButton = document.querySelector('button[type="submit"]') ||
                                document.querySelector('input[type="submit"]') ||
                                Array.from(document.querySelectorAll('button')).find(btn => {
                                  const text = (btn.textContent || '').trim().toLowerCase();
                                  return text.includes('继续') || 
                                         text.includes('continue') || 
                                         text.includes('verify') ||
                                         text.includes('确认') ||
                                         text.includes('confirm');
                                });
            
            if (submitButton && submitButton.offsetParent !== null && !submitButton.disabled) {
              submitButton.click();
              showNotification('✅ 已自动提交验证码', 'success');
            } else {
              console.log('[Cursor Auto Fill] 未找到提交按钮，验证码已填写');
            }
          }, 1000);
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

