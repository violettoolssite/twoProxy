/**
 * Cloudflare Email Worker for logincursor.xyz
 * 
 * 部署说明：
 * 1. 在 Cloudflare Workers 中创建新 Worker
 * 2. 复制此代码到 Worker
 * 3. 在 logincursor.xyz 域名设置中启用 Email Routing
 * 4. 添加 Catch-all 规则，将所有邮件发送到此 Worker
 * 5. 绑定 KV 命名空间：EMAILS_KV
 */

addEventListener('email', event => {
  event.waitUntil(handleEmail(event));
});

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 处理接收到的邮件
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
    
    // 构造邮件对象
    const emailData = {
      from,
      to,
      subject,
      date,
      text: text || '',
      html: html || '',
      raw: rawEmail.substring(0, 10000) // 限制大小
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
    status: 'running'
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * 从原始邮件中提取文本和 HTML 内容
 */
async function extractEmailContent(rawEmail) {
  let text = '';
  let html = '';
  
  try {
    const lines = rawEmail.split('\n');
    let inBody = false;
    let currentContentType = '';
    let currentEncoding = '';
    let currentCharset = 'utf-8';
    let contentBuffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测 Content-Type 和 charset
      if (line.match(/^Content-Type:\s*text\/(plain|html)/i)) {
        const typeMatch = line.match(/text\/(plain|html)/i);
        currentContentType = typeMatch ? typeMatch[1].toLowerCase() : '';
        
        // 提取 charset
        const charsetMatch = line.match(/charset[=\s]*["']?([^"'\s;]+)/i);
        if (charsetMatch) {
          currentCharset = charsetMatch[1].toLowerCase();
        }
        continue;
      }
      
      // 检测编码方式
      if (line.match(/^Content-Transfer-Encoding:\s*(.+)/i)) {
        const match = line.match(/Content-Transfer-Encoding:\s*(.+)/i);
        currentEncoding = match ? match[1].trim().toLowerCase() : '';
        continue;
      }
      
      // 空行表示正文开始
      if (!inBody && line === '' && currentContentType) {
        inBody = true;
        continue;
      }
      
      // 读取正文内容
      if (inBody) {
        // MIME 边界表示内容结束
        if (line.startsWith('--')) {
          // 处理收集到的内容
          if (contentBuffer.length > 0) {
            let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
            
            // 根据类型存储
            if (currentContentType === 'plain') {
              text = content;
            } else if (currentContentType === 'html') {
              html = content;
            }
            
            contentBuffer = [];
          }
          
          inBody = false;
          currentContentType = '';
          currentEncoding = '';
          currentCharset = 'utf-8';
          continue;
        }
        
        // 跳过 Content- 开头的行
        if (line.match(/^Content-/i)) continue;
        
        contentBuffer.push(line);
      }
    }
    
    // 处理剩余内容
    if (contentBuffer.length > 0) {
      let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
      
      if (currentContentType === 'plain') {
        text = content;
      } else if (currentContentType === 'html') {
        html = content;
      }
    }
    
  } catch (error) {
    console.error('Extract email content error:', error);
  }
  
  return { text, html };
}

/**
 * 解码邮件内容
 */
function decodeContent(content, encoding, charset) {
  try {
    charset = charset || 'utf-8';
    
    // 先根据 Transfer-Encoding 解码
    if (encoding === 'base64') {
      // Base64 解码
      const cleaned = content.replace(/\s/g, '');
      const binaryString = atob(cleaned);
      
      // 转换为 Uint8Array
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 使用 TextDecoder 解码
      const decoder = new TextDecoder(charset);
      content = decoder.decode(bytes);
      
    } else if (encoding === 'quoted-printable') {
      // Quoted-Printable 解码，传入 charset
      content = decodeQuotedPrintable(content, charset);
    }
    
    return content;
  } catch (e) {
    console.error('Decode content error:', e);
    return content;
  }
}

/**
 * 解码 Quoted-Printable 编码
 */
function decodeQuotedPrintable(str, charset = 'utf-8') {
  try {
    // 移除软换行
    str = str.replace(/=\r?\n/g, '');
    
    // 将 =XX 转换为字节数组
    const bytes = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === '=' && i + 2 < str.length) {
        const hex = str.substr(i + 1, 2);
        if (/^[0-9A-F]{2}$/i.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 3;
        } else {
          bytes.push(str.charCodeAt(i));
          i++;
        }
      } else {
        bytes.push(str.charCodeAt(i));
        i++;
      }
    }
    
    // 使用 TextDecoder 正确解码 UTF-8
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder(charset);
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error('Decode quoted-printable error:', e);
    return str;
  }
}

