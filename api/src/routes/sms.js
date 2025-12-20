const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const db = require('../lib/db');

// 好助码API配置
const SMS_API_CONFIG = {
  baseURL: process.env.SMS_API_URL || 'https://api.haozhuma.com',
  username: process.env.SMS_API_USER || '',
  password: process.env.SMS_API_PASS || '',
  token: null,
  tokenExpiry: 0
};

// 项目列表
const COMMON_PROJECTS = [
  { id: 'cursor', name: 'Cursor' }
];

// Cursor项目的对接码列表（轮询使用）
const CURSOR_DOCKING_CODES = [
  '78720-Q8DN0E6ZQF',
  '78720-3MIXJU46CU'
];

// 对接码使用计数器（用于轮询）
let dockingCodeIndex = 0;

/**
 * 获取项目的对接码
 * @param {string} sid - 项目ID
 * @returns {string|null} 对接码，如果没有则返回null
 */
function getDockingCode(sid) {
  if (sid === '78720' || sid === 'cursor') {
    // 轮询使用对接码
    const code = CURSOR_DOCKING_CODES[dockingCodeIndex % CURSOR_DOCKING_CODES.length];
    return code;
  }
  return null;
}

/**
 * 获取或刷新Token
 */
async function getToken() {
  // 检查token是否有效
  if (SMS_API_CONFIG.token && Date.now() < SMS_API_CONFIG.tokenExpiry) {
    return SMS_API_CONFIG.token;
  }

  // 检查配置
  if (!SMS_API_CONFIG.username || !SMS_API_CONFIG.password) {
    throw new Error('SMS API 配置未设置');
  }

  try {
    const response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
      params: {
        api: 'login',
        user: SMS_API_CONFIG.username,
        pass: SMS_API_CONFIG.password
      },
      timeout: 10000
    });

    const data = response.data;
    
    if (data.code === 0 || data.code === '0' || data.code === 200) {
      SMS_API_CONFIG.token = data.token;
      // Token有效期设为23小时（文档说明token固定，除非修改密码）
      SMS_API_CONFIG.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return data.token;
    } else {
      throw new Error(data.msg || '登录失败');
    }
  } catch (error) {
    console.error('SMS API登录失败:', error.message);
    throw new Error('SMS API登录失败: ' + error.message);
  }
}

/**
 * GET /api/sms/usage
 * 获取用户短信接码使用情况
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const userUsage = await db.queryOne(
      'SELECT sms_usage_count, sms_usage_limit, sms_last_used_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!userUsage) {
      return res.json({
        success: false,
        message: '用户信息错误'
      });
    }

    const used = userUsage.sms_usage_count || 0;
    const limit = userUsage.sms_usage_limit || 3;

    // 禁止缓存，确保每次都获取最新数据
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        used: used,
        limit: limit,
        remaining: Math.max(0, limit - used),
        lastUsedAt: userUsage.sms_last_used_at
      }
    });
  } catch (error) {
    console.error('获取使用情况失败:', error);
    res.json({
      success: false,
      message: error.message || '获取使用情况失败'
    });
  }
});

/**
 * GET /api/sms/projects
 * 获取项目列表
 */
