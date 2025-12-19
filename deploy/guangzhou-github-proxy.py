#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
GitHub 下载中转服务
用于加速 GitHub 文件下载

部署位置: /opt/github-proxy/app.py
端口: 18080
依赖: flask, requests

安装依赖:
    pip3 install flask requests

启动方式:
    python3 app.py
    或使用 systemd 服务（见 github-proxy.service）

使用示例:
    curl -L "http://localhost:18080/download?url=https://github.com/ollama/ollama/releases/download/v0.13.3/ollama-linux-amd64.tgz" -o ollama.tgz
"""

import os
import requests
import logging
from flask import Flask, request, Response, stream_with_context, jsonify

app = Flask(__name__)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_proxies():
    """
    获取代理配置
    默认使用本地 Privoxy（端口 8118）或 Shadowsocks 本地代理
    
    环境变量配置:
        HTTP_PROXY: HTTP 代理地址（默认 http://127.0.0.1:8118）
        HTTPS_PROXY: HTTPS 代理地址（默认使用 HTTP_PROXY）
    """
    http_proxy = os.getenv('HTTP_PROXY', 'http://127.0.0.1:8118')
    https_proxy = os.getenv('HTTPS_PROXY', http_proxy)
    return {
        'http': http_proxy,
        'https': https_proxy
    }


@app.route('/')
def index():
    """服务首页，显示使用说明"""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>GitHub 下载中转服务</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
            .info { background: #e7f3ff; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>🚀 GitHub 下载中转服务</h1>
        <div class="info">
            <p><b>端口:</b> 18080</p>
            <p><b>状态:</b> ✅ 运行中</p>
            <p><b>代理:</b> ''' + get_proxies()['http'] + '''</p>
        </div>
        
        <h2>📖 使用方法</h2>
        <pre>GET /download?url=GITHUB_URL</pre>
        
        <h2>💡 示例</h2>
        <h3>1. 下载 Ollama</h3>
        <pre>curl -L "http://violetteam.cloud/ghproxy/download?url=https://github.com/ollama/ollama/releases/download/v0.13.3/ollama-linux-amd64.tgz" -o ollama.tgz</pre>
        
        <h3>2. 下载任意 GitHub Release 文件</h3>
        <pre>curl -L "http://violetteam.cloud/ghproxy/download?url=https://github.com/user/repo/releases/download/v1.0.0/file.tar.gz" -o file.tar.gz</pre>
        
        <h2>🔍 API 端点</h2>
        <ul>
            <li><code>GET /</code> - 服务首页</li>
            <li><code>GET /status</code> - 服务状态</li>
            <li><code>GET /download?url=URL</code> - 下载文件</li>
        </ul>
        
        <h2>⚙️ 健康检查</h2>
        <p>访问 <a href="/status">/status</a> 查看服务状态</p>
    </body>
    </html>
    '''


@app.route('/status')
def status():
    """健康检查端点"""
    proxies = get_proxies()
    return jsonify({
        'status': 'running',
        'port': 18080,
        'proxy': proxies['http'],
        'version': '1.0.0'
    })


@app.route('/download')
def download():
    """
    文件下载端点
    
    参数:
        url: GitHub 文件 URL（必需）
    
    返回:
        文件流（application/octet-stream）
    """
    url = request.args.get('url')
    
    if not url:
        logger.warning('下载请求缺少 url 参数')
        return jsonify({
            'error': '缺少 url 参数',
            'usage': '/download?url=GITHUB_URL'
        }), 400
    
    # 验证 URL 是否为 GitHub 域名
    if not any(domain in url.lower() for domain in ['github.com', 'githubusercontent.com']):
        logger.warning(f'非 GitHub URL: {url}')
        return jsonify({
            'error': '只支持 GitHub 相关域名的 URL',
            'received_url': url
        }), 400
    
    try:
        proxies = get_proxies()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        logger.info(f'开始下载: {url}')
        logger.info(f'使用代理: {proxies["http"]}')
        
        def generate():
            """流式生成文件内容"""
            with requests.get(
                url,
                headers=headers,
                proxies=proxies,
                stream=True,
                timeout=30,
                allow_redirects=True
            ) as r:
                r.raise_for_status()
                
                # 记录下载信息
                content_length = r.headers.get('Content-Length', 'unknown')
                content_type = r.headers.get('Content-Type', 'unknown')
                logger.info(f'文件大小: {content_length} bytes, 类型: {content_type}')
                
                # 流式传输数据（1MB 块）
                for chunk in r.iter_content(chunk_size=1024*1024):
                    if chunk:
                        yield chunk
        
        # 从 URL 中提取文件名
        import urllib.parse
        from pathlib import Path
        filename = Path(urllib.parse.urlparse(url).path).name or 'download.bin'
        
        logger.info(f'文件名: {filename}')
        
        return Response(
            stream_with_context(generate()),
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/octet-stream',
                'X-Proxy-By': 'VioletTeam GitHub Proxy'
            }
        )
        
    except requests.exceptions.Timeout:
        logger.error(f'下载超时: {url}')
        return jsonify({
            'error': '下载超时',
            'url': url
        }), 504
        
    except requests.exceptions.RequestException as e:
        logger.error(f'下载失败: {url}, 错误: {str(e)}')
        return jsonify({
            'error': '下载失败',
            'details': str(e),
            'url': url
        }), 500
        
    except Exception as e:
        logger.error(f'未知错误: {str(e)}')
        return jsonify({
            'error': '服务器内部错误',
            'details': str(e)
        }), 500


@app.route('/health')
def health():
    """Kubernetes/Docker 健康检查端点"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    print("=" * 50)
    print("GitHub 中转服务启动")
    print("=" * 50)
    print(f"端口: 18080")
    print(f"代理: {get_proxies()['http']}")
    print(f"访问: http://0.0.0.0:18080")
    print("=" * 50)
    
    app.run(
        host='0.0.0.0',
        port=18080,
        threaded=True,
        debug=False
    )

