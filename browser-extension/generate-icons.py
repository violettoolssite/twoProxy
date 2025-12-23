#!/usr/bin/env python3
"""
生成浏览器扩展所需的图标文件
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """创建指定尺寸的图标"""
    # 创建新图像，使用透明背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制背景圆形（蓝色渐变）
    center = size // 2
    radius = size // 2 - 4
    
    # 绘制外圈（深蓝色）
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill=(99, 102, 241, 255),  # indigo-500
        outline=(67, 56, 202, 255),  # indigo-600
        width=2
    )
    
    # 绘制内圈（浅蓝色）
    inner_radius = radius - 8
    draw.ellipse(
        [center - inner_radius, center - inner_radius, 
         center + inner_radius, center + inner_radius],
        fill=(129, 140, 248, 255),  # indigo-400
    )
    
    # 绘制字母 "C" (Cursor)
    try:
        # 尝试使用系统字体
        font_size = int(size * 0.5)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            # 使用默认字体
            font = ImageFont.load_default()
    
    # 计算文本位置（居中）
    text = "C"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center - text_width // 2
    text_y = center - text_height // 2 - 2
    
    # 绘制白色字母
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    # 保存图像
    img.save(output_path, 'PNG')
    print(f"✅ 已创建图标: {output_path} ({size}x{size})")

def main():
    """生成所有尺寸的图标"""
    # 确保在正确的目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # 生成不同尺寸的图标
    sizes = [16, 48, 128]
    for size in sizes:
        output_path = f"icon{size}.png"
        create_icon(size, output_path)
    
    print("\n✨ 所有图标已生成完成！")
    print("现在可以在浏览器中加载扩展了。")

if __name__ == "__main__":
    main()

