/**
 * Live2D Widget 配置
 * 参考: https://github.com/tomcomtang/anime-albums-website
 * Live2D Widget: https://github.com/stevenjoezhang/live2d-widget
 */

(function() {
  'use strict';

  // Live2D Widget 配置
  window.L2Dwidget = window.L2Dwidget || {};
  
  // 配置Live2D角色
  window.L2Dwidget.init({
    model: {
      // 使用默认模型，也可以指定其他模型
      jsonPath: 'https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json',
      scale: 1
    },
    display: {
      position: 'right', // 位置：left, right
      width: 200,        // 宽度
      height: 400,       // 高度
      hOffset: 0,        // 水平偏移
      vOffset: 0         // 垂直偏移
    },
    mobile: {
      show: true,        // 移动端是否显示
      scale: 0.8         // 移动端缩放比例
    },
    react: {
      opacity: 0.8,      // 透明度
      opacityDefault: 0.8,
      opacityOnHover: 1.0
    },
    dialog: {
      enable: true,      // 启用对话框
      hitokoto: true    // 使用一言API
    }
  });

  // 如果默认模型加载失败，尝试备用模型
  setTimeout(() => {
    const live2dElement = document.getElementById('live2d-widget');
    if (!live2dElement || live2dElement.children.length === 0) {
      console.warn('Live2D默认模型加载失败，尝试备用模型');
      // 可以在这里添加备用模型配置
    }
  }, 5000);

})();

