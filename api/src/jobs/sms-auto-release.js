/**
 * SMS自动释放定时任务
 * 自动释放超过15分钟未使用的号码，防止占用配额影响其他用户
 */

const axios = require('axios');
const db = require('../lib/db');

// SMS API配置
const SMS_API_CONFIG = {
  baseURL: process.env.SMS_API_URL || 'https://api.haozhuma.com',
  loginURL: process.env.SMS_API_URL || 'https://api.haozhuma.com',
  user: process.env.SMS_API_USER,
  pass: process.env.SMS_API_PASS
};

// Token缓存
let cachedToken = null;
let tokenExpireTime = 0;

// Cursor项目的对接码列表
const CURSOR_DOCKING_CODES = [
  '78720-Q8DN0E6ZQF',
  '78720-3MIXJU46CU'
];

/**
 * 获取好助码API Token
 */
async function getToken() {
  const now = Date.now();
  
  // 如果token还在有效期内（23小时），直接返回
  if (cachedToken && now < tokenExpireTime) {
    return cachedToken;
  }

  try {
    const response = await axios.get(`${SMS_API_CONFIG.loginURL}/sms/`, {
      params: {
        api: 'login',
        user: SMS_API_CONFIG.user,
        pass: SMS_API_CONFIG.pass
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.code === 0 || data.code === '0') {
      cachedToken = data.token;
      tokenExpireTime = now + 23 * 60 * 60 * 1000; // 23小时后过期
      console.log('[SMS Auto-Release] Token获取成功');
      return cachedToken;
    } else {
      throw new Error(data.msg || 'Token获取失败');
    }
  } catch (error) {
    console.error('[SMS Auto-Release] Token获取失败:', error.message);
    throw error;
  }
}

/**
 * 释放单个号码
 */
async function releasePhone(sid, phone) {
  try {
    const token = await getToken();
    
    // 如果是Cursor项目，尝试使用对接码
    if (sid === '78720') {
      // 尝试所有对接码
      for (const uid of CURSOR_DOCKING_CODES) {
        try {
          const response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
            params: {
              api: 'cancelRecv',
              token: token,
              sid: sid,
              uid: uid,
              phone: phone
            },
            timeout: 10000
          });

          const data = response.data;
          
          if (data.code === 0 || data.code === '0' || data.code === 200) {
            console.log(`[SMS Auto-Release] 释放成功: ${phone} (对接码: ${uid})`);
            return true;
          }
        } catch (error) {
          continue; // 尝试下一个对接码
        }
      }
    }
    
    // 如果对接码都失败，或不使用对接码，尝试不使用对接码
    const response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
      params: {
        api: 'cancelRecv',
        token: token,
        sid: sid,
        phone: phone
      },
      timeout: 10000
    });

    const data = response.data;
    
    if (data.code === 0 || data.code === '0' || data.code === 200) {
      console.log(`[SMS Auto-Release] 释放成功: ${phone}`);
      return true;
    } else {
      console.error(`[SMS Auto-Release] 释放失败: ${phone}, 原因: ${data.msg}`);
      return false;
    }
  } catch (error) {
    console.error(`[SMS Auto-Release] 释放号码异常: ${phone}`, error.message);
    return false;
  }
}

/**
 * 自动释放超时号码
 */
async function autoReleaseExpiredPhones() {
  try {
    console.log('[SMS Auto-Release] 开始检查超时号码...');
    
    // 查询所有持有号码超过15分钟的用户
    const expiredUsers = await db.query(`
      SELECT id, email, sms_current_phone, sms_phone_acquired_at
      FROM users
      WHERE sms_current_phone IS NOT NULL
        AND sms_phone_acquired_at IS NOT NULL
        AND sms_phone_acquired_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    `);

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('[SMS Auto-Release] 没有需要释放的号码');
      return;
    }

    console.log(`[SMS Auto-Release] 发现 ${expiredUsers.length} 个超时号码`);

    // 释放每个号码
    for (const user of expiredUsers) {
      const { id, email, sms_current_phone } = user;
      
      // 固定使用cursor项目ID
      const sid = '78720';
      
      console.log(`[SMS Auto-Release] 释放用户 ${email} 的号码 ${sms_current_phone}`);
      
      // 尝试释放号码
      const released = await releasePhone(sid, sms_current_phone);
      
      // 无论释放成功与否，都清除数据库记录（号码可能已经被平台自动释放）
      await db.update(
        'UPDATE users SET sms_current_phone = NULL, sms_phone_acquired_at = NULL WHERE id = ?',
        [id]
      );
      
      console.log(`[SMS Auto-Release] 用户 ${email} 的记录已清除`);
    }

    console.log(`[SMS Auto-Release] 完成，已释放 ${expiredUsers.length} 个号码`);
  } catch (error) {
    console.error('[SMS Auto-Release] 自动释放任务执行失败:', error);
  }
}

/**
 * 启动定时任务
 * 每5分钟执行一次
 */
function startAutoRelease() {
  console.log('[SMS Auto-Release] 定时任务已启动，每5分钟执行一次');
  
  // 立即执行一次
  autoReleaseExpiredPhones();
  
  // 每5分钟执行一次
  setInterval(autoReleaseExpiredPhones, 5 * 60 * 1000);
}

module.exports = {
  startAutoRelease,
  autoReleaseExpiredPhones
};

