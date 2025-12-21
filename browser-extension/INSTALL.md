# Cursor 自动填写浏览器扩展安装指南

## 📦 安装步骤

### Chrome/Edge 浏览器

1. **准备扩展文件**
   - 进入 `browser-extension` 文件夹
   - 将 `manifest-cursor.json` 复制为 `manifest.json`（或重命名）
   - 确保 `cursor-auto-fill.js` 文件存在

2. **打开扩展管理页面**
   - Chrome: 访问 `chrome://extensions/`
   - Edge: 访问 `edge://extensions/`

3. **启用开发者模式**
   - 在扩展管理页面右上角，打开"开发者模式"开关

4. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择 `browser-extension` 文件夹
   - 点击"选择文件夹"

5. **确认安装**
   - 扩展图标应该出现在浏览器工具栏
   - 扩展名称：YLJD Cursor 自动填写助手
   - 如果提示缺少图标文件，可以忽略（不影响功能）

## 🚀 使用方法

1. **打开 Cursor 注册页面**
   - 访问 `https://authenticator.cursor.sh/sign-up`
   - 或者让 Mirror 网站自动打开

2. **在 Mirror 网站创建账号**
   - 访问 Mirror 网站：`https://mirror.yljdteam.com`
   - 点击导航栏中的"YLJD Cursor"
   - 点击"一键创建账号并打开注册页面"

3. **自动填写流程**
   - Mirror 网站会打开 Cursor 注册页面
   - 扩展会自动检测并填写表单：
     - ✅ 自动填写"名"（First Name）
     - ✅ 自动填写"姓"（Last Name）
     - ✅ 自动填写"邮箱"（Email）
   - 点击"继续"按钮
   - 等待验证码邮件
   - 扩展会自动检测并填写验证码

## ⚙️ 工作原理

1. **Content Script 注入**
   - 扩展在 Cursor 注册页面注入脚本
   - 监听来自 Mirror 网站的消息

2. **自动填写表单**
   - 通过 DOM 操作填写表单字段
   - 触发输入事件确保表单验证

3. **验证码自动填写**
   - 监听邮箱接收验证码
   - 自动提取并填写验证码

## 🔧 故障排除

### 扩展未生效

1. 检查扩展是否已启用
2. 检查是否在正确的页面（authenticator.cursor.sh）
3. 刷新注册页面
4. 检查浏览器控制台是否有错误

### 自动填写失败

1. 检查页面是否完全加载
2. 检查表单字段是否已出现
3. 手动刷新页面后重试

## 📝 注意事项

- 扩展只在 Cursor 注册页面生效
- 需要允许浏览器弹窗
- 如果自动填写失败，可以使用辅助窗口手动复制

---

**最后更新**: 2025-12-21

