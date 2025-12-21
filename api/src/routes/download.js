/**
 * 文件下载加速 API
 * 使用 API Key 认证
 */

const express = require('express');
const { authenticateApiKey } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

// 从环境变量或配置获取基础 URL
const BASE_URL = config.baseUrl || 'https://mirror.yljdteam.com';

/**
 * 构建加速 URL（与前端逻辑保持一致）
 */
function buildAcceleratedUrl(urlString) {
  try {
    const u = new URL(urlString);
    let host = u.host;
    let pathname = u.pathname;

    // 如果是本站中转出来的链接，解析出真实的目标 host/path
    if (host === config.domain || host === 'mirror.yljdteam.com') {
      // /file/https/github.com/...
      if (pathname.startsWith('/file/https/')) {
        const rest = pathname.replace(/^\/file\/https\//, '');
        const idx = rest.indexOf('/');
        if (idx !== -1) {
          host = rest.slice(0, idx);
          pathname = rest.slice(idx);
        } else {
          host = rest;
          pathname = '/';
        }
      }
    }

    // GitHub 链接：使用广州节点
    if (host === 'github.com') {
      return `https://violetteam.cloud/ghproxy/github${pathname}${u.search || ''}`;
    }

    // 其他 HTTPS 链接：使用本站代理
    const proto = u.protocol.replace(':', '');
    return `${BASE_URL}/file/${proto}/${host}${pathname}${u.search || ''}`;
  } catch (error) {
    throw new Error('无效的 URL 格式');
  }
}

/**
 * POST /api/download/generate
 * 生成加速下载地址
 * 
 * 请求体：
 * {
 *   "url": "https://example.com/file.zip"
 * }
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "originalUrl": "https://example.com/file.zip",
 *     "acceleratedUrl": "https://mirror.yljdteam.com/file/https/example.com/file.zip"
 *   }
 * }
 */
router.post('/generate', authenticateApiKey, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少 url 参数'
      });
    }

    // 验证 URL 格式
    let targetUrl = url.trim();
    
    // 尝试从命令中提取 URL（支持 curl -fsSL https://... | sh 这类）
    const urlMatch = targetUrl.match(/https?:\/\/[^\s'"]+/);
    if (urlMatch) {
      targetUrl = urlMatch[0];
    }

    // 构建加速 URL
    const acceleratedUrl = buildAcceleratedUrl(targetUrl);

    res.json({
      success: true,
      data: {
        originalUrl: targetUrl,
        acceleratedUrl: acceleratedUrl,
        // 如果原始输入是命令，也返回替换后的命令
        command: urlMatch ? url.replace(urlMatch[0], acceleratedUrl) : null
      }
    });
  } catch (error) {
    console.error('[Download Generate] Error:', error);
    res.status(400).json({
      success: false,
      error: error.message || '生成加速地址失败'
    });
  }
});

/**
 * GET /api/download/generate
 * 生成加速下载地址（GET 方式，方便命令行使用）
 * 
 * 查询参数：
 * - url: 要加速的 URL
 * 
 * 示例：
 * GET /api/download/generate?url=https://example.com/file.zip
 */
router.get('/generate', authenticateApiKey, async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少 url 参数'
      });
    }

    // 验证 URL 格式
    let targetUrl = decodeURIComponent(url).trim();
    
    // 尝试从命令中提取 URL
    const urlMatch = targetUrl.match(/https?:\/\/[^\s'"]+/);
    if (urlMatch) {
      targetUrl = urlMatch[0];
    }

    // 构建加速 URL
    const acceleratedUrl = buildAcceleratedUrl(targetUrl);

    res.json({
      success: true,
      data: {
        originalUrl: targetUrl,
        acceleratedUrl: acceleratedUrl,
        command: urlMatch ? url.replace(urlMatch[0], acceleratedUrl) : null
      }
    });
  } catch (error) {
    console.error('[Download Generate] Error:', error);
    res.status(400).json({
      success: false,
      error: error.message || '生成加速地址失败'
    });
  }
});

module.exports = router;