router.get('/projects', async (req, res) => {
  try {
    // 返回常用项目列表
    res.json({
      success: true,
      data: COMMON_PROJECTS
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.json({
      success: false,
      message: '获取项目列表失败'
    });
  }
});

/**
 * GET /api/sms/get-phone
 * 获取手机号
 * 参数：
 * - sid: 项目ID (必需)
 * - phone: 指定手机号 (可选，如果指定则获取该号码)
 * - isp: 运营商 (可选, 1=移动, 2=联通, 3=电信)
 * - ascription: 号码类型 (可选, 1=只取类似, 2=只取实卡)
 * - province: 省份代码 (可选)
 */
router.get('/get-phone', authenticate, async (req, res) => {
  try {
    const { sid, phone, isp, ascription, province } = req.query;

    if (!sid) {
      return res.json({
        success: false,
        message: '缺少项目ID参数'
      });
    }

    // 检查用户使用次数
    const userUsage = await db.queryOne(
      'SELECT sms_usage_count, sms_usage_limit FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!userUsage) {
      return res.json({
        success: false,
        message: '用户信息错误'
      });
    }

    const usageCount = userUsage.sms_usage_count || 0;
    const usageLimit = userUsage.sms_usage_limit || 3;

    if (usageCount >= usageLimit) {
      return res.json({
        success: false,
        message: `您已使用完${usageLimit}次免费额度，如觉得好用请发电支持，为您的账号开启更多使用次数`,
        usage: {
          used: usageCount,
          limit: usageLimit,
          remaining: 0
        }
      });
    }

    const token = await getToken();

    // 对于Cursor项目，转换为实际项目ID
    let actualSid = sid;
    if (sid === 'cursor') {
      actualSid = '78720'; // Cursor项目ID
    }

    // 获取对接码（轮询使用）
    const uid = getDockingCode(actualSid);
    if (uid) {
      dockingCodeIndex++; // 下次使用下一个对接码
    }

    // 使用对接码获取号码
    const params = {
      api: 'getPhone',
      token: token,
      sid: actualSid,
      max_money: 0.5  // 限制最高价格为0.5元
    };

    // 如果指定了对接码，添加uid参数
    if (uid) {
      params.uid = uid;
    }

    // 如果指定了手机号，添加phone参数
    if (phone) {
      params.phone = phone;
    }

    // 用户可选参数
    if (isp) params.isp = isp;
    if (ascription) params.ascription = ascription;
    if (province) params.Province = province;

    const response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
      params: params,
      timeout: 15000
    });

    const data = response.data;

    if (data.code === 0 || data.code === '0' || data.code === 200) {
      // 更新用户使用次数，并记录当前持有的号码
      await db.update(
        `UPDATE users SET 
          sms_usage_count = sms_usage_count + 1, 
          sms_last_used_at = NOW(),
          sms_current_phone = ?,
          sms_phone_acquired_at = NOW()
        WHERE id = ?`,
        [data.phone, req.user.id]
      );

      // 重新查询剩余次数
      const newUsage = await db.queryOne(
        'SELECT sms_usage_count, sms_usage_limit FROM users WHERE id = ?',
        [req.user.id]
      );

      const used = newUsage.sms_usage_count || 0;
      const limit = newUsage.sms_usage_limit || 3;

      res.json({
        success: true,
        data: {
          phone: data.phone,
          message: data.msg || '获取成功'
        },
        usage: {
          used: used,
          limit: limit,
          remaining: Math.max(0, limit - used)
        }
      });
    } else {
      res.json({
        success: false,
        message: data.msg || '获取手机号失败'
      });
    }
  } catch (error) {
    console.error('获取手机号失败:', error);
    res.json({
      success: false,
      message: error.message || '获取手机号失败'
    });
  }
});

/**
 * GET /api/sms/get-message
 * 获取验证码
 * 参数：
 * - sid: 项目ID (必需)
 * - phone: 手机号 (必需)
 */
router.get('/get-message', async (req, res) => {
  try {
    const { sid, phone } = req.query;

    if (!sid || !phone) {
      return res.json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const token = await getToken();

    // 对于Cursor项目，转换为实际项目ID并获取对接码
    let actualSid = sid;
    if (sid === 'cursor') {
      actualSid = '78720';
    }

    // 尝试使用对接码获取验证码（尝试所有对接码）
    let response = null;
    let success = false;
    
    // 如果是Cursor项目，尝试使用对接码
    if (actualSid === '78720') {
      for (const uid of CURSOR_DOCKING_CODES) {
        try {
          response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
            params: {
              api: 'getMessage',
              token: token,
              sid: actualSid,
              uid: uid,
              phone: phone
            },
            timeout: 10000
          });
          
          // 如果成功，跳出循环
          if (response && response.data && (response.data.code === 0 || response.data.code === '0' || response.data.code === 200)) {
            success = true;
            break;
          }
        } catch (error) {
          // 继续尝试下一个对接码
          continue;
        }
      }
    }

    // 如果对接码都失败，或不使用对接码，尝试不使用对接码
    if (!success) {
      try {
        response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
          params: {
            api: 'getMessage',
            token: token,
            sid: actualSid,
            phone: phone
          },
          timeout: 10000
        });
      } catch (error) {
        console.error('获取验证码失败:', error.message);
        return res.json({
          success: false,
          message: error.message || '获取验证码失败'
        });
      }
    }

    // 确保response存在
    if (!response || !response.data) {
      return res.json({
        success: false,
        message: '获取验证码失败：无响应数据'
      });
    }

    const data = response.data;

    res.json({
      success: true,
      data: {
        code: data.code,
        message: data.msg,
        sms: data.sms,
        yzm: data.yzm
      }
    });
  } catch (error) {
    console.error('获取验证码失败:', error);
    res.json({
      success: false,
      message: error.message || '获取验证码失败'
    });
  }
});

