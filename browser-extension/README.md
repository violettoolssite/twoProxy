# YLJD 文件加速下载 - 浏览器扩展

[![版本](https://img.shields.io/badge/版本-0.2.0-blue.svg)](https://github.com/violettoolssite/twoProxy)
[![许可证](https://img.shields.io/badge/许可证-MIT-green.svg)](../LICENSE)

一款轻量级的浏览器扩展，专为加速 GitHub Release 文件下载而设计。

## ✨ 功能特性

- 🚀 **GitHub Release 加速** - 自动将 GitHub Release 下载链接重定向到加速节点
- ⚡ **智能重定向** - 仅对 Release 文件生效，不影响其他 GitHub 功能
- 🎯 **一键配置** - 简单直观的设置界面
- 🔧 **自定义节点** - 支持配置自己的加速节点地址
- 💾 **云同步** - 设置自动同步到所有设备（需登录浏览器账号）
- 🌐 **多浏览器支持** - Chrome、Edge、Brave 等基于 Chromium 的浏览器

## 📦 安装方法

### 方式一：从源码安装（推荐）

1. **下载源码**
   ```bash
   git clone https://github.com/violettoolssite/twoProxy.git
   cd twoProxy/browser-extension
   ```

2. **安装到浏览器**
   
   **Chrome / Edge / Brave:**
   - 打开浏览器扩展管理页面
     - Chrome: `chrome://extensions/`
     - Edge: `edge://extensions/`
     - Brave: `brave://extensions/`
   - 启用「开发者模式」（右上角开关）
   - 点击「加载已解压的扩展程序」
   - 选择 `browser-extension` 文件夹

3. **验证安装**
   - 扩展图标应该出现在浏览器工具栏
   - 点击图标查看设置界面

### 方式二：从 Chrome 应用商店安装（即将推出）

🔜 正在准备上架 Chrome Web Store，敬请期待！

## 🎯 使用说明

### 基本使用

1. **首次配置**
   - 点击浏览器工具栏中的扩展图标
   - 查看默认配置（通常无需修改）
   - 勾选「启用 Release 文件加速下载」
   - 点击「保存并应用」

2. **下载 Release 文件**
   - 访问任意 GitHub 项目的 Release 页面
   - 点击下载文件时，会自动跳转到加速节点
   - 享受飞快的下载速度！

### 高级配置

#### 自定义加速节点

如果您有自己的加速节点，可以自定义配置：

1. 点击扩展图标打开设置
2. 在「Release 加速前缀」中输入您的节点地址
3. 格式：`https://your-domain.com/ghproxy/github`
4. 点击「保存并应用」

**示例配置：**
```
默认节点: https://violetteam.cloud/ghproxy/github
自定义节点: https://your-mirror.com/ghproxy/github
```

#### 恢复默认设置

如果需要恢复默认配置：
1. 点击扩展图标打开设置
2. 点击「恢复默认」按钮
3. 点击「保存并应用」

## 🔧 工作原理

### 重定向机制

扩展使用 Chrome 的 `declarativeNetRequest` API 来实现智能重定向：

```
原始 URL:
https://github.com/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64

重定向后:
https://violetteam.cloud/ghproxy/github/ollama/ollama/releases/download/v0.1.0/ollama-linux-amd64
```

### 匹配规则

扩展只会拦截以下类型的 URL：
- ✅ `https://github.com/*/releases/download/*` - Release 文件下载
- ❌ 其他 GitHub 页面和资源不受影响

### 权限说明

| 权限 | 用途 | 说明 |
|------|------|------|
| `declarativeNetRequest` | URL 重定向 | 用于实现自动跳转到加速节点 |
| `storage` | 保存设置 | 存储用户的配置信息 |
| `host_permissions` | 访问特定域名 | 仅访问 GitHub 和配置的加速节点 |

**隐私承诺：** 扩展不会收集、上传或分享任何个人信息。所有配置仅存储在本地浏览器中。

## 📁 项目结构

```
browser-extension/
├── manifest.json       # 扩展清单文件（配置和权限）
├── background.js       # 后台服务（处理 URL 重定向）
├── content.js          # 内容脚本（页面交互）
├── popup.html          # 设置界面 HTML
├── popup.css           # 设置界面样式
├── popup.js            # 设置界面逻辑
└── README.md           # 本文档
```

## 🛠️ 开发指南

### 开发环境

1. **克隆仓库**
   ```bash
   git clone https://github.com/violettoolssite/twoProxy.git
   cd twoProxy/browser-extension
   ```

2. **修改代码**
   - 使用任意文本编辑器修改文件
   - 推荐使用 VS Code 等现代编辑器

3. **重新加载扩展**
   - 在浏览器扩展管理页面
   - 找到本扩展
   - 点击「重新加载」按钮
   - 刷新相关页面查看效果

### 核心文件说明

#### manifest.json
扩展的配置文件，定义了：
- 扩展名称、版本、描述
- 所需权限
- 后台脚本和内容脚本
- 支持的域名

#### background.js
后台服务工作脚本，负责：
- 读取用户配置
- 生成重定向规则
- 应用 `declarativeNetRequest` 规则
- 监听配置变更

#### popup.html / popup.css / popup.js
扩展的设置界面，提供：
- 用户友好的配置表单
- 实时保存和应用设置
- 状态反馈

#### content.js
内容脚本（如有需要可扩展功能）

### 调试方法

1. **查看后台日志**
   - 打开 `chrome://extensions/`
   - 找到本扩展
   - 点击「service worker」链接
   - 查看控制台输出

2. **查看重定向规则**
   - 在控制台执行：
     ```javascript
     chrome.declarativeNetRequest.getDynamicRules().then(console.log)
     ```

3. **测试重定向**
   - 访问任意 GitHub Release 页面
   - 打开开发者工具（F12）
   - 切换到 Network 标签
   - 点击下载链接
   - 查看请求是否被重定向

## 🚀 发布流程

### 版本更新

1. **更新版本号**
   ```bash
   # 编辑 manifest.json
   nano manifest.json
   # 修改 "version": "0.2.0" -> "0.3.0"
   ```

2. **提交更改**
   ```bash
   git add .
   git commit -m "版本更新: v0.3.0 - 新增功能说明"
   git push origin main
   ```

3. **打包扩展**
   ```bash
   # 在浏览器扩展管理页面
   # 点击「打包扩展程序」
   # 生成 .crx 文件和 .pem 私钥文件
   ```

### 发布到 Chrome Web Store

1. 访问 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)
2. 上传打包的扩展（.zip 格式）
3. 填写商店页面信息
4. 提交审核

## 🐛 故障排查

### 扩展无法加载

**问题**：提示「无法加载扩展」

**解决方案**：
1. 检查 `manifest.json` 语法是否正确
2. 确保所有引用的文件都存在
3. 查看错误详情中的具体提示

### 重定向不生效

**问题**：点击下载链接没有跳转到加速节点

**解决方案**：
1. 检查是否勾选了「启用 Release 文件加速下载」
2. 点击「保存并应用」确保配置已生效
3. 刷新 GitHub 页面
4. 查看后台日志确认规则是否加载
5. 验证配置的节点地址是否正确

### 下载速度仍然很慢

**问题**：使用了加速但速度没有提升

**可能原因**：
1. 加速节点本身带宽不足
2. 加速节点到文件源的连接较慢
3. 本地网络环境问题

**解决方案**：
1. 尝试更换其他加速节点
2. 检查加速节点是否正常运行
3. 测试本地网络连接

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue

- 🐛 **Bug 反馈**：详细描述问题和复现步骤
- 💡 **功能建议**：说明需求和使用场景
- 📖 **文档改进**：指出不清楚或错误的地方

### 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m '添加某某功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用清晰的变量和函数命名
- 添加必要的注释
- 遵循现有代码风格
- 测试你的改动

## 📄 许可证

本项目采用 [MIT License](../LICENSE) 开源协议。

## 🙏 致谢

- [YLJD Mirror](https://mirror.yljdteam.com/) - 提供加速服务
- Chrome Extensions API - 强大的扩展能力

## 📞 联系我们

- **QQ**: 1494458927
- **GitHub Issues**: [提交问题](https://github.com/violettoolssite/twoProxy/issues)
- **项目主页**: [https://mirror.yljdteam.com/](https://mirror.yljdteam.com/)

## ⚠️ 免责声明

1. 本扩展仅供学习和研究使用
2. 使用本扩展产生的任何问题，作者不承担责任
3. 请遵守相关法律法规，合理使用加速服务
4. 请勿用于任何违法用途

---

<div align="center">

**如果这个扩展帮助了您，请给项目一个 ⭐️ Star！**

Made with ❤️ by YLJD Team

</div>

