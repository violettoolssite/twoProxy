const fs = require('fs');

// 创建简单的 PNG 图标（最小有效 PNG）
function createSimplePNG(size, text) {
  // 这是一个最小的有效 PNG 文件结构
  // 16x16 蓝色圆形图标，白色 "C" 字母
  
  // PNG 文件头
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // 使用 canvas 或创建一个简单的 base64 PNG
  // 为了简单，我们创建一个最小的有效 PNG
  
  // 这里我们使用一个更实用的方法：创建一个简单的 SVG 然后转换为 PNG
  // 但由于没有转换工具，我们直接创建一个最小的有效 PNG
  
  // 实际上，最简单的方法是使用一个在线工具或预制的图标
  // 但为了自动化，我们创建一个简单的脚本提示用户
  
  console.log(`需要创建 ${size}x${size} 的图标文件`);
  console.log(`建议使用在线工具生成图标，或使用 ImageMagick/PIL`);
  
  // 创建一个占位符文件，至少让扩展可以加载
  // 使用一个最小的 1x1 透明 PNG
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, size & 0xFF, (size >> 8) & 0xFF, 0x00, 0x00, // width
    0x00, 0x00, 0x00, size & 0xFF, (size >> 8) & 0xFF, 0x00, 0x00, // height
    0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x00, 0x00, 0x00, 0x00, // CRC (placeholder)
    0x00, 0x00, 0x00, 0x00, // IEND
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ]);
  
  return minimalPNG;
}

// 使用更简单的方法：创建一个使用 canvas 的脚本
// 但如果没有 canvas，我们使用在线工具或提供说明

console.log('正在生成图标文件...');

// 检查是否有 canvas 模块
let canvas;
try {
  canvas = require('canvas');
  console.log('✅ 找到 canvas 模块，使用它生成图标');
  
  const sizes = [16, 48, 128];
  sizes.forEach(size => {
    const img = canvas.createCanvas(size, size);
    const ctx = img.getContext('2d');
    
    // 绘制蓝色圆形背景
    ctx.fillStyle = '#6366f1'; // indigo-500
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // 绘制白色 "C" 字母
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', size/2, size/2);
    
    // 保存文件
    const buffer = img.toBuffer('image/png');
    fs.writeFileSync(`icon${size}.png`, buffer);
    console.log(`✅ 已创建 icon${size}.png`);
  });
  
  console.log('\n✨ 所有图标已生成完成！');
} catch (e) {
  console.log('❌ 未找到 canvas 模块');
  console.log('正在安装 canvas...');
  
  // 尝试安装 canvas
  const { execSync } = require('child_process');
  try {
    execSync('npm install canvas --save-dev', { stdio: 'inherit' });
    console.log('✅ canvas 已安装，请重新运行此脚本');
    process.exit(0);
  } catch (installError) {
    console.log('❌ 无法自动安装 canvas');
    console.log('\n💡 解决方案：');
    console.log('1. 手动安装: npm install canvas');
    console.log('2. 或使用在线工具生成图标: https://www.favicon-generator.org/');
    console.log('3. 或使用 ImageMagick: convert -size 16x16 xc:blue icon16.png');
    process.exit(1);
  }
}

