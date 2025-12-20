# 视频背景设置指南

## 📝 说明

网站已集成动态视频背景功能，参考了 [anime-albums-website](https://github.com/tomcomtang/anime-albums-website) 的样式。

## 🎥 配置视频源

### 方法 1: 编辑配置文件

编辑 `js/video-background.js`，在 `videoSources` 数组中添加视频URL：

```javascript
const videoSources = [
  'https://example.com/video1.mp4',
  'https://example.com/video2.mp4',
  'https://example.com/video3.mp4',
];
```

### 方法 2: 从 anime-albums-website 获取视频

1. 克隆仓库：
   ```bash
   git clone https://github.com/tomcomtang/anime-albums-website.git
   cd anime-albums-website
   ```

2. 复制视频文件：
   ```bash
   cp -r public/videos /var/www/mirror/public/
   ```

3. 更新配置：
   ```javascript
   const videoSources = [
     '/videos/bg1.mp4',
     '/videos/bg2.mp4',
     '/videos/bg3.mp4',
   ];
   ```

### 方法 3: 使用免费视频资源

可以使用以下网站的免费视频：
- [Pexels Videos](https://www.pexels.com/videos/)
- [Pixabay Videos](https://pixabay.com/videos/)
- [Coverr](https://coverr.co/)

下载视频后上传到服务器，或使用CDN链接。

## 🎨 备用背景

如果视频加载失败，会自动使用CSS渐变背景。可以在 `js/video-background.js` 中自定义：

```javascript
const fallbackBackgrounds = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  // 添加更多渐变...
];
```

## 🎭 Live2D 角色配置

Live2D角色配置在 `js/live2d-config.js` 中。

### 更换模型

可以更换为其他Live2D模型：

```javascript
window.L2Dwidget.init({
  model: {
    jsonPath: 'https://unpkg.com/live2d-widget-model-模型名@版本/assets/模型名.model.json',
    scale: 1
  },
  // ... 其他配置
});
```

### 可用模型

- `live2d-widget-model-shizuku` - 默认模型
- `live2d-widget-model-koharu` - 小春
- `live2d-widget-model-hijiki` - ひじき
- `live2d-widget-model-wanko` - わんこ
- `live2d-widget-model-z16` - Z16

更多模型：https://github.com/xiazeyu/live2d-widget-models

## ⚙️ 性能优化

### 移动端

移动端默认隐藏Live2D以节省性能，可以在 `css/style.css` 中调整：

```css
@media (max-width: 768px) {
  #live2d-widget {
    display: none; /* 或改为 block 显示 */
  }
}
```

### 视频优化

- 使用压缩后的视频（推荐 H.264 编码）
- 视频分辨率建议：1920x1080 或更低
- 视频大小建议：每个视频 < 10MB

## 🔧 故障排查

### 视频不显示

1. 检查视频URL是否可访问
2. 检查浏览器控制台是否有错误
3. 确认视频格式支持（MP4, WebM）
4. 检查CORS设置（如果使用外部视频）

### Live2D不显示

1. 检查网络连接（需要加载CDN资源）
2. 检查浏览器控制台错误
3. 尝试更换模型
4. 检查移动端是否被隐藏

## 📚 参考资源

- [anime-albums-website](https://github.com/tomcomtang/anime-albums-website)
- [Live2D Widget](https://github.com/stevenjoezhang/live2d-widget)
- [Live2D Models](https://github.com/xiazeyu/live2d-widget-models)

---

**最后更新**: 2025-12-20
