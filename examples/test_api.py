#!/usr/bin/env python3
"""
测试 API Key 文件加速下载功能
"""

import requests
import os
import sys

API_BASE = "https://mirror.yljdteam.com"
API_KEY = os.getenv("MIRROR_API_KEY", "")

def test_api():
    """测试 API"""
    if not API_KEY:
        print("❌ 错误: 请设置环境变量 MIRROR_API_KEY")
        print("   例如: export MIRROR_API_KEY='your-api-key-here'")
        sys.exit(1)
    
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("🧪 测试 API Key 文件加速下载功能")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"API 地址: {API_BASE}")
    print(f"API Key: {API_KEY[:10]}...{API_KEY[-4:]}")
    print()
    
    # 测试用例
    test_cases = [
        {
            "name": "GitHub Release",
            "url": "https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64"
        },
        {
            "name": "Python 官网",
            "url": "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe"
        },
        {
            "name": "通用 HTTPS 链接",
            "url": "https://example.com/file.zip"
        }
    ]
    
    success_count = 0
    fail_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"[测试 {i}/{len(test_cases)}] {test_case['name']}")
        print(f"  原始 URL: {test_case['url']}")
        
        try:
            # 测试 POST 方式
            response = requests.post(
                f"{API_BASE}/api/download/generate",
                json={"url": test_case["url"]},
                headers={
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    accelerated_url = result["data"]["acceleratedUrl"]
                    print(f"  ✅ 成功")
                    print(f"  加速 URL: {accelerated_url}")
                    success_count += 1
                else:
                    print(f"  ❌ 失败: {result.get('error', '未知错误')}")
                    fail_count += 1
            else:
                print(f"  ❌ HTTP {response.status_code}: {response.text[:100]}")
                fail_count += 1
                
        except requests.exceptions.RequestException as e:
            print(f"  ❌ 网络错误: {str(e)}")
            fail_count += 1
        
        print()
    
    # 测试 GET 方式
    print("[测试] GET 方式")
    try:
        test_url = "https://example.com/test.zip"
        response = requests.get(
            f"{API_BASE}/api/download/generate",
            params={"url": test_url},
            headers={"X-API-Key": API_KEY},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print(f"  ✅ GET 方式成功")
                print(f"  加速 URL: {result['data']['acceleratedUrl']}")
                success_count += 1
            else:
                print(f"  ❌ GET 方式失败: {result.get('error')}")
                fail_count += 1
        else:
            print(f"  ❌ GET 方式 HTTP {response.status_code}")
            fail_count += 1
    except Exception as e:
        print(f"  ❌ GET 方式错误: {str(e)}")
        fail_count += 1
    
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"📊 测试结果: ✅ {success_count} 成功, ❌ {fail_count} 失败")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    if fail_count == 0:
        print("🎉 所有测试通过！")
        return 0
    else:
        print("⚠️  部分测试失败，请检查 API 配置")
        return 1

if __name__ == "__main__":
    sys.exit(test_api())

