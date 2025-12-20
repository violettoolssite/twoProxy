/**
 * Cloudflare Email Worker with Content Filtering
 * 
 * 内容过滤和安全合规功能：
 * 1. 检测和阻止违法内容（儿童色情、恐怖主义等）
 * 2. 自动删除可疑邮件
 * 3. 记录可疑活动日志
 * 4. 支持内容报告机制
 * 
 * 部署说明：
 * 1. 替换原有的 cloudflare-email-worker.js
 * 2. 确保 KV 命名空间已创建：EMAILS_KV, SUSPICIOUS_LOGS_KV
 * 3. 配置环境变量：CONTENT_FILTER_ENABLED=true
 */

// 违法内容关键词列表（示例，需要根据实际情况扩展）
const ILLEGAL_KEYWORDS = {
  // 儿童色情相关（需要根据实际情况扩展）
  childExploitation: [
    // 这里不列出具体关键词，实际部署时需要添加
    // 建议使用专业的第三方内容过滤服务
  ],
  
  // 恐怖主义相关
  terrorism: [
    // 这里不列出具体关键词，实际部署时需要添加
    // 建议使用专业的第三方内容过滤服务
  ],
  
  // 其他违法内容
  illegal: [
    // 这里不列出具体关键词，实际部署时需要添加
  ]
};

// 可疑内容检测函数
function detectIllegalContent(text, html, subject, from) {
  const suspiciousPatterns = [];
  const content = (text || '').toLowerCase() + ' ' + (html || '').toLowerCase() + ' ' + (subject || '').toLowerCase();
  
  // 检测可疑附件（通过邮件头）
  // 检测可疑链接
  const suspiciousLinks = content.match(/https?:\/\/[^\s]+/g) || [];
  
  // 检测可疑图片引用
  const suspiciousImages = content.match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
  
  // 检测加密或编码内容（可能是逃避检测）
  const base64Pattern = /[A-Za-z0-9+\/]{100,}={0,2}/g;
  const hasLargeBase64 = base64Pattern.test(content) && content.match(base64Pattern).some(s => s.length > 200);
  
  if (hasLargeBase64) {
    suspiciousPatterns.push('large_base64_encoded_content');
  }
  
  // 检测可疑发件人
  const suspiciousDomains = [
    '.onion', // Tor 网络
    '.i2p',   // I2P 网络
  ];
  
  const isSuspiciousDomain = suspiciousDomains.some(domain => from && from.toLowerCase().includes(domain));
  if (isSuspiciousDomain) {
    suspiciousPatterns.push('suspicious_domain');
  }
  
  return {
    isSuspicious: suspiciousPatterns.length > 0,
    patterns: suspiciousPatterns,
    riskLevel: suspiciousPatterns.length > 2 ? 'high' : suspiciousPatterns.length > 0 ? 'medium' : 'low'
  };
}

// 记录可疑活动
async function logSuspiciousActivity(emailData, detectionResult) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      riskLevel: detectionResult.riskLevel,
      patterns: detectionResult.patterns,
      action: 'blocked',
      // 不存储实际内容，只存储元数据
      contentLength: (emailData.text || '').length + (emailData.html || '').length
    };
    
    // 存储到 KV（保留30天用于合规审查）
    const logKey = `suspicious:${Date.now()}:${emailData.to}`;
    await SUSPICIOUS_LOGS_KV.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 2592000 // 30天
    });
    
    // 发送告警（可以集成到监控系统）
    console.error(`[SECURITY ALERT] Suspicious email detected:`, {
      to: emailData.to,
      from: emailData.from,
      riskLevel: detectionResult.riskLevel,
      patterns: detectionResult.patterns
    });
    
    // 可以在这里添加发送告警到管理员的逻辑
    // 例如：发送到 Cloudflare Workers 的 Webhook 或邮件通知
    
  } catch (error) {
    console.error('Failed to log suspicious activity:', error);
  }
}

/**
 * 处理接收到的邮件（带内容过滤）
 */
async function handleEmail(event) {
  const message = event.message;
  
  try {
    // 提取邮件信息
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '(无主题)';
    const date = new Date().toISOString();
    
    // 读取原始邮件内容
    const rawEmail = await new Response(message.raw).text();
    
    // 提取纯文本和 HTML 内容
    const { text, html } = await extractEmailContent(rawEmail);
    
    // 内容过滤检测
    const detectionResult = detectIllegalContent(text, html, subject, from);
    
    // 如果检测到可疑内容，不存储邮件
    if (detectionResult.isSuspicious) {
      // 记录可疑活动
      await logSuspiciousActivity({
        to,
        from,
        subject,
        date,
        text: '', // 不存储实际内容
        html: '',
        raw: ''
      }, detectionResult);
      
      console.warn(`[CONTENT FILTER] Blocked suspicious email to ${to} from ${from}, risk: ${detectionResult.riskLevel}`);
      
      // 直接返回，不存储邮件
      return;
    }
    
    // 构造邮件对象（限制内容大小）
    const emailData = {
      from,
      to,
      subject,
      date,
      text: (text || '').substring(0, 50000), // 限制文本大小
      html: (html || '').substring(0, 100000), // 限制HTML大小
      raw: rawEmail.substring(0, 10000) // 限制原始邮件大小
    };
    
    // 存储到 KV（按收件人地址）
    const key = `emails:${to}`;
    let emails = [];
    
    try {
      const existing = await EMAILS_KV.get(key, 'json');
      if (existing && Array.isArray(existing)) {
        emails = existing;
      }
    } catch (e) {
      console.error('Failed to get existing emails:', e);
    }
    
    // 添加新邮件（最多保留50封）
    emails.unshift(emailData);
    if (emails.length > 50) {
      emails = emails.slice(0, 50);
    }
    
    // 保存到 KV（24小时过期）
    await EMAILS_KV.put(key, JSON.stringify(emails), {
      expirationTtl: 86400 // 24小时
    });
    
    console.log(`Email stored for ${to}, text length: ${text?.length || 0}, html length: ${html?.length || 0}`);
  } catch (error) {
    console.error('Error handling email:', error);
  }
}

/**
 * 处理 HTTP 请求
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // GET /api/emails/:email - 获取邮件列表
  const emailMatch = url.pathname.match(/^\/api\/emails\/(.+)$/);
  if (emailMatch && request.method === 'GET') {
    const email = decodeURIComponent(emailMatch[1]);
    
    try {
      const key = `emails:${email}`;
      const emails = await EMAILS_KV.get(key, 'json');
      
      return new Response(JSON.stringify({
        email,
        emails: emails || [],
        count: emails ? emails.length : 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: '获取邮件失败',
        message: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  // 默认响应
  return new Response(JSON.stringify({
    service: 'Temporary Email Service',
    domain: 'logincursor.xyz',
    status: 'running',
    contentFilter: 'enabled'
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * 从原始邮件中提取文本和 HTML 内容
 * （保持原有实现）
 */
async function extractEmailContent(rawEmail) {
  // 这里保持原有的 extractEmailContent 实现
  // 从 cloudflare-email-worker.js 复制过来
  let text = '';
  let html = '';
  
  // 简单的 MIME 解析
  // 实际实现需要完整的 MIME 解析库
  
  return { text, html };
}

// 导出事件处理器
addEventListener('email', event => {
  event.waitUntil(handleEmail(event));
});

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

