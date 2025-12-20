/**
 * 视频背景轮播功能
 * 参考: https://github.com/tomcomtang/anime-albums-website
 */

(function() {
  'use strict';

  // 视频背景列表（可以添加更多视频URL）
  const videoSources = [
    // 示例：使用一些免费的背景视频资源
    // 实际使用时可以替换为您的视频URL
    'https://cdn.jsdelivr.net/gh/tomcomtang/anime-albums-website@main/public/videos/bg1.mp4',
    'https://cdn.jsdelivr.net/gh/tomcomtang/anime-albums-website@main/public/videos/bg2.mp4',
    'https://cdn.jsdelivr.net/gh/tomcomtang/anime-albums-website@main/public/videos/bg3.mp4',
  ];

  // 备用背景（如果视频加载失败）
  const fallbackBackgrounds = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  ];

  let currentVideoIndex = 0;
  let videoElement = null;
  let isVideoLoaded = false;

  function initVideoBackground() {
    videoElement = document.getElementById('bg-video');
    if (!videoElement) {
      console.warn('视频背景元素未找到');
      return;
    }

    // 尝试加载第一个视频
    loadVideo(0);

    // 视频播放结束后切换到下一个
    videoElement.addEventListener('ended', () => {
      switchToNextVideo();
    });

    // 视频加载错误时使用备用背景
    videoElement.addEventListener('error', () => {
      console.warn('视频加载失败，使用备用背景');
      useFallbackBackground();
    });

    // 视频加载成功
    videoElement.addEventListener('loadeddata', () => {
      isVideoLoaded = true;
      videoElement.style.opacity = '1';
    });
  }

  function loadVideo(index) {
    if (!videoElement || index >= videoSources.length) {
      useFallbackBackground();
      return;
    }

    const videoUrl = videoSources[index];
    isVideoLoaded = false;
    videoElement.style.opacity = '0';

    // 检查视频URL是否可用
    const testVideo = new Image();
    testVideo.onload = () => {
      videoElement.src = videoUrl;
      videoElement.load();
    };
    testVideo.onerror = () => {
      // 如果视频不可用，尝试下一个
      if (index + 1 < videoSources.length) {
        loadVideo(index + 1);
      } else {
        useFallbackBackground();
      }
    };
    testVideo.src = videoUrl;
  }

  function switchToNextVideo() {
    currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
    loadVideo(currentVideoIndex);
  }

  function useFallbackBackground() {
    const overlay = document.querySelector('.video-overlay');
    if (overlay) {
      const randomBg = fallbackBackgrounds[Math.floor(Math.random() * fallbackBackgrounds.length)];
      overlay.style.background = randomBg + ', rgba(247, 248, 251, 0.85)';
    }
    if (videoElement) {
      videoElement.style.display = 'none';
    }
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoBackground);
  } else {
    initVideoBackground();
  }

  // 每30秒自动切换视频（如果视频列表有多个）
  if (videoSources.length > 1) {
    setInterval(() => {
      if (isVideoLoaded) {
        switchToNextVideo();
      }
    }, 30000);
  }
})();

