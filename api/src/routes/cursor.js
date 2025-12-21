/**
 * YLJD Cursor 一键切换账号 API
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// Cursor API 配置（需要根据实际 API 调整）
const CURSOR_API_BASE = process.env.CURSOR_API_BASE || 'https://api.cursor.com';
const CURSOR_REGISTER_URL = `${CURSOR_API_BASE}/auth/register`;
const CURSOR_LOGIN_URL = `${CURSOR_API_BASE}/auth/login`;

// 存储临时账号信息（实际应该使用 Redis 或数据库）
const tempAccounts = new Map();

/**
 * 生成随机字符串
 */
function generateRandomString(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机用户名
 */
function generateRandomUsername() {
  const adjectives = ['swift', 'bright', 'quick', 'smart', 'cool', 'fast', 'sharp', 'bold', 'keen', 'wise'];
  const nouns = ['dev', 'coder', 'hacker', 'builder', 'maker', 'creator', 'engineer', 'wizard', 'ninja', 'guru'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

/**
 * 生成随机邮箱（使用 logincursor.xyz 域名）
 */
function generateRandomEmail() {
  const prefix = generateRandomString(10);
  return `${prefix}@logincursor.xyz`;
}

/**
 * 生成随机密码
 */
function generateRandomPassword() {
  // 生成12-16位的随机密码，包含大小写字母、数字和特殊字符
  const length = 12 + Math.floor(Math.random() * 5);
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  // 确保至少包含一个大写字母、一个小写字母、一个数字和一个特殊字符
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * POST /api/cursor/create-account
 * 创建 Cursor 账号
 */
router.post('/create-account', async (req, res) => {
  try {
    // 生成随机账号信息
    const email = generateRandomEmail();
    const username = generateRandomUsername();
    const password = generateRandomPassword();
    
    // 调用 Cursor API 注册账号
    // 注意：这里需要根据实际的 Cursor API 调整
    let token = null;
    let registerSuccess = false;
    
    try {
      // 尝试注册（需要根据实际 API 调整）
      const registerResponse = await axios.post(CURSOR_REGISTER_URL, {
        email: email,
        username: username,
        password: password
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'YLJD-Mirror/1.0'
        }
      });
      
      if (registerResponse.status === 200 || registerResponse.status === 201) {
        registerSuccess = true;
        
        // 尝试自动登录获取 token
        try {
          const loginResponse = await axios.post(CURSOR_LOGIN_URL, {
            email: email,
            password: password
          }, {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'YLJD-Mirror/1.0'
            }
          });
          
          if (loginResponse.data && loginResponse.data.token) {
            token = loginResponse.data.token;
          } else if (loginResponse.data && loginResponse.data.access_token) {
            token = loginResponse.data.access_token;
          }
        } catch (loginError) {
          console.warn('[Cursor] 自动登录失败，需要等待验证邮件:', loginError.message);
          // 登录失败是正常的，可能需要邮箱验证
        }
      }
    } catch (apiError) {
      console.error('[Cursor] API 调用失败:', apiError.message);
      // 如果 API 调用失败，仍然返回账号信息，让用户手动注册
      // 或者可以返回错误
      if (apiError.response && apiError.response.status === 400) {
        return res.status(400).json({
          success: false,
          error: '注册失败：' + (apiError.response.data?.message || '未知错误')
        });
      }
    }
    
    // 存储账号信息（24小时过期）
    const accountId = crypto.randomBytes(16).toString('hex');
    const accountData = {
      id: accountId,
      email: email,
      username: username,
      password: password,
      token: token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    tempAccounts.set(accountId, accountData);
    
    // 24小时后自动删除
    setTimeout(() => {
      tempAccounts.delete(accountId);
    }, 24 * 60 * 60 * 1000);
    
    res.json({
      success: true,
      data: {
        id: accountId,
        email: email,
        username: username,
        password: password,
        token: token,
        registered: registerSuccess,
        message: token ? '账号已创建并自动登录' : (registerSuccess ? '账号已创建，请检查邮箱验证' : '账号信息已生成，请手动注册')
      }
    });
  } catch (error) {
    console.error('[Cursor Create Account] Error:', error);
    res.status(500).json({
      success: false,
      error: '创建账号失败：' + error.message
    });
  }
});

/**
 * GET /api/cursor/check-login
 * 检查登录状态
 */
router.get('/check-login', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: '缺少 email 参数'
      });
    }
    
    // 查找账号
    let accountData = null;
    for (const [id, account] of tempAccounts.entries()) {
      if (account.email === email) {
        accountData = account;
        break;
      }
    }
    
    if (!accountData) {
      return res.status(404).json({
        success: false,
        error: '未找到账号信息'
      });
    }
    
    // 如果还没有 token，尝试登录
    if (!accountData.token) {
      try {
        const loginResponse = await axios.post(CURSOR_LOGIN_URL, {
          email: accountData.email,
          password: accountData.password
        }, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'YLJD-Mirror/1.0'
          }
        });
        
        if (loginResponse.data && loginResponse.data.token) {
          accountData.token = loginResponse.data.token;
        } else if (loginResponse.data && loginResponse.data.access_token) {
          accountData.token = loginResponse.data.access_token;
        }
        
        // 更新存储
        tempAccounts.set(accountData.id, accountData);
      } catch (loginError) {
        // 登录失败，可能还在等待验证
        console.warn('[Cursor] 登录检查失败:', loginError.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        email: accountData.email,
        username: accountData.username,
        token: accountData.token,
        hasToken: !!accountData.token
      }
    });
  } catch (error) {
    console.error('[Cursor Check Login] Error:', error);
    res.status(500).json({
      success: false,
      error: '检查登录状态失败：' + error.message
    });
  }
});

/**
 * POST /api/cursor/download-config
 * 下载配置文件
 */
router.post('/download-config', (req, res) => {
  try {
    const { email, username, password, token } = req.body;
    
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的账号信息'
      });
    }
    
    // 生成配置文件内容
    const config = {
      email: email,
      username: username,
      password: password,
      token: token || null,
      createdAt: new Date().toISOString(),
      note: '此配置文件由 YLJD Mirror 生成，请妥善保管'
    };
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cursor-config-${Date.now()}.json"`);
    
    // 发送配置文件
    res.json(config);
  } catch (error) {
    console.error('[Cursor Download Config] Error:', error);
    res.status(500).json({
      success: false,
      error: '生成配置文件失败：' + error.message
    });
  }
});

module.exports = router;

