// Cloudflare Workers 配置示例
// 部署到 Cloudflare Workers 可以实现更精细的缓存控制

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 静态资源：从 Cloudflare 缓存获取
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    return fetch(request, {
      cf: {
        cacheEverything: true,
        cacheTtl: 604800 // 7天
      }
    });
  }
  
  // API 请求：直接回源，不缓存
  if (url.pathname.startsWith('/api/')) {
    return fetch(request, {
      cf: {
        cacheEverything: false
      }
    });
  }
  
  // 代理请求：直接回源
  if (url.pathname.startsWith('/gh/') || 
      url.pathname.startsWith('/v2/') || 
      url.pathname.startsWith('/file/')) {
    return fetch(request, {
      cf: {
        cacheEverything: false
      }
    });
  }
  
  // 其他请求：默认处理
  return fetch(request);
}