/**
 * POST /api/sms/release-phone
 * 释放手机号
 * Body:
 * - sid: 项目ID (必需)
 * - phone: 手机号 (必需)
 */
router.post('/release-phone', authenticate, async (req, res) => {
  try {
    const { sid, phone } = req.body;

    if (!sid || !phone) {
      return res.json({
        success: false,
        message: '缺少必要参数'
      });
    }

    const token = await getToken();

    // 对于Cursor项目，转换为实际项目ID并获取对接码
    let actualSid = sid;
    if (sid === 'cursor') {
      actualSid = '78720';
    }

    // 尝试使用对接码释放号码（尝试所有对接码）
    let response = null;
    let success = false;
    
    // 如果是Cursor项目，尝试使用对接码
    if (actualSid === '78720') {
      for (const uid of CURSOR_DOCKING_CODES) {
        try {
          response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
            params: {
              api: 'cancelRecv',
              token: token,
              sid: actualSid,
              uid: uid,
              phone: phone
            },
            timeout: 10000
          });
          
          // 如果成功，跳出循环
          if (response && response.data && (response.data.code === 0 || response.data.code === '0' || response.data.code === 200)) {
            success = true;
            break;
          }
        } catch (error) {
          // 继续尝试下一个对接码
          continue;
        }
      }
    }

    // 如果对接码都失败，或不使用对接码，尝试不使用对接码
    if (!success) {
      try {
        response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
          params: {
            api: 'cancelRecv',
            token: token,
            sid: actualSid,
            phone: phone
          },
          timeout: 10000
        });
      } catch (error) {
        console.error('释放手机号失败:', error.message);
        return res.json({
          success: false,
          message: error.message || '释放手机号失败'
        });
      }
    }

    // 确保response存在
    if (!response || !response.data) {
      return res.json({
        success: false,
        message: '释放手机号失败：无响应数据'
      });
    }

    const data = response.data;

    if (data.code === 0 || data.code === '0' || data.code === 200) {
      // 释放成功后，清除数据库中的号码记录
      await db.update(
        'UPDATE users SET sms_current_phone = NULL, sms_phone_acquired_at = NULL WHERE id = ?',
        [req.user.id]
      );
      
      res.json({
        success: true,
        message: data.msg || '释放成功'
      });
    } else {
      res.json({
        success: false,
        message: data.msg || '释放失败'
      });
    }
  } catch (error) {
    console.error('释放手机号失败:', error);
    res.json({
      success: false,
      message: error.message || '释放手机号失败'
    });
  }
});

/**
 * POST /api/sms/release-all
 * 释放全部手机号
 */
router.post('/release-all', async (req, res) => {
  try {
    const token = await getToken();

    // 调用好助码的释放全部接口（cancelAllRecv）
    const response = await axios.get(`${SMS_API_CONFIG.baseURL}/sms/`, {
      params: {
        api: 'cancelAllRecv',
        token: token
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.code === 0 || data.code === '0' || data.code === 200 || data.code === '200') {
      res.json({
        success: true,
        message: data.msg || '已释放全部号码'
      });
    } else {
      res.json({
        success: false,
        message: data.msg || '释放全部失败'
      });
    }
  } catch (error) {
    console.error('释放全部手机号失败:', error);
    res.json({
      success: false,
      message: error.message || '释放全部手机号失败'
    });
  }
});

module.exports = router;

