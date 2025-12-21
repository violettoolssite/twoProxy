#!/usr/bin/env python3
"""
Mirror 加速站 - Python 快速下载示例
使用 API Key 获取加速下载地址

安装依赖：
    pip install requests

使用方法：
    python python_download.py
"""

import requests
import sys
import os

# 配置
API_BASE_URL = "https://mirror.yljdteam.com"
API_KEY = os.getenv("MIRROR_API_KEY", "")  # 从环境变量获取，或直接填写

def get_accelerated_url(original_url, api_key=None):
    """
    获取加速下载地址
    
    Args:
        original_url: 原始下载链接
        api_key: API Key（如果为 None，从环境变量获取）
    
    Returns:
        dict: {
            "success": bool,
            "data": {
                "originalUrl": str,
                "acceleratedUrl": str,
                "command": str or None
            }
        }
    """
    if not api_key:
        api_key = API_KEY
    
    if not api_key:
        return {
            "success": False,
            "error": "请设置 API Key（环境变量 MIRROR_API_KEY 或直接传入）"
        }
    
    # 使用 POST 方式
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/download/generate",
            json={"url": original_url},
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "success": False,
                "error": f"请求失败: {response.status_code} - {response.text}"
            }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"网络错误: {str(e)}"
        }

def get_accelerated_url_get(original_url, api_key=None):
    """
    使用 GET 方式获取加速下载地址（适合命令行使用）
    
    Args:
        original_url: 原始下载链接
        api_key: API Key
    
    Returns:
        dict: 同 get_accelerated_url
    """
    if not api_key:
        api_key = API_KEY
    
    if not api_key:
        return {
            "success": False,
            "error": "请设置 API Key"
        }
    
    try:
        import urllib.parse
        encoded_url = urllib.parse.quote(original_url, safe='')
        
        response = requests.get(
            f"{API_BASE_URL}/api/download/generate",
            params={"url": original_url},
            headers={
                "X-API-Key": api_key
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "success": False,
                "error": f"请求失败: {response.status_code} - {response.text}"
            }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"网络错误: {str(e)}"
        }

def download_file(accelerated_url, save_path=None):
    """
    下载文件
    
    Args:
        accelerated_url: 加速后的下载链接
        save_path: 保存路径（如果为 None，使用 URL 中的文件名）
    
    Returns:
        bool: 是否成功
    """
    try:
        response = requests.get(accelerated_url, stream=True, timeout=30)
        response.raise_for_status()
        
        # 如果没有指定保存路径，从 URL 或 Content-Disposition 获取文件名
        if not save_path:
            # 尝试从 Content-Disposition 获取文件名
            content_disposition = response.headers.get('Content-Disposition', '')
            if 'filename=' in content_disposition:
                save_path = content_disposition.split('filename=')[1].strip('"\'')
            else:
                # 从 URL 获取文件名
                from urllib.parse import urlparse
                parsed = urlparse(accelerated_url)
                save_path = os.path.basename(parsed.path) or 'download'
        
        # 下载文件
        total_size = int(response.headers.get('Content-Length', 0))
        downloaded = 0
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r下载进度: {percent:.1f}% ({downloaded}/{total_size} bytes)", end='', flush=True)
        
        print(f"\n✓ 文件已保存到: {save_path}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"✗ 下载失败: {str(e)}")
        return False

def main():
    """主函数 - 示例用法"""
    if len(sys.argv) < 2:
        print("使用方法:")
        print(f"  python {sys.argv[0]} <原始URL> [保存路径]")
        print("\n示例:")
        print(f"  python {sys.argv[0]} https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64")
        print(f"  python {sys.argv[0]} https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe python.exe")
        print("\n环境变量:")
        print("  设置 MIRROR_API_KEY 环境变量，或直接在代码中修改 API_KEY")
        sys.exit(1)
    
    original_url = sys.argv[1]
    save_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"原始链接: {original_url}")
    print("正在获取加速地址...")
    
    # 获取加速地址
    result = get_accelerated_url(original_url)
    
    if not result.get("success"):
        print(f"✗ 错误: {result.get('error', '未知错误')}")
        sys.exit(1)
    
    data = result.get("data", {})
    accelerated_url = data.get("acceleratedUrl")
    
    print(f"✓ 加速地址: {accelerated_url}")
    
    # 下载文件
    if save_path or input("\n是否下载文件? (y/n): ").lower() == 'y':
        print("\n开始下载...")
        download_file(accelerated_url, save_path)

if __name__ == "__main__":
    main()

