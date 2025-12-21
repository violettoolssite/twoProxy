# API Key 使用示例

本目录包含使用 API Key 访问 Mirror 加速站的各种示例代码。

## 📋 目录

- `python_download.py` - 完整的 Python 下载示例（支持命令行）
- `python_download_simple.py` - 简化的 Python 示例

## 🐍 Python 示例

### 快速开始

1. **安装依赖**
   ```bash
   pip install requests
   ```

2. **设置 API Key**
   ```bash
   export MIRROR_API_KEY="your-api-key-here"
   ```
   
   或在代码中直接设置：
   ```python
   API_KEY = "your-api-key-here"
   ```

3. **使用示例**

   **方式 1: 使用简化版**
   ```python
   python python_download_simple.py
   ```

   **方式 2: 使用完整版（命令行）**
   ```bash
   python python_download.py https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64
   ```

### API 接口说明

#### POST /api/download/generate

**请求**
```python
import requests

response = requests.post(
    "https://mirror.yljdteam.com/api/download/generate",
    json={"url": "https://example.com/file.zip"},
    headers={"X-API-Key": "your-api-key"}
)
```

**响应**
```json
{
  "success": true,
  "data": {
    "originalUrl": "https://example.com/file.zip",
    "acceleratedUrl": "https://mirror.yljdteam.com/file/https/example.com/file.zip",
    "command": null
  }
}
```

#### GET /api/download/generate

**请求**
```python
response = requests.get(
    "https://mirror.yljdteam.com/api/download/generate",
    params={"url": "https://example.com/file.zip"},
    headers={"X-API-Key": "your-api-key"}
)
```

**响应**：同 POST 方式

### 完整示例

```python
import requests
import os

API_KEY = os.getenv("MIRROR_API_KEY")
API_BASE = "https://mirror.yljdteam.com"

# 1. 获取加速地址
def get_accelerated_url(original_url):
    response = requests.post(
        f"{API_BASE}/api/download/generate",
        json={"url": original_url},
        headers={"X-API-Key": API_KEY}
    )
    return response.json()

# 2. 使用加速地址下载
def download_file(accelerated_url, save_path):
    response = requests.get(accelerated_url, stream=True)
    with open(save_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"文件已保存到: {save_path}")

# 使用
original_url = "https://github.com/user/repo/releases/download/v1.0.0/app.zip"
result = get_accelerated_url(original_url)

if result.get("success"):
    accelerated_url = result["data"]["acceleratedUrl"]
    download_file(accelerated_url, "app.zip")
else:
    print(f"错误: {result.get('error')}")
```

## 🔑 获取 API Key

1. 访问用户中心：https://mirror.yljdteam.com/user/
2. 登录您的账号
3. 在"API Key"部分查看您的 API Key
4. 可以点击"刷新"生成新的 API Key

## ⚠️ 注意事项

1. **安全**：请妥善保管您的 API Key，不要泄露给他人
2. **限制**：API Key 功能已启用，但可能有限制（如每日调用次数）
3. **错误处理**：请妥善处理 API 返回的错误信息

## 📚 更多文档

- [API Key 使用说明](../API_KEY_USAGE.md)
- [API 文档](../api/README.md)

---

**最后更新**: 2025-12-20

