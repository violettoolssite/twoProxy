#!/usr/bin/env python3
"""
Guangzhou GitHub Release 下载代理
--------------------------------

部署位置：广州节点（如 violetteam.cloud）。

功能：
- /status         -> 服务状态
- /download?url=  -> 通用下载
- /github/<path>  -> 直接拉取 https://github.com/<path>

代理：
- 通过环境变量 HTTP_PROXY / HTTPS_PROXY 读取上游代理（例如本地 ss-local）。
"""

import os
import logging

from flask import Flask, request, Response, stream_with_context, jsonify
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


def get_proxies() -> dict:
    http_proxy = os.getenv("HTTP_PROXY", "")
    https_proxy = os.getenv("HTTPS_PROXY", http_proxy)
    if not http_proxy and not https_proxy:
        return {}
    return {"http": http_proxy, "https": https_proxy}


@app.route("/")
def index():
    return """
<h1>GitHub Download Proxy (Guangzhou)</h1>
<p>Usage:</p>
<ul>
  <li><code>/download?url=GITHUB_URL</code></li>
  <li><code>/github/owner/repo/path/to/file</code></li>
  <li><code>/status</code> - Service status</li>
</ul>
""".strip()


@app.route("/status")
def status():
    return jsonify({"status": "ok", "proxy": bool(get_proxies())})


def download_file(url: str) -> Response:
    try:
        proxies = get_proxies()
        headers = {"User-Agent": "Mozilla/5.0"}

        # HEAD 先获取类型/长度
        head_resp = requests.head(
            url,
            headers=headers,
            proxies=proxies or None,
            timeout=10,
            allow_redirects=True,
        )
        head_resp.raise_for_status()

        content_type = head_resp.headers.get("Content-Type", "application/octet-stream")
        content_length = head_resp.headers.get("Content-Length", "")

        def generate():
            with requests.get(
                url,
                headers=headers,
                proxies=proxies or None,
                stream=True,
                timeout=300,
            ) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        yield chunk

        filename = os.path.basename(url.split("?")[0]) or "download.bin"

        response_headers = {
            "Content-Type": content_type,
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        if content_length:
            response_headers["Content-Length"] = content_length

        return Response(stream_with_context(generate()), headers=response_headers)

    except Exception as exc:  # noqa: BLE001
        app.logger.error("Download error for %s: %s", url, exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/download")
def download():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing url"}), 400
    app.logger.info("Download request: %s", url)
    return download_file(url)


@app.route("/github/<path:url_suffix>")
def github_proxy(url_suffix: str):
    github_url = f"https://github.com/{url_suffix}"
    app.logger.info("GitHub proxy direct download: %s", github_url)
    return download_file(github_url)


if __name__ == "__main__":
    print("Starting GitHub Proxy Server (Guangzhou) on 0.0.0.0:18080 ...")
    app.run(host="0.0.0.0", port=18080, threaded=True, debug=False)


