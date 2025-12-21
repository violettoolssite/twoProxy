#!/usr/bin/env python3
"""
Mirror 加速站 - Python 快速下载（简化版）
最简单的使用示例
"""

import requests
import os

# 配置
API_KEY = os.getenv("MIRROR_API_KEY", "your-api-key-here")
API_BASE = "https://mirror.yljdteam.com"

def get_accelerated_url(url):
    """获取加速地址"""
    response = requests.post(
        f"{API_BASE}/api/download/generate",
        json={"url": url},
        headers={"X-API-Key": API_KEY}
    )
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 示例 1: GitHub Release
    url = "https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64"
    result = get_accelerated_url(url)
    
    if result.get("success"):
        print(f"加速地址: {result['data']['acceleratedUrl']}")
    else:
        print(f"错误: {result.get('error')}")

